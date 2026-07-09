import { unauthorizedResponse, zodErrorResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { instantlyImportSchema } from "@/lib/crm-validation";
import { db } from "@/lib/db";
import { listLeadsInList, type InstantlyEnrichedLead } from "@/lib/instantly";
import { saveDiscoveredContacts } from "@/lib/save-contacts";
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

  // Group leads by company so each account is looked up (and its contacts
  // deduped) once, instead of 2-3 queries per lead.
  const leadsByCompany = new Map<string, { companyName: string; leads: InstantlyEnrichedLead[] }>();
  for (const lead of result.leads) {
    const companyName = lead.company_name?.trim();
    if (!companyName) continue;
    const key = companyName.toLowerCase();
    const group = leadsByCompany.get(key) ?? { companyName, leads: [] };
    group.leads.push(lead);
    leadsByCompany.set(key, group);
  }

  for (const { companyName, leads } of leadsByCompany.values()) {
    const website = leads.find((l) => l.website)?.website ?? null;
    const city = leads.find((l) => l.city)?.city ?? null;
    const state = leads.find((l) => l.state)?.state ?? null;

    const existingAccount = await db.account.findFirst({
      where: {
        OR: [
          ...(website ? [{ website }] : []),
          { companyName: { equals: companyName, mode: "insensitive" } },
        ],
      },
    });

    const account =
      existingAccount ??
      (await db.account.create({
        data: {
          companyName,
          website: website ?? undefined,
          city: city ?? undefined,
          state: state ?? undefined,
          industry: "Healthcare, Pharmaceuticals, & Biotech",
          stage: "TARGET",
          notes: `Imported from Instantly SuperSearch (list ${parsed.data.listId}).`,
        },
      }));

    if (existingAccount) accountsMatched++;
    else accountsCreated++;

    const saved = await saveDiscoveredContacts(
      account.id,
      leads.map((lead) => ({
        firstName: lead.first_name,
        lastName: lead.last_name,
        fullName: [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim() || null,
        title: lead.title,
        email: lead.email,
        phone: lead.phone,
        linkedinUrl: lead.linkedin_url,
        confidenceScore: lead.email ? 0.9 : 0.6,
        source: "instantly_supersearch",
      })),
      { updateExisting: false },
    );
    contactsCreated += saved.created;
    contactsSkipped += saved.skipped;
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
