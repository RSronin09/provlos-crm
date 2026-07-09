import { db } from "@/lib/db";

export type DiscoveredContact = {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  title?: string | null;
  department?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  confidenceScore?: number | null;
  source?: string | null;
};

export type SaveContactsResult = {
  created: number;
  updated: number;
  skipped: number;
};

/**
 * Persists discovered/enriched people as contacts on an account.
 *
 * Loads the account's existing contacts once and dedupes in memory (by email,
 * then by full name), avoiding the per-person lookup queries this codebase
 * previously repeated in every discovery route.
 *
 * Existing contacts are never clobbered: when `updateExisting` is set, only
 * missing fields (email, phone, LinkedIn, title) are filled in from the new
 * data, and confidenceScore only ever increases.
 */
export async function saveDiscoveredContacts(
  accountId: string,
  people: DiscoveredContact[],
  options: { updateExisting?: boolean } = {},
): Promise<SaveContactsResult> {
  const result: SaveContactsResult = { created: 0, updated: 0, skipped: 0 };
  if (!people.length) return result;

  const existingContacts = await db.contact.findMany({
    where: { accountId },
    select: {
      id: true,
      fullName: true,
      firstName: true,
      lastName: true,
      title: true,
      email: true,
      phone: true,
      linkedinUrl: true,
      confidenceScore: true,
    },
  });

  const byEmail = new Map<string, (typeof existingContacts)[number]>();
  const byName = new Map<string, (typeof existingContacts)[number]>();
  for (const contact of existingContacts) {
    if (contact.email) byEmail.set(contact.email.toLowerCase(), contact);
    if (contact.fullName) byName.set(contact.fullName.toLowerCase(), contact);
  }

  for (const person of people) {
    const fullName =
      person.fullName?.trim() ||
      [person.firstName, person.lastName].filter(Boolean).join(" ").trim();
    if (!fullName) {
      result.skipped++;
      continue;
    }

    const existing =
      (person.email ? byEmail.get(person.email.toLowerCase()) : undefined) ??
      byName.get(fullName.toLowerCase());

    if (existing) {
      const hasNewData =
        (!existing.email && person.email) ||
        (!existing.phone && person.phone) ||
        (!existing.linkedinUrl && person.linkedinUrl) ||
        (!existing.title && person.title);

      if (!options.updateExisting || !hasNewData) {
        result.skipped++;
        continue;
      }

      const updated = await db.contact.update({
        where: { id: existing.id },
        data: {
          email: existing.email ?? person.email ?? undefined,
          phone: existing.phone ?? person.phone ?? undefined,
          linkedinUrl: existing.linkedinUrl ?? person.linkedinUrl ?? undefined,
          title: existing.title ?? person.title ?? undefined,
          firstName: existing.firstName ?? person.firstName ?? undefined,
          lastName: existing.lastName ?? person.lastName ?? undefined,
          confidenceScore: Math.max(existing.confidenceScore ?? 0, person.confidenceScore ?? 0),
          source: person.source ?? undefined,
          lastVerifiedAt: new Date(),
        },
      });
      if (updated.email) byEmail.set(updated.email.toLowerCase(), updated);
      result.updated++;
      continue;
    }

    const created = await db.contact.create({
      data: {
        accountId,
        fullName,
        firstName: person.firstName ?? undefined,
        lastName: person.lastName ?? undefined,
        title: person.title ?? undefined,
        department: person.department ?? undefined,
        email: person.email ?? undefined,
        phone: person.phone ?? undefined,
        linkedinUrl: person.linkedinUrl ?? undefined,
        confidenceScore: person.confidenceScore ?? undefined,
        source: person.source ?? "enrichment",
        lastVerifiedAt: new Date(),
      },
      select: {
        id: true,
        fullName: true,
        firstName: true,
        lastName: true,
        title: true,
        email: true,
        phone: true,
        linkedinUrl: true,
        confidenceScore: true,
      },
    });
    if (created.email) byEmail.set(created.email.toLowerCase(), created);
    byName.set(fullName.toLowerCase(), created);
    result.created++;
  }

  return result;
}
