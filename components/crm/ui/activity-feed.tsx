import { EmptyState } from "./empty-state";

type ActivityItem = {
  id: string;
  title: string;
  content?: string | null;
  timestamp: string;
};

type ActivityFeedProps = {
  items: ActivityItem[];
};

export function ActivityFeed({ items }: ActivityFeedProps) {
  if (!items.length) {
    return <EmptyState title="No activity yet" description="Log calls, notes, emails, and meetings to build a timeline." />;
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="rounded-md border border-slate-200 bg-white px-3 py-2">
          <p className="text-sm font-medium">{item.title}</p>
          {item.content ? <p className="mt-1 text-sm text-slate-600">{item.content}</p> : null}
          <p className="mt-1 text-xs text-slate-500">{item.timestamp}</p>
        </li>
      ))}
    </ul>
  );
}
