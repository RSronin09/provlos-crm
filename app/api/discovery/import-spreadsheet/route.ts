import { unauthorizedResponse, zodErrorResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { spreadsheetImportSchema } from "@/lib/crm-validation";
import { db } from "@/lib/db";
import { NextRequest } from "next/server";

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
  const errors: { row: number; error: string }[] = [];
  const accountIds: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    try {
      // Normalise website — strip trailing slashes, blank strings
      const website = row.website?.trim() || null;

      // Deduplicate: look for existing account by website or name
      const existing = await db.account.findFirst({
        where: {
          OR: [
            ...(website ? [{ website }] : []),
            {
              companyName: {
                equals: row.companyName.trim(),
                mode: "insensitive" as const,
              },
            },
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
            sourceRowJson: row.sourceRowJson ? (row.sourceRowJson as import("@prisma/client").Prisma.InputJsonValue) : undefined,
          },
        });
        created++;
      } else {
        skipped++;
      }

      if (!account) continue;
      accountIds.push(account.id);

      // Build contact from row if we have at least a name or email
      const contactName =
        row.contactName?.trim() ||
        [row.contactFirstName, row.contactLastName].filter(Boolean).join(" ").trim() ||
        null;

      if (contactName || row.contactEmail) {
        const fullName = contactName || row.contactEmail!.split("@")[0];

        const existingContact =
          (row.contactEmail
            ? await db.contact.findFirst({
                where: {
                  accountId: account.id,
                  email: { equals: row.contactEmail, mode: "insensitive" },
                },
              })
            : null) ??
          (await db.contact.findFirst({
            where: {
              accountId: account.id,
              fullName: { equals: fullName, mode: "insensitive" },
            },
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

  // If autoEnrich is requested, create one discovery job per new account so the
  // existing enrichment pipeline can pick them up.
  let enrichmentJobsCreated = 0;
  if (autoEnrich && accountIds.length > 0) {
    const accounts = await db.account.findMany({
      where: { id: { in: accountIds } },
      select: { id: true, companyName: true, state: true, region: true },
    });

    for (const account of accounts) {
      try {
        await db.leadDiscoveryJob.create({
          data: {
            query: account.companyName,
            state: account.state ?? undefined,
            region: account.region ?? undefined,
            status: "QUEUED",
          },
        });
        enrichmentJobsCreated++;
      } catch {
        // Non-fatal: enrichment queue failure shouldn't block import result
      }
    }
  }

  return Response.json(
    {
      data: {
        created,
        skipped,
        contactsCreated,
        enrichmentJobsCreated,
        errors,
      },
      message: `Import complete: ${created} accounts created, ${skipped} skipped (already exist), ${contactsCreated} contacts added.`,
    },
    { status: 201 },
  );
}
