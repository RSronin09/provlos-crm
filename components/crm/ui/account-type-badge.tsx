import { getTypeConfig } from "@/lib/account-types";

type AccountTypeBadgeProps = {
  accountType: string | null | undefined;
};

export function AccountTypeBadge({ accountType }: AccountTypeBadgeProps) {
  const config = getTypeConfig(accountType);
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${config.badgeClass}`}>
      {config.label}
    </span>
  );
}
