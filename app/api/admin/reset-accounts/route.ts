import { db } from "@/lib/db";
import { NextRequest } from "next/server";

// One-time data reset endpoint.
// Requires confirm=true in the request body to prevent accidental use.
// DELETE this file after use.

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (body?.confirm !== true) {
    return Response.json(
      { error: "Pass { confirm: true } to proceed. This will delete all accounts, contacts, activities, tasks, and lead candidates." },
      { status: 400 },
    );
  }

  // Delete in order to respect foreign key constraints
  const [
    deletedTouches,
    deletedActivities,
    deletedTasks,
    deletedContacts,
    deletedCandidates,
    deletedJobs,
    deletedAccounts,
  ] = await Promise.all([
    db.outreachTouch.deleteMany({}),
    db.activity.deleteMany({}),
    db.task.deleteMany({}),
    db.contact.deleteMany({}),
    db.leadCandidate.deleteMany({}),
    db.leadDiscoveryJob.deleteMany({}),
    db.account.deleteMany({}),
  ]);

  return Response.json({
    message: "All CRM data cleared successfully.",
    deleted: {
      accounts: deletedAccounts.count,
      contacts: deletedContacts.count,
      activities: deletedActivities.count,
      tasks: deletedTasks.count,
      leadCandidates: deletedCandidates.count,
      leadJobs: deletedJobs.count,
      outreachTouches: deletedTouches.count,
    },
  });
}
