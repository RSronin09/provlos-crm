import { unauthorizedResponse, zodErrorResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { spreadsheetImportSchema } from "@/lib/crm-validation";
import { db } from "@/lib/db";
import { saveDiscoveredContacts } from "@/lib/save-contacts";
import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  const body = await request.json().catch(() => null);
  const parsed = spreadsheetImportSchema.safeParse(body);

  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  // NOTE: this route imports exactly what the spreadsheet contains — accounts
  // and any contacts listed in the rows. It never invents people via web
  // search; channel enrichment for known contacts is a separate, explicit step.
  const { rows } = parsed.data;

  let created = 0;
  let skipped = 0;
  let contactsCreated = 0;
  const errors: { row: number; error: string }[] = [];

  type ImportedAccount = { id: string; companyName: string; website: string | null };
  const newAccounts: ImportedAccount[] = [];

  // Prefetch all potentially matching accounts in one query instead of a
  // findFirst per row (rows can number in the hundreds).
  const websites = [...new Set(rows.map((r) => r.website?.trim()).filter((w): w is string => !!w))];
  const companyNames = [...new Set(rows.map((r) => r.companyName.trim()))];
  const existingAccounts = await db.account.findMany({
    where: {
      OR: [
        ...(websites.length ? [{ website: { in: websites } }] : []),
        { companyName: { in: companyNames, mode: "insensitive" as const } },
      ],
    },
    select: { id: true, companyName: true, website: true },
  });

  const accountByWebsite = new Map(
    existingAccounts.filter((a) => a.website).map((a) => [a.website as string, a]),
  );
  const accountByName = new Map(existingAccounts.map((a) => [a.companyName.toLowerCase(), a]));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    try {
      const website = row.website?.trim() || null;
      const companyName = row.companyName.trim();

      const existing =
        (website ? accountByWebsite.get(website) : undefined) ??
        accountByName.get(companyName.toLowerCase());

      let account = existing ?? null;

      if (!existing) {
        account = await db.account.create({
          data: {
            companyName,
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
          select: { id: true, companyName: true, website: true },
        });
        created++;
        newAccounts.push({
          id: account.id,
          companyName: account.companyName,
          website: account.website ?? null,
        });
        // Register the new account so duplicate rows in the same sheet dedupe.
        if (account.website) accountByWebsite.set(account.website, account);
        accountByName.set(account.companyName.toLowerCase(), account);
      } else {
        skipped++;
      }

      if (!account) continue;

      // Save any contact provided directly in the spreadsheet row
      const contactName =
        row.contactName?.trim() ||
        [row.contactFirstName, row.contactLastName].filter(Boolean).join(" ").trim() ||
        null;

      if (contactName || row.contactEmail) {
        const fullName = contactName || row.contactEmail!.split("@")[0];
        const nameParts = fullName.split(" ");

        const result = await saveDiscoveredContacts(
          account.id,
          [
            {
              fullName,
              firstName:
                row.contactFirstName?.trim() || (nameParts.length > 1 ? nameParts[0] : fullName),
              lastName:
                row.contactLastName?.trim() ||
                (nameParts.length > 1 ? nameParts.slice(1).join(" ") : null),
              title: row.contactTitle,
              email: row.contactEmail,
              phone: row.contactPhone,
              source: "spreadsheet_import",
            },
          ],
          { updateExisting: false },
        );
        contactsCreated += result.created;
      }
    } catch (err) {
      errors.push({
        row: i + 1,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return Response.json(
    {
      data: {
        created,
        skipped,
        contactsCreated,
        errors,
      },
      message: `Import complete: ${created} accounts created, ${skipped} skipped, ${contactsCreated} contacts added.`,
    },
    { status: 201 },
  );
}
