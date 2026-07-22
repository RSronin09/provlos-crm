// Compact channel indicators for how a contact can actually be reached.
// Server-component friendly: no hooks, no client runtime.

const EMAIL_STATUS_STYLES: Record<string, { label: string; className: string }> = {
  verified: { label: "Verified", className: "bg-emerald-100 text-emerald-800" },
  risky: { label: "Risky", className: "bg-amber-100 text-amber-800" },
  guessed: { label: "Guessed", className: "bg-slate-200 text-slate-700" },
};

export function EmailStatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const style = EMAIL_STATUS_STYLES[status];
  if (!style) return null;
  return (
    <span className={`ml-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.className}`}>
      {style.label}
    </span>
  );
}

export function PhoneTypeBadge({ phoneType }: { phoneType: string | null }) {
  if (!phoneType) return null;
  if (phoneType === "main_line") {
    return (
      <span className="ml-1.5 inline-block rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
        Main line
      </span>
    );
  }
  if (phoneType === "direct") {
    return (
      <span className="ml-1.5 inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
        Direct
      </span>
    );
  }
  return null;
}

/**
 * One-glance summary of every open channel: ✉ email, ☎ phone, in LinkedIn.
 * Grey when the channel is missing so gaps are as visible as coverage.
 */
export function ReachabilitySummary({
  email,
  emailStatus,
  phone,
  phoneType,
  linkedinUrl,
}: {
  email: string | null;
  emailStatus: string | null;
  phone: string | null;
  phoneType: string | null;
  linkedinUrl: string | null;
}) {
  const channel = (active: boolean, strong: boolean, symbol: string, title: string) => (
    <span
      title={title}
      className={`inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-semibold ${
        active
          ? strong
            ? "bg-emerald-100 text-emerald-800"
            : "bg-amber-100 text-amber-800"
          : "bg-slate-100 text-slate-300"
      }`}
    >
      {symbol}
    </span>
  );

  return (
    <span className="inline-flex items-center gap-1">
      {channel(
        !!email,
        emailStatus === "verified",
        "✉",
        email ? `Email${emailStatus ? ` (${emailStatus})` : ""}` : "No email",
      )}
      {channel(
        !!phone,
        phoneType !== "main_line",
        "☎",
        phone ? (phoneType === "main_line" ? "Facility main line — ask for contact by name" : "Phone") : "No phone",
      )}
      {channel(!!linkedinUrl, true, "in", linkedinUrl ? "LinkedIn profile" : "No LinkedIn")}
    </span>
  );
}
