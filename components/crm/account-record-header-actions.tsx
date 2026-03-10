"use client";

import { ActivityType, TaskType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type AccountRecordHeaderActionsProps = {
  accountId: string;
  initialNotes: string;
};

export function AccountRecordHeaderActions({
  accountId,
  initialNotes,
}: AccountRecordHeaderActionsProps) {
  const router = useRouter();
  const [adminToken, setAdminToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function post(path: string, body: unknown) {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-admin-token": adminToken,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error ?? "Request failed");
    }
  }

  async function patch(path: string, body: unknown) {
    const response = await fetch(path, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-admin-token": adminToken,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error ?? "Request failed");
    }
  }

  async function run(action: () => Promise<void>, successMessage: string) {
    try {
      setBusy(true);
      setStatus(null);
      await action();
      setStatus(successMessage);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function editAccount() {
    const nextNotes = window.prompt("Update account notes", initialNotes);
    if (nextNotes === null) return;
    await patch(`/api/accounts/${accountId}`, { notes: nextNotes });
  }

  return (
    <div className="space-y-2">
      <input
        type="password"
        value={adminToken}
        onChange={(event) => setAdminToken(event.target.value)}
        placeholder="Admin token for actions"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => run(editAccount, "Account updated.")}
          disabled={busy}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
          type="button"
        >
          Edit Account
        </button>
        <button
          onClick={() =>
            run(
              () =>
                post(`/api/accounts/${accountId}/contacts`, {
                  fullName: "New Contact",
                  source: "manual",
                }),
              "Contact added.",
            )
          }
          disabled={busy}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
          type="button"
        >
          Add Contact
        </button>
        <button
          onClick={() =>
            run(
              () =>
                post(`/api/accounts/${accountId}/activities`, {
                  type: ActivityType.NOTE,
                  content: "Manual activity from account record actions",
                }),
              "Activity logged.",
            )
          }
          disabled={busy}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
          type="button"
        >
          Log Activity
        </button>
        <button
          onClick={() =>
            run(
              () =>
                post(`/api/accounts/${accountId}/tasks`, {
                  type: TaskType.RESEARCH,
                  notes: "Follow-up task created from account header",
                }),
              "Task created.",
            )
          }
          disabled={busy}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
          type="button"
        >
          Create Task
        </button>
      </div>
      {status ? <p className="text-xs text-slate-600">{status}</p> : null}
    </div>
  );
}
