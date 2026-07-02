import { uuidSchema } from "@/lib/api";
import { db } from "@/lib/db";
import { NextRequest } from "next/server";

// Receiver for Apollo's asynchronous phone-number reveal.
//
// Apollo only delivers phone numbers to a public webhook — never in the
// synchronous people/match response. lib/decision-makers.ts appends
// ?contactId=<uuid> to the webhook URL it registers with Apollo, so each
// delivery can be attached to the right CRM contact without any extra
// request-tracking state. Deliveries may be retried by Apollo, so this
// handler is idempotent (it only fills a missing phone).

type ApolloPhoneNumber = {
  raw_number?: string;
  sanitized_number?: string;
  type?: string;
  status?: string;
};

type ApolloWebhookPayload = {
  people?: { phone_numbers?: ApolloPhoneNumber[] }[];
  person?: { phone_numbers?: ApolloPhoneNumber[] };
  phone_numbers?: ApolloPhoneNumber[];
};

function pickBestNumber(numbers: ApolloPhoneNumber[]): string | null {
  const usable = numbers.filter((n) => n.raw_number || n.sanitized_number);
  const preferred =
    usable.find((n) => n.type === "work_direct") ??
    usable.find((n) => n.type === "mobile") ??
    usable[0];
  return preferred?.sanitized_number ?? preferred?.raw_number ?? null;
}

export async function POST(request: NextRequest) {
  const contactId = new URL(request.url).searchParams.get("contactId");
  if (!contactId || !uuidSchema.safeParse(contactId).success) {
    return Response.json({ error: "Missing or invalid contactId" }, { status: 400 });
  }

  const payload = (await request.json().catch(() => null)) as ApolloWebhookPayload | null;
  if (!payload) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const numbers: ApolloPhoneNumber[] = [
    ...(payload.phone_numbers ?? []),
    ...(payload.person?.phone_numbers ?? []),
    ...(payload.people ?? []).flatMap((p) => p.phone_numbers ?? []),
  ];

  const phone = pickBestNumber(numbers);
  if (!phone) {
    // Nothing usable in this delivery — acknowledge so Apollo stops retrying.
    return Response.json({ ok: true, updated: false });
  }

  try {
    const contact = await db.contact.findUnique({
      where: { id: contactId },
      select: { id: true, phone: true },
    });
    if (!contact) return Response.json({ ok: true, updated: false });

    // Idempotent: only fill a missing phone, never overwrite manual data.
    if (contact.phone) return Response.json({ ok: true, updated: false });

    await db.contact.update({
      where: { id: contactId },
      data: { phone, lastVerifiedAt: new Date() },
    });
    return Response.json({ ok: true, updated: true });
  } catch {
    // Return 200 anyway — a retry storm from Apollo won't help a DB outage.
    return Response.json({ ok: true, updated: false });
  }
}
