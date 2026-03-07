import { EmptyState } from "./empty-state";

type ContactRow = {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
};

type ContactListCardProps = {
  title: string;
  contacts: ContactRow[];
};

export function ContactListCard({ title, contacts }: ContactListCardProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-lg font-semibold">{title}</h3>
      {!contacts.length ? (
        <EmptyState title="No contacts found" description="Run lead discovery or add contacts manually." />
      ) : (
        <ul className="space-y-2">
          {contacts.map((contact) => (
            <li key={contact.id} className="rounded-md border border-slate-200 px-3 py-2">
              <p className="text-sm font-medium">{contact.title}</p>
              {contact.subtitle ? <p className="text-sm text-slate-600">{contact.subtitle}</p> : null}
              {contact.meta ? <p className="text-xs text-slate-500">{contact.meta}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
