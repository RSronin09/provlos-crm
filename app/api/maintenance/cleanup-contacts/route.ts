import { unauthorizedResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { db } from "@/lib/db";
import { cleanPersonName } from "@/lib/decision-makers";
import { NextRequest } from "next/server";

// Removes junk "contacts" that older search-snippet extraction saved —
// strings like "Director Details" or "Our Team" that aren't people.
//
// Only contacts with NO email, NO phone, and NO LinkedIn are considered
// (anything with real contact data is never touched), and only when their
// name fails person-name validation. Defaults to a dry run; pass
// { "confirm": true } to actually delete.
export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  const body = await request.json().catch(() => ({}));
  const confirm = body?.confirm === true;

  const candidates = await db.contact.findMany({
    where: { email: null, phone: null, linkedinUrl: null },
    select: {
      id: true,
      fullName: true,
      firstName: true,
      lastName: true,
      account: { select: { companyName: true } },
    },
  });

  const junk = candidates.filter((contact) => {
    const raw =
      contact.fullName ?? [contact.firstName, contact.lastName].filter(Boolean).join(" ");
    return !cleanPersonName(raw).fullName;
  });

  if (!confirm) {
    return Response.json({
      data: {
        dryRun: true,
        wouldDelete: junk.length,
        samples: junk.slice(0, 25).map((c) => ({
          name: c.fullName,
          company: c.account.companyName,
        })),
      },
      message:
        junk.length === 0
          ? "No junk contacts found."
          : `${junk.length} junk contact(s) found (non-person names with no email/phone/LinkedIn). Re-run with confirm to delete them.`,
    });
  }

  const { count } = await db.contact.deleteMany({
    where: { id: { in: junk.map((c) => c.id) } },
  });

  return Response.json({
    data: { dryRun: false, deleted: count },
    message: `Deleted ${count} junk contact(s). Tasks and activities that referenced them remain on their accounts.`,
  });
}
