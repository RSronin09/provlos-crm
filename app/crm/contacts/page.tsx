import Link from "next/link";
import { DataTable } from "@/components/crm/ui/data-table";
import { EmptyState } from "@/components/crm/ui/empty-state";
import { FilterBar } from "@/components/crm/ui/filter-bar";
import { PageHeader } from "@/components/crm/ui/page-header";
import { SearchInput } from "@/components/crm/ui/search-input";
import { db } from "@/lib/db";

type ContactsPageProps = {
  searchParams?: {
    search?: string;
    accountId?: string;
  };
};

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const filters = searchParams ?? {};

  const contacts = await db.contact.findMany({
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

  return (
    <div className="space-y-6">
      <PageHeader title="Contacts" subtitle="Decision makers and stakeholders associated with accounts." />

      <FilterBar>
        <SearchInput
          placeholder="Search contact name or email"
          defaultValue={filters.search}
          className="md:col-span-3"
        />
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
          "Confidence Score",
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
            <td className="px-4 py-3">{contact.confidenceScore?.toFixed(2) ?? "-"}</td>
            <td className="px-4 py-3">{contact.source ?? "-"}</td>
            <td className="px-4 py-3">
              {contact.lastVerifiedAt ? contact.lastVerifiedAt.toISOString().slice(0, 10) : "-"}
            </td>
          </tr>
        ))}
      </DataTable>

      {!contacts.length ? (
        <EmptyState title="No contacts yet" description="Use Lead Discovery or add contacts from account records." />
      ) : null}
    </div>
  );
}
