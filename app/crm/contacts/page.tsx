import Link from "next/link";
import { CreateContactModal } from "@/components/crm/create-contact-modal";
import { DataTable } from "@/components/crm/ui/data-table";
import { EmptyState } from "@/components/crm/ui/empty-state";
import { FilterBar } from "@/components/crm/ui/filter-bar";
import { PageHeader } from "@/components/crm/ui/page-header";
import { SearchInput } from "@/components/crm/ui/search-input";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

async function getAccountName(accountId: string): Promise<string | null> {
  try {
    const account = await db.account.findUnique({
      where: { id: accountId },
      select: { companyName: true },
    });
    return account?.companyName ?? null;
  } catch {
    return null;
  }
}

type ContactsPageProps = {
  searchParams?: Promise<{
    search?: string;
    accountId?: string;
  }>;
};

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const filters = (await searchParams) ?? {};

  let contacts: Prisma.ContactGetPayload<{ include: { account: true } }>[] = [];
  let dbWarning: string | null = null;

  try {
    contacts = await db.contact.findMany({
      where: {
        ...(filters.search
          ? {
              OR: [
                { fullName: { contains: filters.search, mode: "insensitive" } },
                { firstName: { contains: filters.search, mode: "insensitive" } },
                { lastName: { contains: filters.search, mode: "insensitive" } },
                { email: { contains: filters.search, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(filters.accountId ? { accountId: filters.accountId } : {}),
      },
      include: { account: true },
      orderBy: { updatedAt: "desc" },
      take: 300,
    });
  } catch {
    dbWarning = "Database is unreachable. Check DATABASE_URL and run migrations.";
  }

  const filteredAccountName = filters.accountId ? await getAccountName(filters.accountId) : null;
  const hasActiveFilters = Boolean(filters.search || filters.accountId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacts"
        subtitle="Decision makers and stakeholders associated with accounts."
        actions={<CreateContactModal />}
      />

      {filters.accountId ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          <span>
            Showing contacts for{" "}
            <Link href={`/crm/accounts/${filters.accountId}`} className="font-medium hover:underline">
              {filteredAccountName ?? "this account"}
            </Link>
          </span>
          <Link href="/crm/contacts" className="ml-auto text-xs text-blue-700 hover:underline">
            Clear filter
          </Link>
        </div>
      ) : null}

      <FilterBar>
        <SearchInput
          placeholder="Search contact name or email"
          defaultValue={filters.search}
          className="md:col-span-3"
        />
        {filters.accountId ? (
          <input type="hidden" name="accountId" value={filters.accountId} />
        ) : null}
        <button type="submit" className="rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white">
          Apply
        </button>
      </FilterBar>

      <DataTable
        headers={[
          "Full Name",
          "Title",
          "Department",
          "Account",
          "Email",
          "Phone",
          "LinkedIn",
          "Source",
          "Last Verified",
        ]}
      >
        {contacts.map((contact) => (
          <tr key={contact.id} className="border-t border-slate-200 hover:bg-slate-50">
            <td className="px-4 py-3 font-medium">
              <Link href={`/crm/contacts/${contact.id}`} className="hover:underline">
                {contact.fullName ||
                  `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() ||
                  "Unnamed contact"}
              </Link>
            </td>
            <td className="px-4 py-3">{contact.title ?? "-"}</td>
            <td className="px-4 py-3">{contact.department ?? "-"}</td>
            <td className="px-4 py-3">
              <Link href={`/crm/accounts/${contact.accountId}`} className="text-blue-700 hover:underline">
                {contact.account.companyName}
              </Link>
            </td>
            <td className="px-4 py-3">{contact.email ?? "-"}</td>
            <td className="px-4 py-3">{contact.phone ?? "-"}</td>
            <td className="px-4 py-3">
              {contact.linkedinUrl ? (
                <a href={contact.linkedinUrl} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
                  LinkedIn
                </a>
              ) : (
                "-"
              )}
            </td>
            <td className="px-4 py-3">{contact.source ?? "-"}</td>
            <td className="px-4 py-3">
              {contact.lastVerifiedAt ? contact.lastVerifiedAt.toISOString().slice(0, 10) : "-"}
            </td>
          </tr>
        ))}
      </DataTable>

      {!contacts.length && !dbWarning ? (
        <EmptyState
          title={hasActiveFilters ? "No matching contacts" : "No contacts yet"}
          description={
            hasActiveFilters
              ? "Try adjusting your search or clearing filters."
              : "Use Lead Discovery or add contacts from account records."
          }
        />
      ) : null}
      {dbWarning ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {dbWarning}
        </p>
      ) : null}
    </div>
  );
}
