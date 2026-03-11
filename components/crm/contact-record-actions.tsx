"use client";

import { ActivityType, TaskType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ContactRecordActionsProps = {
  accountId: string;
  contactId: string;
  compact?: boolean;
};

export function ContactRecordActions({
  accountId,
  contactId,
  compact = false,
}: ContactRecordActionsProps) {
  const router = useRouter();
  const [adminToken, setAdminToken] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="space-y-2">
      <input
        type="password"
        value={adminToken}
        onChange={(event) => setAdminToken(event.target.value)}
        placeholder="Admin token"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      <div className={`flex ${compact ? "flex-col" : "flex-wrap"} gap-2`}>
        <button
          type="button"
          onClick={() =>
            run(
              () =>
                post(`/api/accounts/${accountId}/activities`, {
                  contactId,
                  type: ActivityType.CALL_ATTEMPT,
                  outcome: "Call attempt logged from contact record",
                }),
              "Call activity logged.",
            )
          }
          disabled={busy}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
        >
          Log Call
        </button>
        <button
          type="button"
          onClick={() =>
            run(
              () =>
                post(`/api/accounts/${accountId}/activities`, {
                  contactId,
                  type: ActivityType.NOTE,
                  content: "Manual note logged from contact record",
                }),
              "Note activity logged.",
            )
          }
          disabled={busy}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
        >
          Log Note
        </button>
        <button
          type="button"
          onClick={() =>
            run(
              async () => {
                const dueDate = window.prompt("Enter due date (YYYY-MM-DD)");
                if (dueDate === null) return;
                const trimmed = dueDate.trim();
                if (!trimmed) {
                  throw new Error("Due date is required.");
                }
                const parsed = new Date(`${trimmed}T00:00:00`);
                if (Number.isNaN(parsed.getTime())) {
                  throw new Error("Invalid due date. Use YYYY-MM-DD.");
                }

                await post(`/api/accounts/${accountId}/tasks`, {
                  contactId,
                  type: TaskType.EMAIL_FOLLOWUP,
                  notes: "Follow up with this contact",
                  dueAt: parsed.toISOString(),
                });
              },
              "Task created.",
            )
          }
          disabled={busy}
          className="rounded-md bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-60"
        >
          Create Task
        </button>
      </div>
      {status ? <p className="text-xs text-slate-600">{status}</p> : null}
    </div>
  );
}
