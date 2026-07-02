import {
  AccountStage,
  AccountType,
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
  accountType: z.nativeEnum(AccountType).optional(),
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
  // Relationship-type-specific fields
  paymentTerms: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  creditLimit: z.number().optional().nullable(),
  contractStart: z.coerce.date().optional().nullable(),
  contractEnd: z.coerce.date().optional().nullable(),
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
  industry: z.string().optional().nullable(),
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

export const driverLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().optional().nullable(),
});

export const deliveryStopOrderSchema = z.object({
  stopOrder: z.number().int().positive().nullable(),
});

export const resequenceDriverSchema = z.object({
  driverId: z.string().uuid(),
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
      linkedinUrl: z.string().url().optional().nullable(),
      confidenceScore: z.number().optional().nullable(),
      source: z.string().optional().nullable(),
    }),
  ),
});

export const instantlyLocationSchema = z.union([
  z.object({ place_id: z.string(), label: z.string().optional() }),
  z.object({
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
  }),
]);

const employeeCountBracketSchema = z.enum([
  "0 - 25",
  "25 - 100",
  "100 - 250",
  "250 - 1000",
  "1K - 10K",
  "10K - 50K",
  "50K - 100K",
  "> 100K",
]);

const employeeCountRangeSchema = z.object({
  op: z.enum(["gte", "lte", "between"]),
  min: z.number().optional(),
  max: z.number().optional(),
});

export const instantlySearchFiltersSchema = z.object({
  locations: z.array(instantlyLocationSchema).optional(),
  location_mode: z.enum(["contact", "company"]).optional(),
  industry: z.object({ include: z.array(z.string()).optional(), exclude: z.array(z.string()).optional() }).optional(),
  subIndustry: z.object({ include: z.array(z.string()).optional(), exclude: z.array(z.string()).optional() }).optional(),
  title: z.object({ include: z.array(z.string()).optional(), exclude: z.array(z.string()).optional() }).optional(),
  department: z.array(z.string()).optional(),
  level: z.array(z.string()).optional(),
  employeeCount: z.array(z.union([employeeCountBracketSchema, employeeCountRangeSchema])).optional(),
  company_name: z.object({ include: z.array(z.string()).optional(), exclude: z.array(z.string()).optional() }).optional(),
  keyword_filter: z.object({ include: z.string().optional(), exclude: z.string().optional() }).optional(),
  look_alike: z.string().optional(),
  skip_owned_leads: z.boolean().optional(),
  show_one_lead_per_company: z.boolean().optional(),
});

const instantlyCustomLocationSchema = z.object({
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
});

export const instantlyCountSchema = z.object({
  counties: z.array(z.string()).optional(),
  customLocations: z.array(instantlyCustomLocationSchema).optional(),
  // Single literal phrase — Instantly's keyword_filter does NOT parse "OR"/"AND".
  keyword: z.string().optional().nullable(),
  titles: z.array(z.string()).optional(),
  employeeCount: z.array(z.string()).optional(),
  locationMode: z.enum(["contact", "company"]).optional(),
  useSubIndustry: z.boolean().optional(),
  filters: instantlySearchFiltersSchema.optional(),
});

export const instantlySearchSchema = instantlyCountSchema.extend({
  limit: z.number().int().positive().max(1000).default(50),
  listName: z.string().optional(),
  resourceId: z.string().uuid().optional(),
});

export const instantlyImportSchema = z.object({
  listId: z.string().min(1),
  limit: z.number().int().positive().max(500).optional(),
});

const spreadsheetRowSchema = z.object({
  companyName: z.string().min(1),
  website: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  contactName: z.string().optional().nullable(),
  contactFirstName: z.string().optional().nullable(),
  contactLastName: z.string().optional().nullable(),
  contactTitle: z.string().optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  sourceRowJson: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const spreadsheetImportSchema = z.object({
  rows: z.array(spreadsheetRowSchema).min(1).max(500),
  autoEnrich: z.boolean().optional(),
});

export type SpreadsheetRow = z.infer<typeof spreadsheetRowSchema>;
