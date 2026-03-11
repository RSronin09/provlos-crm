"use client";

import { ActivityType, TaskType } from "@prisma/client";
import { useState } from "react";

type AccountDetailActionsProps = {
  accountId: string;
  initialNotes: string;
};

export function AccountDetailActions({ accountId, initialNotes }: AccountDetailActionsProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function request(path: string, body: unknown) {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.error ?? "Request failed");
    }

    return response.json();
  }

  async function saveNotes() {
    try {
      setIsSaving(true);
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ notes }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Failed to save notes");
      }

      setStatus("Notes saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsSaving(false);
    }
  }

  async function addContact() {
    try {
      await request(`/api/accounts/${accountId}/contacts`, {
        fullName: "New Contact",
        source: "manual",
      });
      setStatus("Contact added.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unknown error");
    }
  }

  async function logActivity() {
    try {
      await request(`/api/accounts/${accountId}/activities`, {
        type: ActivityType.NOTE,
        content: "Manual note from CRM UI",
      });
      setStatus("Activity logged.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unknown error");
    }
  }

  async function createTask() {
    try {
      await request(`/api/accounts/${accountId}/tasks`, {
        type: TaskType.RESEARCH,
        notes: "Research account decision makers",
      });
      setStatus("Task created.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unknown error");
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div>
        <div className="mb-1 text-sm font-medium text-slate-700">Editable Notes</div>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={4}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          onClick={saveNotes}
          disabled={isSaving}
          className="mt-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          type="button"
        >
          {isSaving ? "Saving..." : "Save Notes"}
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button onClick={addContact} type="button" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          Add Contact
        </button>
        <button onClick={logActivity} type="button" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          Log Activity
        </button>
        <button onClick={createTask} type="button" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          Create Task
        </button>
      </div>

      {status ? <p className="text-sm text-slate-700">{status}</p> : null}
    </div>
  );
}
