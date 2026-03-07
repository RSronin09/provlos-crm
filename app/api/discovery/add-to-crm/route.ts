import { unauthorizedResponse, zodErrorResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { addDiscoveredLeadSchema } from "@/lib/crm-validation";
import { db } from "@/lib/db";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  const body = await request.json();
  const parsed = addDiscoveredLeadSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const { companyName, website, state, region, contacts } = parsed.data;

  const account =
    (await db.account.findFirst({
      where: {
        OR: [
          ...(website ? [{ website }] : []),
          { companyName: { equals: companyName, mode: "insensitive" } },
        ],
      },
    })) ??
    (await db.account.create({
      data: {
        companyName,
        website: website ?? undefined,
        state: state ?? undefined,
        region: region ?? undefined,
        stage: "TARGET",
        enrichmentStatus: "ENRICHED",
      },
    }));

  for (const contact of contacts) {
    const existing =
      (contact.email
        ? await db.contact.findFirst({
            where: {
              accountId: account.id,
              email: { equals: contact.email, mode: "insensitive" },
            },
          })
        : null) ??
      (await db.contact.findFirst({
        where: {
          accountId: account.id,
          fullName: { equals: contact.fullName, mode: "insensitive" },
          title: contact.title ?? undefined,
        },
      }));

    if (existing) continue;

    await db.contact.create({
      data: {
        accountId: account.id,
        ...contact,
        lastVerifiedAt: new Date(),
      },
    });
  }

  const savedContacts = await db.contact.findMany({
    where: { accountId: account.id },
    orderBy: { confidenceScore: "desc" },
  });

  return Response.json({ data: { account, contacts: savedContacts } });
}
