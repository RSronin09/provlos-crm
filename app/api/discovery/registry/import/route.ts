import { unauthorizedResponse, zodErrorResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { registryImportSchema } from "@/lib/crm-validation";
import { db } from "@/lib/db";
import { enrichContactByName } from "@/lib/decision-makers";
import { getFacilityPreset, resolveCities, searchNpiFacilities, type NpiFacility } from "@/lib/npi";
import { saveDiscoveredContacts } from "@/lib/save-contacts";
import { NextRequest } from "next/server";

// Cap paid email-enrichment lookups per import to stay inside serverless
// time budgets (each Apollo/PDL match takes ~2-10s and may cost credits).
const MAX_EMAIL_ENRICH = 15;

// Imports NPPES registry facilities as Accounts, with the authorized
// official landed as a Contact (name, title, phone — all free from the
// registry). Optionally looks up the official's email via Apollo/PDL.
export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  const body = await request.json().catch(() => ({}));
  const parsed = registryImportSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const cities = resolveCities(parsed.data);
  if (!cities.length) {
    return Response.json(
      { error: "Select at least one county or provide a city list." },
      { status: 400 },
    );
  }

  const { facilities } = await searchNpiFacilities({
    cities,
    state: parsed.data.state,
    facilityTypeKeys: parsed.data.facilityTypes,
  });

  const npiFilter = parsed.data.npis?.length ? new Set(parsed.data.npis) : null;
  const toImport = npiFilter ? facilities.filter((f) => npiFilter.has(f.npi)) : facilities;

  let accountsCreated = 0;
  let accountsMatched = 0;
  let contactsCreated = 0;
  let contactsUpdated = 0;

  // Prefetch existing accounts by name in one query.
  const existingAccounts = toImport.length
    ? await db.account.findMany({
        where: {
          companyName: { in: toImport.map((f) => f.organizationName), mode: "insensitive" },
        },
        select: { id: true, companyName: true },
      })
    : [];
  const accountByName = new Map(existingAccounts.map((a) => [a.companyName.toLowerCase(), a.id]));

  const importedForEnrich: { accountId: string; facility: NpiFacility }[] = [];

  for (const facility of toImport) {
    const preset = getFacilityPreset(facility.facilityTypeKey);

    let accountId = accountByName.get(facility.organizationName.toLowerCase()) ?? null;

    if (accountId) {
      accountsMatched++;
    } else {
      const account = await db.account.create({
        data: {
          companyName: facility.organizationName,
          accountType: "CUSTOMER",
          stage: "TARGET",
          industry: "Healthcare",
          orgType: facility.facilityType,
          whatTheyMove: preset?.whatTheyMove,
          whyHireCouriers: preset?.whyHireCouriers,
          phone: facility.phone ?? undefined,
          address1: facility.address1 ?? undefined,
          city: facility.city ?? undefined,
          state: facility.state ?? undefined,
          zip: facility.zip ?? undefined,
          region: facility.county ?? undefined,
          notes: `Imported from NPPES NPI registry (NPI ${facility.npi}). Legal name: ${facility.legalName}.`,
          sourceRowJson: { npi: facility.npi, source: "nppes_registry" },
        },
        select: { id: true },
      });
      accountId = account.id;
      accountByName.set(facility.organizationName.toLowerCase(), accountId);
      accountsCreated++;
    }

    if (facility.authorizedOfficial) {
      const saved = await saveDiscoveredContacts(
        accountId,
        [
          {
            firstName: facility.authorizedOfficial.firstName,
            lastName: facility.authorizedOfficial.lastName,
            fullName: facility.authorizedOfficial.fullName,
            title: facility.authorizedOfficial.title,
            phone: facility.authorizedOfficial.phone,
            confidenceScore: 0.85,
            source: "nppes_registry",
          },
        ],
        { updateExisting: true },
      );
      contactsCreated += saved.created;
      contactsUpdated += saved.updated;
      if (saved.created > 0 || saved.updated > 0) {
        importedForEnrich.push({ accountId, facility });
      }
    }
  }

  // Optional: look up email addresses for the officials we just imported.
  let emailsFound = 0;
  let emailEnrichAttempted = 0;
  if (parsed.data.enrichEmails) {
    const candidates = importedForEnrich.slice(0, MAX_EMAIL_ENRICH);
    for (const { accountId, facility } of candidates) {
      const official = facility.authorizedOfficial!;
      emailEnrichAttempted++;
      try {
        const match = await enrichContactByName({
          firstName: official.firstName,
          lastName: official.lastName,
          fullName: official.fullName,
          organizationName: facility.organizationName,
        });
        if (match?.email) {
          const contact = await db.contact.findFirst({
            where: {
              accountId,
              fullName: { equals: official.fullName, mode: "insensitive" },
            },
            select: { id: true, email: true },
          });
          if (contact && !contact.email) {
            await db.contact.update({
              where: { id: contact.id },
              data: {
                email: match.email,
                linkedinUrl: match.linkedinUrl ?? undefined,
                confidenceScore: match.confidenceScore,
                lastVerifiedAt: new Date(),
              },
            });
            emailsFound++;
          }
        }
      } catch (error) {
        console.error(
          `Email enrichment failed for ${official.fullName} @ ${facility.organizationName}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  return Response.json(
    {
      data: {
        facilitiesFound: facilities.length,
        imported: toImport.length,
        accountsCreated,
        accountsMatched,
        contactsCreated,
        contactsUpdated,
        emailEnrichAttempted,
        emailsFound,
        emailEnrichCapped:
          parsed.data.enrichEmails && importedForEnrich.length > MAX_EMAIL_ENRICH
            ? MAX_EMAIL_ENRICH
            : null,
      },
      message: `Imported ${accountsCreated} new facilities (${accountsMatched} already in CRM) with ${contactsCreated} decision-maker contacts${parsed.data.enrichEmails ? `; found ${emailsFound} email(s)` : ""}.`,
    },
    { status: 201 },
  );
}
