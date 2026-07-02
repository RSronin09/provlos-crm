import { ActivityType, TaskType } from "@prisma/client";

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  CALL_ATTEMPT: "Call Attempt",
  CALL_CONNECTED: "Call Connected",
  EMAIL_SENT: "Email Sent",
  EMAIL_REPLY: "Email Reply",
  MEETING: "Meeting",
  NOTE: "Note",
};

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  CALL: "Call",
  EMAIL_FOLLOWUP: "Email Follow-up",
  VERIFY_CONTACT: "Verify Contact",
  RESEARCH: "Research",
};

export function getActivityTypeLabel(type: string): string {
  return ACTIVITY_TYPE_LABELS[type as ActivityType] ?? type;
}

export function getTaskTypeLabel(type: string): string {
  return TASK_TYPE_LABELS[type as TaskType] ?? type;
}
