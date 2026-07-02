import { redirect } from "next/navigation";

type AccountsPageProps = {
  searchParams?: Promise<Record<string, string | undefined>>;
};

// `/crm/accounts` duplicated `/crm/relationships` with slightly different
// columns/terminology. Individual account records still live at
// `/crm/accounts/[id]`, but the list view is consolidated under
// "Relationships" to avoid two competing entry points for the same data.
export default async function AccountsPage({ searchParams }: AccountsPageProps) {
  const params = (await searchParams) ?? {};
  const query = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])),
  ).toString();
  redirect(query ? `/crm/relationships?${query}` : "/crm/relationships");
}
