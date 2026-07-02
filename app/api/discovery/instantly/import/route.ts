import { unauthorizedResponse, zodErrorResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { instantlyImportSchema } from "@/lib/crm-validation";
import { db } from "@/lib/db";
import { listLeadsInList } from "@/lib/instantly";
import { NextRequest } from "next/server";

// Pulls the (now-enriched, verified-email) leads out of an Instantly list
// created by /api/discovery/instantly/search and lands each one as an
// Account + Contact in the CRM — mirrors /api/discovery/add-to-crm.
export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  const body = await request.json().catch(() => ({}));
  const parsed = instantlyImportSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const result = await listLeadsInList(parsed.data.listId, { limit: parsed.data.limit });
  if (!result.ok) {
    return Response.json({ error: result.error ?? "Failed to fetch leads from Instantly" }, { status: 502 });
  }

  let accountsCreated = 0;
  let accountsMatched = 0;
  let contactsCreated = 0;
  let contactsSkipped = 0;

  for (const lead of result.leads) {
    const companyName = lead.company_name?.trim();
    if (!companyName) continue;

    const existingAccount = await db.account.findFirst({
      where: {
        OR: [
          ...(lead.website ? [{ website: lead.website }] : []),
          { companyName: { equals: companyName, mode: "insensitive" } },
        ],
      },
    });

    const account =
      existingAccount ??
      (await db.account.create({
        data: {
          companyName,
          website: lead.website ?? undefined,
          city: lead.city ?? undefined,
          state: lead.state ?? undefined,
          industry: "Healthcare, Pharmaceuticals, & Biotech",
          stage: "TARGET",
          notes: `Imported from Instantly SuperSearch (list ${parsed.data.listId}).`,
        },
      }));

    if (existingAccount) accountsMatched++;
    else accountsCreated++;

    const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim() || null;

    const existingContact =
      (lead.email
        ? await db.contact.findFirst({
            where: { accountId: account.id, email: { equals: lead.email, mode: "insensitive" } },
          })
        : null) ??
      (fullName
        ? await db.contact.findFirst({
            where: { accountId: account.id, fullName: { equals: fullName, mode: "insensitive" } },
          })
        : null);

    if (existingContact) {
      contactsSkipped++;
      continue;
    }

    await db.contact.create({
      data: {
        accountId: account.id,
        firstName: lead.first_name ?? undefined,
        lastName: lead.last_name ?? undefined,
        fullName: fullName ?? undefined,
        title: lead.title ?? undefined,
        email: lead.email ?? undefined,
        phone: lead.phone ?? undefined,
        linkedinUrl: lead.linkedin_url ?? undefined,
        confidenceScore: lead.email ? 0.9 : 0.6,
        source: "instantly_supersearch",
        lastVerifiedAt: new Date(),
      },
    });
    contactsCreated++;
  }

  return Response.json({
    data: {
      leadsFetched: result.leads.length,
      accountsCreated,
      accountsMatched,
      contactsCreated,
      contactsSkipped,
    },
    message: `Imported ${contactsCreated} new contacts across ${accountsCreated + accountsMatched} accounts from Instantly.`,
  });
}
