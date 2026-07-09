import { unauthorizedResponse, zodErrorResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { decisionMakerSearchSchema } from "@/lib/crm-validation";
import { db } from "@/lib/db";
import { lookupDecisionMakers } from "@/lib/decision-makers";
import { saveDiscoveredContacts } from "@/lib/save-contacts";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  const body = await request.json().catch(() => null);
  const parsed = decisionMakerSearchSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const { companyName, website, state, region, refresh, persistToCrm } = parsed.data;

  const hasProvider =
    process.env.APOLLO_API_KEY ||
    process.env.PDL_API_KEY ||
    process.env.SERPER_API_KEY ||
    process.env.HUNTER_API_KEY;
  if (!hasProvider) {
    return Response.json(
      {
        error:
          "No decision-maker providers configured. Set at least one of APOLLO_API_KEY, PDL_API_KEY, SERPER_API_KEY, or HUNTER_API_KEY in environment variables.",
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

  await saveDiscoveredContacts(resolvedAccount.id, lookup.contacts, { updateExisting: true });

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
