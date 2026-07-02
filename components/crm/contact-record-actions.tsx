"use client";

import { ActivityType, TaskType } from "@prisma/client";
import { ACTIVITY_TYPE_LABELS, TASK_TYPE_LABELS } from "@/lib/activity-labels";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ContactRecordActionsProps = {
  accountId: string;
  contactId: string;
  compact?: boolean;
};

const ACTIVITY_TYPE_OPTIONS: { value: ActivityType; label: string }[] = (
  Object.keys(ACTIVITY_TYPE_LABELS) as ActivityType[]
).map((value) => ({ value, label: ACTIVITY_TYPE_LABELS[value] }));

const TASK_TYPE_OPTIONS: { value: TaskType; label: string }[] = (
  Object.keys(TASK_TYPE_LABELS) as TaskType[]
).map((value) => ({ value, label: TASK_TYPE_LABELS[value] }));

export function ContactRecordActions({
  accountId,
  contactId,
  compact = false,
}: ContactRecordActionsProps) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [showNoteForm, setShowNoteForm] = useState(false);
  const [activityType, setActivityType] = useState<ActivityType>(ActivityType.NOTE);
  const [activityContent, setActivityContent] = useState("");

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskType, setTaskType] = useState<TaskType>(TaskType.EMAIL_FOLLOWUP);
  const [taskNotes, setTaskNotes] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");

  async function post(path: string, body: unknown) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error ?? "Request failed");
    }
  }

  async function deleteContact() {
    const message =
      "Delete this contact permanently?\n\n" +
      "Tasks and activities on the account stay; they will no longer be linked to this person.";
    if (!window.confirm(message)) return;

    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/contacts/${contactId}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string" ? payload.error : "Failed to delete contact.",
        );
      }
      router.push(`/crm/accounts/${accountId}`);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function run(action: () => Promise<void>, success: string) {
    try {
      setBusy(true);
      setStatus(null);
      await action();
      setStatus(success);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function submitActivity() {
    const content = activityContent.trim();
    if (!content) {
      throw new Error("Write the note content before saving.");
    }
    await post(`/api/accounts/${accountId}/activities`, {
      contactId,
      type: activityType,
      content,
    });
    setActivityContent("");
    setShowNoteForm(false);
  }

  async function submitTask() {
    const notes = taskNotes.trim();
    const dueAt = taskDueAt.trim();
    if (!notes) {
      throw new Error("Write task notes before saving.");
    }
    if (!dueAt) {
      throw new Error("Due date is required.");
    }
    const parsed = new Date(`${dueAt}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error("Invalid due date.");
    }

    await post(`/api/accounts/${accountId}/tasks`, {
      contactId,
      type: taskType,
      notes,
      dueAt: parsed.toISOString(),
    });
    setTaskNotes("");
    setTaskDueAt("");
    setShowTaskForm(false);
  }

  return (
    <div className="space-y-3">
      <div className={`flex ${compact ? "flex-col" : "flex-wrap"} gap-2`}>
        <button
          type="button"
          onClick={() => {
            setShowNoteForm((prev) => !prev);
            setShowTaskForm(false);
          }}
          disabled={busy}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
        >
          {showNoteForm ? "Cancel" : "+ Log Note / Call"}
        </button>
        <button
          type="button"
          onClick={() => {
            setShowTaskForm((prev) => !prev);
            setShowNoteForm(false);
          }}
          disabled={busy}
          className="rounded-md bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-60"
        >
          {showTaskForm ? "Cancel" : "+ Create Task"}
        </button>
      </div>

      {showNoteForm ? (
        <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <select
            value={activityType}
            onChange={(event) => setActivityType(event.target.value as ActivityType)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {ACTIVITY_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <textarea
            value={activityContent}
            onChange={(event) => setActivityContent(event.target.value)}
            rows={3}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="What happened? Write your note here..."
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => run(submitActivity, "Note logged.")}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
          >
            Save Note
          </button>
        </div>
      ) : null}

      {showTaskForm ? (
        <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <select
            value={taskType}
            onChange={(event) => setTaskType(event.target.value as TaskType)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {TASK_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <textarea
            value={taskNotes}
            onChange={(event) => setTaskNotes(event.target.value)}
            rows={2}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="What needs to be done?"
          />
          <label className="block text-sm text-slate-700">
            Due date
            <input
              type="date"
              value={taskDueAt}
              onChange={(event) => setTaskDueAt(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(submitTask, "Task created.")}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
          >
            Save Task
          </button>
        </div>
      ) : null}

      <div className="border-t border-slate-200 pt-3">
        <button
          type="button"
          onClick={() => void deleteContact()}
          disabled={busy}
          className={`rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60 ${
            compact ? "w-full" : ""
          }`}
        >
          Delete contact
        </button>
        <p className="mt-1 text-[11px] text-slate-400">
          Removes this person from the CRM. Account tasks and history remain; contact links are cleared.
        </p>
      </div>

      {status ? <p className="text-xs text-slate-600">{status}</p> : null}
    </div>
  );
}
