"use client";

import { StatusBadge } from "@/components/crm/ui/status-badge";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type EditableActivity = {
  id: string;
  type: string;
  content: string | null;
  outcome: string | null;
  occurredAt: string;
};

type EditableTask = {
  id: string;
  type: string;
  status: string;
  notes: string | null;
};

type EditableContact = {
  id: string;
  title: string;
  subtitle: string | null;
  meta: string | null;
};

type AccountRecordEditableCardsProps = {
  accountId: string;
  account: {
    industry: string | null;
    orgType: string | null;
    website: string | null;
    phone: string | null;
    city: string | null;
    state: string | null;
    region: string | null;
    priorityScore: number | null;
    notes: string | null;
  };
  contacts: EditableContact[];
  activities: EditableActivity[];
  tasks: EditableTask[];
};

type OverviewFieldKey =
  | "industry"
  | "orgType"
  | "website"
  | "phone"
  | "city"
  | "state"
  | "region"
  | "priorityScore";

export function AccountRecordEditableCards({
  accountId,
  account,
  contacts: initialContacts,
  activities: initialActivities,
  tasks: initialTasks,
}: AccountRecordEditableCardsProps) {
  const router = useRouter();
  const [adminToken, setAdminToken] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [editingOverview, setEditingOverview] = useState(false);
  const [overviewForm, setOverviewForm] = useState({
    industry: account.industry ?? "",
    orgType: account.orgType ?? "",
    website: account.website ?? "",
    phone: account.phone ?? "",
    city: account.city ?? "",
    state: account.state ?? "",
    region: account.region ?? "",
    priorityScore: account.priorityScore?.toString() ?? "",
  });

  const [notes, setNotes] = useState(account.notes ?? "");
  const [contacts, setContacts] = useState(initialContacts);
  const [activities, setActivities] = useState(initialActivities);
  const [tasks, setTasks] = useState(initialTasks);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [editingActivityContent, setEditingActivityContent] = useState("");
  const [editingActivityOutcome, setEditingActivityOutcome] = useState("");

  async function request(path: string, method: "PATCH" | "DELETE", body?: unknown) {
    const response = await fetch(path, {
      method,
      headers: {
        "content-type": "application/json",
        ...(adminToken ? { "x-admin-token": adminToken } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error ?? "Request failed");
    }
    return payload;
  }

  async function run(action: () => Promise<void>, successMessage: string) {
    try {
      setBusy(true);
      setStatus(null);
      await action();
      setStatus(successMessage);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function saveOverview() {
    const priority = overviewForm.priorityScore.trim();
    await request(`/api/accounts/${accountId}`, "PATCH", {
      industry: overviewForm.industry || null,
      orgType: overviewForm.orgType || null,
      website: overviewForm.website || null,
      phone: overviewForm.phone || null,
      city: overviewForm.city || null,
      state: overviewForm.state || null,
      region: overviewForm.region || null,
      priorityScore: priority ? Number(priority) : null,
    });
    setEditingOverview(false);
    router.refresh();
  }

  async function saveNotes() {
    await request(`/api/accounts/${accountId}`, "PATCH", {
      notes: notes.trim() ? notes.trim() : null,
    });
    router.refresh();
  }

  async function clearNotes() {
    await request(`/api/accounts/${accountId}`, "PATCH", { notes: null });
    setNotes("");
    router.refresh();
  }

  async function clearOverviewField(field: OverviewFieldKey) {
    await request(`/api/accounts/${accountId}`, "PATCH", { [field]: null });
    setOverviewForm((prev) => ({ ...prev, [field]: "" }));
    router.refresh();
  }

  async function saveActivity(activityId: string) {
    await request(`/api/activities/${activityId}`, "PATCH", {
      content: editingActivityContent.trim() || null,
      outcome: editingActivityOutcome.trim() || null,
    });
    setActivities((prev) =>
      prev.map((activity) =>
        activity.id === activityId
          ? {
              ...activity,
              content: editingActivityContent.trim() || null,
              outcome: editingActivityOutcome.trim() || null,
            }
          : activity,
      ),
    );
    setEditingActivityId(null);
    setEditingActivityContent("");
    setEditingActivityOutcome("");
    router.refresh();
  }

  async function deleteActivity(activityId: string) {
    await request(`/api/activities/${activityId}`, "DELETE");
    setActivities((prev) => prev.filter((activity) => activity.id !== activityId));
    router.refresh();
  }

  async function deleteTask(taskId: string) {
    await request(`/api/tasks/${taskId}`, "DELETE");
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
    router.refresh();
  }

  async function deleteContact(contactId: string) {
    await request(`/api/contacts/${contactId}`, "DELETE");
    setContacts((prev) => prev.filter((contact) => contact.id !== contactId));
    router.refresh();
  }

  const sortedTimeline = useMemo(
    () =>
      [
        ...activities.map((activity) => ({
          id: `activity-${activity.id}`,
          title: `Activity: ${activity.type}`,
          content: activity.content ?? activity.outcome,
          timestamp: activity.occurredAt.slice(0, 16).replace("T", " "),
        })),
        ...tasks.map((task) => ({
          id: `task-${task.id}`,
          title: `Task ${task.status}: ${task.type}`,
          content: task.notes,
          timestamp: new Date().toISOString().slice(0, 16).replace("T", " "),
        })),
      ].sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [activities, tasks],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block text-sm font-medium text-slate-700">
          Admin Token (required in production)
          <input
            type="password"
            value={adminToken}
            onChange={(event) => setAdminToken(event.target.value)}
            placeholder="Optional in local development"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Overview</h3>
          <button
            type="button"
            onClick={() => setEditingOverview((prev) => !prev)}
            className="rounded-md border border-slate-300 px-3 py-1 text-sm"
          >
            {editingOverview ? "Cancel" : "Edit"}
          </button>
        </div>

        {editingOverview ? (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <InputField
              label="Industry"
              value={overviewForm.industry}
              onChange={(value) => setOverviewForm((prev) => ({ ...prev, industry: value }))}
            />
            <InputField
              label="Org Type"
              value={overviewForm.orgType}
              onChange={(value) => setOverviewForm((prev) => ({ ...prev, orgType: value }))}
            />
            <InputField
              label="Website"
              value={overviewForm.website}
              onChange={(value) => setOverviewForm((prev) => ({ ...prev, website: value }))}
            />
            <InputField
              label="Phone"
              value={overviewForm.phone}
              onChange={(value) => setOverviewForm((prev) => ({ ...prev, phone: value }))}
            />
            <InputField
              label="City"
              value={overviewForm.city}
              onChange={(value) => setOverviewForm((prev) => ({ ...prev, city: value }))}
            />
            <InputField
              label="State"
              value={overviewForm.state}
              onChange={(value) => setOverviewForm((prev) => ({ ...prev, state: value }))}
            />
            <InputField
              label="Region"
              value={overviewForm.region}
              onChange={(value) => setOverviewForm((prev) => ({ ...prev, region: value }))}
            />
            <InputField
              label="Priority Score"
              value={overviewForm.priorityScore}
              onChange={(value) => setOverviewForm((prev) => ({ ...prev, priorityScore: value }))}
            />
            <div className="col-span-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => run(saveOverview, "Account details updated.")}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
              >
                Save Overview
              </button>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Field
              label="Industry"
              value={overviewForm.industry}
              onDelete={() => {
                if (!overviewForm.industry.trim()) return;
                if (!window.confirm("Delete Industry?")) return;
                run(() => clearOverviewField("industry"), "Industry deleted.");
              }}
            />
            <Field
              label="Org Type"
              value={overviewForm.orgType}
              onDelete={() => {
                if (!overviewForm.orgType.trim()) return;
                if (!window.confirm("Delete Org Type?")) return;
                run(() => clearOverviewField("orgType"), "Org type deleted.");
              }}
            />
            <Field
              label="Website"
              value={overviewForm.website}
              onDelete={() => {
                if (!overviewForm.website.trim()) return;
                if (!window.confirm("Delete Website?")) return;
                run(() => clearOverviewField("website"), "Website deleted.");
              }}
            />
            <Field
              label="Phone"
              value={overviewForm.phone}
              onDelete={() => {
                if (!overviewForm.phone.trim()) return;
                if (!window.confirm("Delete Phone?")) return;
                run(() => clearOverviewField("phone"), "Phone deleted.");
              }}
            />
            <Field
              label="City"
              value={overviewForm.city}
              onDelete={() => {
                if (!overviewForm.city.trim()) return;
                if (!window.confirm("Delete City?")) return;
                run(() => clearOverviewField("city"), "City deleted.");
              }}
            />
            <Field
              label="State"
              value={overviewForm.state}
              onDelete={() => {
                if (!overviewForm.state.trim()) return;
                if (!window.confirm("Delete State?")) return;
                run(() => clearOverviewField("state"), "State deleted.");
              }}
            />
            <Field
              label="Region"
              value={overviewForm.region}
              onDelete={() => {
                if (!overviewForm.region.trim()) return;
                if (!window.confirm("Delete Region?")) return;
                run(() => clearOverviewField("region"), "Region deleted.");
              }}
            />
            <Field
              label="Priority Score"
              value={overviewForm.priorityScore}
              onDelete={() => {
                if (!overviewForm.priorityScore.trim()) return;
                if (!window.confirm("Delete Priority Score?")) return;
                run(() => clearOverviewField("priorityScore"), "Priority score deleted.");
              }}
            />
          </dl>
        )}
      </section>

      <section id="contacts" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-lg font-semibold">Contacts</h3>
        <ul className="space-y-2">
          {contacts.map((contact) => (
            <li key={contact.id} className="relative rounded-md border border-slate-200 px-3 py-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm("Delete this contact?")) return;
                  run(() => deleteContact(contact.id), "Contact deleted.");
                }}
                className="absolute right-2 top-2 rounded-md border border-red-300 px-2 py-0.5 text-xs font-medium text-red-700 disabled:opacity-50"
                title="Delete contact"
              >
                ×
              </button>
              <p className="text-sm font-medium">{contact.title}</p>
              {contact.subtitle ? <p className="text-sm text-slate-600">{contact.subtitle}</p> : null}
              {contact.meta ? <p className="text-xs text-slate-500">{contact.meta}</p> : null}
            </li>
          ))}
          {!contacts.length ? (
            <li className="rounded-md border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500">
              No contacts found.
            </li>
          ) : null}
        </ul>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Notes</h3>
          <button
            type="button"
            disabled={busy || !notes.trim()}
            onClick={() => {
              if (!window.confirm("Delete this note?")) return;
              run(clearNotes, "Notes deleted.");
            }}
            className="rounded-md border border-red-300 px-2 py-0.5 text-xs font-medium text-red-700 disabled:opacity-50"
            title="Delete notes"
          >
            ×
          </button>
        </div>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={4}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Add notes for this account..."
        />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => run(saveNotes, "Notes updated.")}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
          >
            Save Notes
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!notes.trim()) return;
              if (!window.confirm("Delete this note?")) return;
              run(clearNotes, "Notes deleted.");
            }}
            className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-60"
          >
            Delete Notes
          </button>
        </div>
      </section>

      <section id="activities" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-lg font-semibold">Activities</h3>
        <ul className="space-y-2">
          {activities.map((activity) => {
            const editing = editingActivityId === activity.id;
            return (
              <li key={activity.id} className="relative rounded-md border border-slate-200 px-3 py-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm("Delete this activity?")) return;
                    run(() => deleteActivity(activity.id), "Activity deleted.");
                  }}
                  className="absolute right-2 top-2 rounded-md border border-red-300 px-2 py-0.5 text-xs font-medium text-red-700 disabled:opacity-50"
                  title="Delete activity"
                >
                  ×
                </button>
                <p className="text-sm font-medium">{activity.type}</p>
                {editing ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={editingActivityContent}
                      onChange={(event) => setEditingActivityContent(event.target.value)}
                      rows={2}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Activity content"
                    />
                    <input
                      value={editingActivityOutcome}
                      onChange={(event) => setEditingActivityOutcome(event.target.value)}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Outcome"
                    />
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-slate-600">{activity.content ?? activity.outcome ?? "-"}</p>
                )}
                <p className="mt-1 text-xs text-slate-500">
                  {activity.occurredAt.slice(0, 16).replace("T", " ")}
                </p>
                <div className="mt-2 flex gap-2">
                  {editing ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(() => saveActivity(activity.id), "Note updated.")}
                      className="rounded-md bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-60"
                    >
                      Save
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingActivityId(activity.id);
                        setEditingActivityContent(activity.content ?? "");
                        setEditingActivityOutcome(activity.outcome ?? "");
                      }}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section id="tasks" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-lg font-semibold">Tasks</h3>
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li key={task.id} className="relative rounded-md border border-slate-200 px-3 py-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm("Delete this task?")) return;
                  run(() => deleteTask(task.id), "Task deleted.");
                }}
                className="absolute right-2 top-2 rounded-md border border-red-300 px-2 py-0.5 text-xs font-medium text-red-700 disabled:opacity-50"
                title="Delete task"
              >
                ×
              </button>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{task.type}</p>
                <StatusBadge value={task.status} />
              </div>
              {task.notes ? <p className="mt-1 text-sm text-slate-600">{task.notes}</p> : null}
            </li>
          ))}
        </ul>
      </section>

      <section id="timeline" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-lg font-semibold">Timeline</h3>
        <ul className="space-y-2">
          {sortedTimeline.map((item) => (
            <li key={item.id} className="rounded-md border border-slate-200 bg-white px-3 py-2">
              <p className="text-sm font-medium">{item.title}</p>
              {item.content ? <p className="mt-1 text-sm text-slate-600">{item.content}</p> : null}
              <p className="mt-1 text-xs text-slate-500">{item.timestamp}</p>
            </li>
          ))}
        </ul>
      </section>

      {status ? (
        <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
          {status}
        </p>
      ) : null}
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
    </label>
  );
}

function Field({
  label,
  value,
  onDelete,
}: {
  label: string;
  value: string;
  onDelete: () => void;
}) {
  return (
    <div className="relative rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <button
        type="button"
        onClick={onDelete}
        className="absolute right-2 top-2 rounded-md border border-red-300 px-2 py-0.5 text-xs font-medium text-red-700"
        title={`Delete ${label}`}
      >
        ×
      </button>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium">{value || "-"}</dd>
    </div>
  );
}
