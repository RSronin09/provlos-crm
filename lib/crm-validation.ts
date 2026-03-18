import {
  AccountStage,
  ActivityType,
  DeliveryPriority,
  DeliveryStatus,
  IssueType,
  IssueStatus,
  LeadCandidateStatus,
  TaskStatus,
  TaskType,
  Prisma,
} from "@prisma/client";
import { z } from "zod";

export const accountCreateSchema = z.object({
  companyName: z.string().min(1),
  industry: z.string().optional().nullable(),
  orgType: z.string().optional().nullable(),
  whatTheyMove: z.string().optional().nullable(),
  whyHireCouriers: z.string().optional().nullable(),
  website: z.string().url().optional().nullable(),
  phone: z.string().optional().nullable(),
  address1: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zip: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  stage: z.nativeEnum(AccountStage).optional(),
  priorityScore: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  sourceRowJson: z.custom<Prisma.InputJsonValue>().optional().nullable(),
});

export const accountUpdateSchema = accountCreateSchema.partial();

export const contactCreateSchema = z.object({
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  fullName: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  linkedinUrl: z.string().url().optional().nullable(),
  confidenceScore: z.number().optional().nullable(),
  source: z.string().optional().nullable(),
  lastVerifiedAt: z.coerce.date().optional().nullable(),
  isDoNotContact: z.boolean().optional(),
});

export const contactUpdateSchema = contactCreateSchema.partial();

export const activityCreateSchema = z.object({
  contactId: z.string().uuid().optional().nullable(),
  type: z.nativeEnum(ActivityType),
  outcome: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
  occurredAt: z.coerce.date().optional(),
});

export const activityUpdateSchema = z.object({
  outcome: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
  occurredAt: z.coerce.date().optional(),
});

export const taskCreateSchema = z.object({
  contactId: z.string().uuid().optional().nullable(),
  type: z.nativeEnum(TaskType),
  status: z.nativeEnum(TaskStatus).optional(),
  dueAt: z.coerce.date(),
  notes: z.string().optional().nullable(),
});

export const taskUpdateSchema = taskCreateSchema.partial();

export const discoveryEnqueueSchema = z.object({
  query: z.string().min(2),
  region: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
});

export const discoveryCandidateFilterSchema = z.object({
  status: z.nativeEnum(LeadCandidateStatus).optional(),
  search: z.string().optional(),
  state: z.string().optional(),
  region: z.string().optional(),
});

export const decisionMakerSearchSchema = z.object({
  companyName: z.string().min(2),
  website: z.string().url().optional().nullable(),
  state: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  refresh: z.boolean().optional(),
  persistToCrm: z.boolean().optional(),
});

export const driverCreateSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  vehicleName: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const driverUpdateSchema = driverCreateSchema.partial();

export const deliveryCreateSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  pickupDateTime: z.coerce.date().optional().nullable(),
  requestedDeliveryDateTime: z.coerce.date(),
  pickupAddress: z.string().min(1),
  deliveryAddress: z.string().min(1),
  pickupContactName: z.string().optional().nullable(),
  pickupContactPhone: z.string().optional().nullable(),
  deliveryContactName: z.string().optional().nullable(),
  deliveryContactPhone: z.string().optional().nullable(),
  packageNotes: z.string().optional().nullable(),
  priorityLevel: z.nativeEnum(DeliveryPriority).optional(),
  assignedDriverId: z.string().uuid().optional().nullable(),
  createdBy: z.string().min(1),
});

export const deliveryUpdateSchema = deliveryCreateSchema.omit({ createdBy: true }).partial();

export const deliveryStatusUpdateSchema = z.object({
  status: z.nativeEnum(DeliveryStatus),
  changedBy: z.string().min(1),
  note: z.string().optional().nullable(),
});

export const deliveryAssignSchema = z.object({
  driverId: z.string().uuid().nullable(),
  changedBy: z.string().min(1),
});

export const deliveryNotesSchema = z.object({
  dispatcherNotes: z.string(),
});

export const deliveryIssueCreateSchema = z.object({
  reportedBy: z.string().min(1),
  issueType: z.nativeEnum(IssueType),
  note: z.string().optional().nullable(),
});

export const deliveryIssueResolveSchema = z.object({
  resolvedBy: z.string().min(1),
  resolveNote: z.string().optional().nullable(),
  status: z.nativeEnum(IssueStatus).optional(),
});

export const addDiscoveredLeadSchema = z.object({
  companyName: z.string().min(2),
  website: z.string().url().optional().nullable(),
  state: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  contacts: z.array(
    z.object({
      fullName: z.string().min(1),
      firstName: z.string().optional().nullable(),
      lastName: z.string().optional().nullable(),
      title: z.string().optional().nullable(),
      department: z.string().optional().nullable(),
      email: z.string().email().optional().nullable(),
      phone: z.string().optional().nullable(),
      confidenceScore: z.number().optional().nullable(),
      source: z.string().optional().nullable(),
    }),
  ),
});
