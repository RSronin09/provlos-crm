import { unauthorizedResponse, zodErrorResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { spreadsheetImportSchema } from "@/lib/crm-validation";
import { db } from "@/lib/db";
import { lookupDecisionMakers } from "@/lib/decision-makers";
import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

// Cap live enrichment to avoid Vercel function timeouts (each lookup ~5-10 s)
const MAX_ENRICH = 20;

async function saveEnrichedContacts(accountId: string, companyName: string, website: string | null) {
  try {
    const { contacts } = await lookupDecisionMakers({ companyName, website });
    let added = 0;

    for (const contact of contacts) {
      const fullName = contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(" ");
      if (!fullName) continue;

      const existingByEmail = contact.email
        ? await db.contact.findFirst({
            where: { accountId, email: { equals: contact.email, mode: "insensitive" } },
          })
        : null;

      const existingByName = await db.contact.findFirst({
        where: { accountId, fullName: { equals: fullName, mode: "insensitive" } },
      });

      const existing = existingByEmail ?? existingByName;

      if (existing) {
        // Update if Apollo found email/phone that wasn't there before
        const needsUpdate =
          (!existing.email && contact.email) ||
          (!existing.phone && contact.phone) ||
          (!existing.linkedinUrl && contact.linkedinUrl);

        if (needsUpdate) {
          await db.contact.update({
            where: { id: existing.id },
            data: {
              email: existing.email ?? contact.email ?? undefined,
              phone: existing.phone ?? contact.phone ?? undefined,
              linkedinUrl: existing.linkedinUrl ?? contact.linkedinUrl ?? undefined,
              title: existing.title ?? contact.title ?? undefined,
              confidenceScore: Math.max(existing.confidenceScore ?? 0, contact.confidenceScore ?? 0),
              source: contact.source ?? existing.source ?? undefined,
              lastVerifiedAt: new Date(),
            },
          });
          added++;
        }
        continue;
      }

      await db.contact.create({
        data: {
          accountId,
          fullName,
          firstName: contact.firstName ?? undefined,
          lastName: contact.lastName ?? undefined,
          title: contact.title ?? undefined,
          department: contact.department ?? undefined,
          email: contact.email ?? undefined,
          phone: contact.phone ?? undefined,
          linkedinUrl: contact.linkedinUrl ?? undefined,
          confidenceScore: contact.confidenceScore ?? undefined,
          source: contact.source ?? "enrichment",
          lastVerifiedAt: new Date(),
        },
      });
      added++;
    }

    return added;
  } catch {
    return 0;
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  const body = await request.json();
  const parsed = spreadsheetImportSchema.safeParse(body);

  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const { rows, autoEnrich } = parsed.data;

  let created = 0;
  let skipped = 0;
  let contactsCreated = 0;
  let enrichedAccounts = 0;
  let enrichedContacts = 0;
  const errors: { row: number; error: string }[] = [];

  type ImportedAccount = { id: string; companyName: string; website: string | null };
  const newAccounts: ImportedAccount[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    try {
      const website = row.website?.trim() || null;

      const existing = await db.account.findFirst({
        where: {
          OR: [
            ...(website ? [{ website }] : []),
            { companyName: { equals: row.companyName.trim(), mode: "insensitive" as const } },
          ],
        },
      });

      let account = existing;

      if (!existing) {
        account = await db.account.create({
          data: {
            companyName: row.companyName.trim(),
            website: website ?? undefined,
            industry: row.industry ?? undefined,
            phone: row.phone ?? undefined,
            city: row.city ?? undefined,
            state: row.state ?? undefined,
            region: row.region ?? undefined,
            notes: row.notes ?? undefined,
            stage: "TARGET",
            sourceRowJson: row.sourceRowJson
              ? (row.sourceRowJson as Prisma.InputJsonValue)
              : undefined,
          },
        });
        created++;
        newAccounts.push({
          id: account!.id,
          companyName: account!.companyName,
          website: account!.website ?? null,
        });
      } else {
        skipped++;
      }

      if (!account) continue;

      // Save any contacts provided directly in the spreadsheet row
      const contactName =
        row.contactName?.trim() ||
        [row.contactFirstName, row.contactLastName].filter(Boolean).join(" ").trim() ||
        null;

      if (contactName || row.contactEmail) {
        const fullName = contactName || row.contactEmail!.split("@")[0];

        const existingContact =
          (row.contactEmail
            ? await db.contact.findFirst({
                where: { accountId: account.id, email: { equals: row.contactEmail, mode: "insensitive" } },
              })
            : null) ??
          (await db.contact.findFirst({
            where: { accountId: account.id, fullName: { equals: fullName, mode: "insensitive" } },
          }));

        if (!existingContact) {
          const nameParts = fullName.split(" ");
          await db.contact.create({
            data: {
              accountId: account.id,
              fullName,
              firstName:
                row.contactFirstName?.trim() || (nameParts.length > 1 ? nameParts[0] : fullName),
              lastName:
                row.contactLastName?.trim() ||
                (nameParts.length > 1 ? nameParts.slice(1).join(" ") : null),
              title: row.contactTitle ?? undefined,
              email: row.contactEmail ?? undefined,
              phone: row.contactPhone ?? undefined,
              source: "spreadsheet_import",
              lastVerifiedAt: new Date(),
            },
          });
          contactsCreated++;
        }
      }
    } catch (err) {
      errors.push({
        row: i + 1,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  // Live enrichment: call lookupDecisionMakers for each newly created account.
  // Run sequentially to respect API rate limits; cap at MAX_ENRICH to avoid timeouts.
  if (autoEnrich && newAccounts.length > 0) {
    const toEnrich = newAccounts.slice(0, MAX_ENRICH);

    for (const account of toEnrich) {
      const added = await saveEnrichedContacts(account.id, account.companyName, account.website);
      if (added > 0) {
        enrichedAccounts++;
        enrichedContacts += added;
      }
    }
  }

  return Response.json(
    {
      data: {
        created,
        skipped,
        contactsCreated,
        enrichedAccounts,
        enrichedContacts,
        cappedAt: autoEnrich && newAccounts.length > MAX_ENRICH ? MAX_ENRICH : null,
        errors,
      },
      message: `Import complete: ${created} accounts created, ${skipped} skipped, ${contactsCreated + enrichedContacts} contacts added.`,
    },
    { status: 201 },
  );
}
