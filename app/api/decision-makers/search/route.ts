import { unauthorizedResponse, zodErrorResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { decisionMakerSearchSchema } from "@/lib/crm-validation";
import { db } from "@/lib/db";
import { lookupDecisionMakers } from "@/lib/decision-makers";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  const body = await request.json();
  const parsed = decisionMakerSearchSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const { companyName, website, state, region, refresh, persistToCrm } = parsed.data;

  if (!process.env.SERPER_API_KEY && !process.env.HUNTER_API_KEY) {
    return Response.json(
      {
        error:
          "No decision-maker providers configured. Set SERPER_API_KEY and/or HUNTER_API_KEY in environment variables.",
      },
      { status: 500 },
    );
  }

  const account = await db.account.findFirst({
    where: {
      OR: [
        ...(website ? [{ website }] : []),
        { companyName: { equals: companyName, mode: "insensitive" } },
      ],
    },
  });

  if (account && !persistToCrm) {
    const existingContacts = await db.contact.findMany({
      where: { accountId: account.id, isDoNotContact: false },
      orderBy: { confidenceScore: "desc" },
    });
    if (existingContacts.length > 0 && !refresh) {
      return Response.json({
        data: {
          account,
          contacts: existingContacts,
          source: "existing",
          note: "Account already exists in CRM. Contacts loaded from existing records.",
        },
      });
    }
  }

  if (!persistToCrm) {
    const lookupPreview = await lookupDecisionMakers({
      companyName,
      website: website ?? account?.website,
    });
    return Response.json({
      data: {
        account: account
          ? { id: account.id, companyName: account.companyName, website: account.website }
          : null,
        contacts: lookupPreview.contacts.map((contact, index) => ({
          id: `preview-${index}`,
          ...contact,
        })),
        source: lookupPreview.providersUsed.join("+") || "unknown",
        note: "Preview results only. Click Add to CRM to persist account and contacts.",
      },
    });
  }

  const resolvedAccount =
    account ??
    (await db.account.create({
      data: {
        companyName,
        website: website ?? undefined,
        state: state ?? undefined,
        region: region ?? undefined,
        stage: "TARGET",
      },
    }));

  const existingContacts = await db.contact.findMany({
    where: { accountId: resolvedAccount.id, isDoNotContact: false },
    orderBy: { confidenceScore: "desc" },
  });

  if (existingContacts.length > 0 && !refresh) {
    return Response.json({ data: { account: resolvedAccount, contacts: existingContacts, source: "existing" } });
  }

  const lookup = await lookupDecisionMakers({
    companyName,
    website: website ?? resolvedAccount.website,
  });

  if (!lookup.contacts.length) {
    return Response.json(
      {
        error:
          "No decision makers found from configured providers. Try adding a website or enable more providers.",
      },
      { status: 404 },
    );
  }

  for (const person of lookup.contacts) {
    const existing =
      (person.email
        ? await db.contact.findFirst({
            where: {
              accountId: resolvedAccount.id,
              email: { equals: person.email, mode: "insensitive" },
            },
          })
        : null) ??
      (await db.contact.findFirst({
        where: {
          accountId: resolvedAccount.id,
          fullName: { equals: person.fullName, mode: "insensitive" },
          title: person.title ?? undefined,
        },
      }));

    if (existing) {
      await db.contact.update({
        where: { id: existing.id },
        data: {
          firstName: person.firstName ?? existing.firstName,
          lastName: person.lastName ?? existing.lastName,
          fullName: person.fullName || existing.fullName,
          title: person.title ?? existing.title,
          department: person.department ?? existing.department,
          email: person.email ?? existing.email,
          phone: person.phone ?? existing.phone,
          confidenceScore: Math.max(existing.confidenceScore ?? 0, person.confidenceScore),
          source: person.source,
          lastVerifiedAt: new Date(),
        },
      });
      continue;
    }

    await db.contact.create({
      data: {
        accountId: resolvedAccount.id,
        ...person,
        lastVerifiedAt: new Date(),
      },
    });
  }

  const contacts = await db.contact.findMany({
    where: { accountId: resolvedAccount.id, isDoNotContact: false },
    orderBy: { confidenceScore: "desc" },
  });

  return Response.json({
    data: {
      account: resolvedAccount,
      contacts,
      source: lookup.providersUsed.join("+") || "unknown",
      note: `Resolved website: ${lookup.resolvedWebsite ?? "n/a"}`,
    },
  });
}
