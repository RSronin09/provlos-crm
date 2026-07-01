"use client";

import { EnrichContactButton } from "@/components/crm/enrich-contact-button";
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
  title: string;
  status: string;
  notes: string | null;
  dueAt: string | null;
};

type EditableContact = {
  id: string;
  title: string;
  subtitle: string | null;
  meta: string | null;
  hasEmail?: boolean;
  hasPhone?: boolean;
  fullName: string | null;
  contactTitle: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
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
  const [status, setStatus] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
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
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({
    fullName: "",
    title: "",
    department: "",
    email: "",
    phone: "",
    linkedinUrl: "",
  });
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editContactForm, setEditContactForm] = useState({
    fullName: "",
    title: "",
    department: "",
    email: "",
    phone: "",
    linkedinUrl: "",
  });
  const [activities, setActivities] = useState(initialActivities);
  const [tasks, setTasks] = useState(
    initialTasks.map((task) => {
      const parsed = parseTaskPayload(task.type, task.notes);
      return {
        ...task,
        title: parsed.title,
        notes: parsed.body,
      };
    }),
  );
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [editingActivityContent, setEditingActivityContent] = useState("");
  const [editingActivityOutcome, setEditingActivityOutcome] = useState("");
  const [newActivityNote, setNewActivityNote] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskNote, setNewTaskNote] = useState("");
  const [newTaskDueAt, setNewTaskDueAt] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState("");
  const [editingTaskNotes, setEditingTaskNotes] = useState("");
  const [editingTaskDueAt, setEditingTaskDueAt] = useState("");

  async function request(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) {
    const response = await fetch(path, {
      method,
      headers: {
        "content-type": "application/json",
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
      setStatusIsError(false);
      await action();
      setStatus(successMessage);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unknown error");
      setStatusIsError(true);
    } finally {
      setBusy(false);
    }
  }

  async function saveOverview() {
    const priority = overviewForm.priorityScore.trim();
    // The website field requires a fully-qualified URL server-side. Most users
    // type "example.com" without a protocol, so normalize it here rather than
    // rejecting a perfectly reasonable input with a confusing validation error.
    const rawWebsite = overviewForm.website.trim();
    const website = rawWebsite && !/^https?:\/\//i.test(rawWebsite) ? `https://${rawWebsite}` : rawWebsite;

    await request(`/api/accounts/${accountId}`, "PATCH", {
      industry: overviewForm.industry || null,
      orgType: overviewForm.orgType || null,
      website: website || null,
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

  async function createActivityNote() {
    const content = newActivityNote.trim();
    if (!content) {
      throw new Error("Write a note before adding.");
    }

    const payload = await request(`/api/accounts/${accountId}/activities`, "POST", {
      type: "NOTE",
      content,
    });

    const created = payload.data as {
      id: string;
      type: string;
      content: string | null;
      outcome: string | null;
      occurredAt: string;
    };

    setActivities((prev) => [
      {
        id: created.id,
        type: created.type,
        content: created.content,
        outcome: created.outcome,
        occurredAt: created.occurredAt,
      },
      ...prev,
    ]);
    setNewActivityNote("");
    router.refresh();
  }

  async function deleteActivity(activityId: string) {
    await request(`/api/activities/${activityId}`, "DELETE");
    setActivities((prev) => prev.filter((activity) => activity.id !== activityId));
    router.refresh();
  }

  async function createTaskNote() {
    const title = newTaskTitle.trim();
    const notes = newTaskNote.trim();
    const dueAt = newTaskDueAt.trim();
    if (!title) {
      throw new Error("Add a task title.");
    }
    if (!notes) {
      throw new Error("Write task notes before adding.");
    }
    if (!dueAt) {
      throw new Error("Due date is required.");
    }

    const payload = await request(`/api/accounts/${accountId}/tasks`, "POST", {
      type: "RESEARCH",
      notes: buildTaskNotes(title, notes),
      dueAt: new Date(`${dueAt}T00:00:00`).toISOString(),
    });

    const created = payload.data as {
      id: string;
      type: string;
      status: string;
      notes: string | null;
      dueAt: string | null;
    };
    const parsed = parseTaskPayload(created.type, created.notes);

    setTasks((prev) => [
      {
        id: created.id,
        type: created.type,
        title: parsed.title,
        status: created.status,
        notes: parsed.body,
        dueAt: created.dueAt,
      },
      ...prev,
    ]);
    setNewTaskTitle("");
    setNewTaskNote("");
    setNewTaskDueAt("");
    router.refresh();
  }

  async function saveTask(taskId: string) {
    const title = editingTaskTitle.trim();
    const dueAt = editingTaskDueAt.trim();
    if (!title) {
      throw new Error("Task title is required.");
    }
    if (!dueAt) {
      throw new Error("Due date is required.");
    }
    await request(`/api/tasks/${taskId}`, "PATCH", {
      notes: buildTaskNotes(title, editingTaskNotes.trim()),
      dueAt: new Date(`${dueAt}T00:00:00`).toISOString(),
    });

    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              title,
              notes: editingTaskNotes.trim() || null,
              dueAt: new Date(`${dueAt}T00:00:00`).toISOString(),
            }
          : task,
      ),
    );
    setEditingTaskId(null);
    setEditingTaskTitle("");
    setEditingTaskNotes("");
    setEditingTaskDueAt("");
    router.refresh();
  }

  async function deleteTask(taskId: string) {
    await request(`/api/tasks/${taskId}`, "DELETE");
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
    router.refresh();
  }

  async function toggleTaskStatus(taskId: string, currentStatus: string) {
    const nextStatus = currentStatus === "DONE" ? "OPEN" : "DONE";
    await request(`/api/tasks/${taskId}`, "PATCH", { status: nextStatus });
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, status: nextStatus } : task)),
    );
    router.refresh();
  }

  async function deleteContact(contactId: string) {
    await request(`/api/contacts/${contactId}`, "DELETE");
    setContacts((prev) => prev.filter((contact) => contact.id !== contactId));
    router.refresh();
  }

  async function createContact() {
    const fullName = newContact.fullName.trim();
    if (!fullName) {
      throw new Error("Contact name is required.");
    }

    const email = newContact.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Enter a valid email address.");
    }

    const website = newContact.linkedinUrl.trim();
    if (website && !/^https?:\/\//i.test(website)) {
      throw new Error("LinkedIn URL must start with http:// or https://");
    }

    const payload = await request(`/api/accounts/${accountId}/contacts`, "POST", {
      fullName,
      title: newContact.title.trim() || null,
      department: newContact.department.trim() || null,
      email: email || null,
      phone: newContact.phone.trim() || null,
      linkedinUrl: website || null,
      source: "manual",
    });

    const created = payload.data as {
      id: string;
      fullName: string | null;
      firstName: string | null;
      lastName: string | null;
      title: string | null;
      department: string | null;
      email: string | null;
      phone: string | null;
      linkedinUrl: string | null;
    };

    setContacts((prev) => [
      {
        id: created.id,
        title: created.fullName || `${created.firstName ?? ""} ${created.lastName ?? ""}`.trim() || "Unnamed contact",
        subtitle: created.title ?? null,
        meta: `${created.email ?? "No email"} | ${created.phone ?? "No phone"}`,
        hasEmail: !!created.email,
        hasPhone: !!created.phone,
        fullName: created.fullName,
        contactTitle: created.title,
        department: created.department,
        email: created.email,
        phone: created.phone,
        linkedinUrl: created.linkedinUrl,
      },
      ...prev,
    ]);
    setNewContact({ fullName: "", title: "", department: "", email: "", phone: "", linkedinUrl: "" });
    setShowAddContact(false);
    router.refresh();
  }

  function startEditContact(contact: EditableContact) {
    setEditingContactId(contact.id);
    setEditContactForm({
      fullName: contact.fullName ?? "",
      title: contact.contactTitle ?? "",
      department: contact.department ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      linkedinUrl: contact.linkedinUrl ?? "",
    });
    setShowAddContact(false);
  }

  async function saveEditContact(contactId: string) {
    const fullName = editContactForm.fullName.trim();
    if (!fullName) {
      throw new Error("Contact name is required.");
    }

    const email = editContactForm.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Enter a valid email address.");
    }

    const linkedinUrl = editContactForm.linkedinUrl.trim();
    if (linkedinUrl && !/^https?:\/\//i.test(linkedinUrl)) {
      throw new Error("LinkedIn URL must start with http:// or https://");
    }

    const payload = await request(`/api/contacts/${contactId}`, "PATCH", {
      fullName,
      title: editContactForm.title.trim() || null,
      department: editContactForm.department.trim() || null,
      email: email || null,
      phone: editContactForm.phone.trim() || null,
      linkedinUrl: linkedinUrl || null,
    });

    const updated = payload.data as {
      id: string;
      fullName: string | null;
      firstName: string | null;
      lastName: string | null;
      title: string | null;
      department: string | null;
      email: string | null;
      phone: string | null;
      linkedinUrl: string | null;
    };

    setContacts((prev) =>
      prev.map((contact) =>
        contact.id === contactId
          ? {
              id: updated.id,
              title:
                updated.fullName ||
                `${updated.firstName ?? ""} ${updated.lastName ?? ""}`.trim() ||
                "Unnamed contact",
              subtitle: updated.title ?? null,
              meta: `${updated.email ?? "No email"} | ${updated.phone ?? "No phone"}`,
              hasEmail: !!updated.email,
              hasPhone: !!updated.phone,
              fullName: updated.fullName,
              contactTitle: updated.title,
              department: updated.department,
              email: updated.email,
              phone: updated.phone,
              linkedinUrl: updated.linkedinUrl,
            }
          : contact,
      ),
    );
    setEditingContactId(null);
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
          title: `Task ${task.status}: ${task.title}`,
          content: task.notes,
          timestamp: task.dueAt
            ? task.dueAt.slice(0, 16).replace("T", " ")
            : new Date().toISOString().slice(0, 16).replace("T", " "),
        })),
      ].sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [activities, tasks],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Overview</h3>
          <button
            type="button"
            onClick={() => {
              if (editingOverview) {
                // Cancel: discard any unsaved edits and revert to last saved values
                setOverviewForm({
                  industry: account.industry ?? "",
                  orgType: account.orgType ?? "",
                  website: account.website ?? "",
                  phone: account.phone ?? "",
                  city: account.city ?? "",
                  state: account.state ?? "",
                  region: account.region ?? "",
                  priorityScore: account.priorityScore?.toString() ?? "",
                });
              }
              setEditingOverview((prev) => !prev);
            }}
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
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Contacts</h3>
          <button
            type="button"
            onClick={() => setShowAddContact((prev) => !prev)}
            className="rounded-md border border-slate-300 px-3 py-1 text-sm"
          >
            {showAddContact ? "Cancel" : "+ Add Contact"}
          </button>
        </div>

        {showAddContact ? (
          <div className="mb-4 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                value={newContact.fullName}
                onChange={(event) => setNewContact((prev) => ({ ...prev, fullName: event.target.value }))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Full name *"
              />
              <input
                value={newContact.title}
                onChange={(event) => setNewContact((prev) => ({ ...prev, title: event.target.value }))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Title (e.g. Director of Operations)"
              />
              <input
                value={newContact.department}
                onChange={(event) => setNewContact((prev) => ({ ...prev, department: event.target.value }))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Department"
              />
              <input
                value={newContact.email}
                onChange={(event) => setNewContact((prev) => ({ ...prev, email: event.target.value }))}
                type="email"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Email"
              />
              <input
                value={newContact.phone}
                onChange={(event) => setNewContact((prev) => ({ ...prev, phone: event.target.value }))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Phone"
              />
              <input
                value={newContact.linkedinUrl}
                onChange={(event) => setNewContact((prev) => ({ ...prev, linkedinUrl: event.target.value }))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="LinkedIn URL"
              />
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(createContact, "Contact added.")}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
            >
              Save Contact
            </button>
          </div>
        ) : null}

        <ul className="space-y-2">
          {contacts.map((contact) => {
            const isEditing = editingContactId === contact.id;
            return (
              <li key={contact.id} className="relative rounded-md border border-slate-200 px-3 py-2">
                {!isEditing ? (
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
                ) : null}

                {isEditing ? (
                  <div className="space-y-2 pr-2">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input
                        value={editContactForm.fullName}
                        onChange={(event) =>
                          setEditContactForm((prev) => ({ ...prev, fullName: event.target.value }))
                        }
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Full name *"
                      />
                      <input
                        value={editContactForm.title}
                        onChange={(event) =>
                          setEditContactForm((prev) => ({ ...prev, title: event.target.value }))
                        }
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Title"
                      />
                      <input
                        value={editContactForm.department}
                        onChange={(event) =>
                          setEditContactForm((prev) => ({ ...prev, department: event.target.value }))
                        }
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Department"
                      />
                      <input
                        value={editContactForm.email}
                        onChange={(event) =>
                          setEditContactForm((prev) => ({ ...prev, email: event.target.value }))
                        }
                        type="email"
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Email"
                      />
                      <input
                        value={editContactForm.phone}
                        onChange={(event) =>
                          setEditContactForm((prev) => ({ ...prev, phone: event.target.value }))
                        }
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Phone"
                      />
                      <input
                        value={editContactForm.linkedinUrl}
                        onChange={(event) =>
                          setEditContactForm((prev) => ({ ...prev, linkedinUrl: event.target.value }))
                        }
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        placeholder="LinkedIn URL"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(() => saveEditContact(contact.id), "Contact updated.")}
                        className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingContactId(null)}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium">{contact.title}</p>
                    {contact.subtitle ? <p className="text-sm text-slate-600">{contact.subtitle}</p> : null}
                    {contact.meta ? <p className="text-xs text-slate-500">{contact.meta}</p> : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEditContact(contact)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                      >
                        Edit
                      </button>
                      <EnrichContactButton
                        contactId={contact.id}
                        hasEmail={!!contact.hasEmail}
                        hasPhone={!!contact.hasPhone}
                      />
                    </div>
                  </>
                )}
              </li>
            );
          })}
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
        <h3 className="mb-3 text-lg font-semibold">Activity Notes</h3>
        <div className="mb-3 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <textarea
            value={newActivityNote}
            onChange={(event) => setNewActivityNote(event.target.value)}
            rows={2}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Add a new activity note..."
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => run(createActivityNote, "Activity note added.")}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
          >
            Add Activity Note
          </button>
        </div>
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
        <h3 className="mb-3 text-lg font-semibold">Task Notes</h3>
        <div className="mb-3 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <input
            value={newTaskTitle}
            onChange={(event) => setNewTaskTitle(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Task title"
          />
          <textarea
            value={newTaskNote}
            onChange={(event) => setNewTaskNote(event.target.value)}
            rows={2}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Add a new task note..."
          />
          <label className="block text-sm text-slate-700">
            Due date
            <input
              type="date"
              value={newTaskDueAt}
              onChange={(event) => setNewTaskDueAt(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(createTaskNote, "Task note added.")}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
          >
            Add Task Note
          </button>
        </div>
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
                <p className="text-sm font-medium">{task.title}</p>
                <StatusBadge value={task.status} />
              </div>
              {editingTaskId === task.id ? (
                <div className="mt-2 space-y-2">
                  <input
                    value={editingTaskTitle}
                    onChange={(event) => setEditingTaskTitle(event.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Task title"
                  />
                  <textarea
                    value={editingTaskNotes}
                    onChange={(event) => setEditingTaskNotes(event.target.value)}
                    rows={2}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Task notes"
                  />
                  <label className="block text-sm text-slate-700">
                    Due date
                    <input
                      type="date"
                      value={editingTaskDueAt}
                      onChange={(event) => setEditingTaskDueAt(event.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      required
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => saveTask(task.id), "Task note updated.")}
                    className="rounded-md bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-60"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <>
                  {task.notes ? <p className="mt-1 text-sm text-slate-600">{task.notes}</p> : null}
                  <p className="mt-1 text-xs text-slate-500">
                    Due: {task.dueAt ? formatDate(task.dueAt) : "-"}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      className={`rounded-md border px-2 py-1 text-xs disabled:opacity-60 ${
                        task.status === "DONE"
                          ? "border-slate-300 text-slate-600"
                          : "border-emerald-300 bg-emerald-50 text-emerald-700"
                      }`}
                      onClick={() =>
                        run(
                          () => toggleTaskStatus(task.id, task.status),
                          task.status === "DONE" ? "Task reopened." : "Task marked complete.",
                        )
                      }
                    >
                      {task.status === "DONE" ? "Reopen" : "Mark Done"}
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                      onClick={() => {
                        setEditingTaskId(task.id);
                        setEditingTaskTitle(task.title);
                        setEditingTaskNotes(task.notes ?? "");
                        setEditingTaskDueAt(task.dueAt ? toInputDate(task.dueAt) : "");
                      }}
                    >
                      Edit
                    </button>
                  </div>
                </>
              )}
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
        <p
          className={`rounded-md border px-3 py-2 text-sm shadow-sm ${
            statusIsError
              ? "border-rose-300 bg-rose-50 text-rose-700"
              : "border-emerald-300 bg-emerald-50 text-emerald-700"
          }`}
        >
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

function toInputDate(value: string) {
  return value.slice(0, 10);
}

function formatDate(value: string) {
  return value.slice(0, 10);
}

function parseTaskPayload(taskType: string, notes: string | null) {
  if (!notes) {
    return { title: taskType, body: null as string | null };
  }

  const [firstLine, ...rest] = notes.split("\n");
  if (firstLine.startsWith("[TITLE] ")) {
    return {
      title: firstLine.replace("[TITLE] ", "").trim() || taskType,
      body: rest.join("\n").trim() || null,
    };
  }

  return {
    title: taskType,
    body: notes,
  };
}

function buildTaskNotes(title: string, body: string) {
  const trimmedBody = body.trim();
  return trimmedBody ? `[TITLE] ${title.trim()}\n${trimmedBody}` : `[TITLE] ${title.trim()}`;
}
