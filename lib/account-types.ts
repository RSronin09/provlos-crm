/**
 * Shared configuration for the AccountType discriminator.
 *
 * Architecture note: all relationship types (Customer, Vendor, Bank, Supplier,
 * Partner, Other) share the same Account model. This keeps Contacts, Activities,
 * Tasks, and OutreachSequences unified across all relationship types without
 * duplicating infrastructure.
 *
 * Stage values are reused across types with contextual display labels so the
 * pipeline enum never needs to change as new types are added.
 */

export const ACCOUNT_TYPE_VALUES = [
  "CUSTOMER",
  "VENDOR",
  "BANK",
  "SUPPLIER",
  "PARTNER",
  "OTHER",
] as const;

export type AccountType = (typeof ACCOUNT_TYPE_VALUES)[number];

export type AccountStageValue =
  | "TARGET"
  | "ENRICHING"
  | "ENRICHED"
  | "CONTACTED"
  | "ENGAGED"
  | "QUALIFIED"
  | "PROPOSAL"
  | "WON"
  | "LOST";

// ─── Type metadata ────────────────────────────────────────────────────────────

export type AccountTypeConfig = {
  label: string;
  pluralLabel: string;
  description: string;
  color: string;
  badgeClass: string;
  /** Fields visible in the type-specific detail section */
  detailFields: Array<{
    key: string;
    label: string;
    type: "text" | "number" | "date" | "url";
  }>;
  /** Stage labels specific to this type */
  stageLabels: Record<AccountStageValue, string>;
  /** Hint shown when the stage is WON (i.e., the relationship is active) */
  activeLabel: string;
  /** Hint shown when the stage is LOST (i.e., the relationship ended) */
  inactiveLabel: string;
};

export const ACCOUNT_TYPE_CONFIG: Record<AccountType, AccountTypeConfig> = {
  CUSTOMER: {
    label: "Customer",
    pluralLabel: "Customers",
    description: "Companies that hire you for courier and delivery services.",
    color: "blue",
    badgeClass: "bg-blue-100 text-blue-700 border-blue-200",
    detailFields: [
      { key: "whatTheyMove", label: "What They Move", type: "text" },
      { key: "whyHireCouriers", label: "Why Hire Couriers", type: "text" },
    ],
    stageLabels: {
      TARGET: "Target",
      ENRICHING: "Enriching",
      ENRICHED: "Enriched",
      CONTACTED: "Contacted",
      ENGAGED: "Engaged",
      QUALIFIED: "Qualified",
      PROPOSAL: "Proposal Sent",
      WON: "Won",
      LOST: "Lost",
    },
    activeLabel: "Won",
    inactiveLabel: "Lost",
  },

  VENDOR: {
    label: "Vendor",
    pluralLabel: "Vendors",
    description: "Service providers and companies you purchase from (fuel, maintenance, insurance, etc.).",
    color: "amber",
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
    detailFields: [
      { key: "paymentTerms", label: "Payment Terms", type: "text" },
      { key: "taxId", label: "Tax ID / EIN", type: "text" },
      { key: "accountNumber", label: "Vendor Account #", type: "text" },
      { key: "contractStart", label: "Contract Start", type: "date" },
      { key: "contractEnd", label: "Contract End", type: "date" },
    ],
    stageLabels: {
      TARGET: "Prospective",
      ENRICHING: "Evaluating",
      ENRICHED: "Evaluated",
      CONTACTED: "Contacted",
      ENGAGED: "Negotiating",
      QUALIFIED: "Under Review",
      PROPOSAL: "Contract Sent",
      WON: "Active",
      LOST: "Inactive",
    },
    activeLabel: "Active",
    inactiveLabel: "Inactive",
  },

  BANK: {
    label: "Bank / Lender",
    pluralLabel: "Banks & Lenders",
    description: "Financial institutions, lenders, and credit providers.",
    color: "emerald",
    badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200",
    detailFields: [
      { key: "accountNumber", label: "Account Number", type: "text" },
      { key: "taxId", label: "Routing / Tax ID", type: "text" },
      { key: "creditLimit", label: "Credit Limit ($)", type: "number" },
      { key: "paymentTerms", label: "Loan / Line Terms", type: "text" },
      { key: "contractStart", label: "Account Opened", type: "date" },
      { key: "contractEnd", label: "Account Closed / Maturity", type: "date" },
    ],
    stageLabels: {
      TARGET: "Identified",
      ENRICHING: "Researching",
      ENRICHED: "Researched",
      CONTACTED: "Applied",
      ENGAGED: "Processing",
      QUALIFIED: "Approved",
      PROPOSAL: "Agreement Sent",
      WON: "Active",
      LOST: "Closed",
    },
    activeLabel: "Active",
    inactiveLabel: "Closed",
  },

  SUPPLIER: {
    label: "Supplier",
    pluralLabel: "Suppliers",
    description: "Companies that supply materials, equipment, or inventory.",
    color: "purple",
    badgeClass: "bg-purple-100 text-purple-700 border-purple-200",
    detailFields: [
      { key: "paymentTerms", label: "Payment Terms", type: "text" },
      { key: "taxId", label: "Tax ID / EIN", type: "text" },
      { key: "accountNumber", label: "Supplier Account #", type: "text" },
      { key: "contractStart", label: "Relationship Start", type: "date" },
      { key: "contractEnd", label: "Relationship End", type: "date" },
    ],
    stageLabels: {
      TARGET: "Prospective",
      ENRICHING: "Evaluating",
      ENRICHED: "Evaluated",
      CONTACTED: "Contacted",
      ENGAGED: "Negotiating",
      QUALIFIED: "Approved",
      PROPOSAL: "Onboarding",
      WON: "Active",
      LOST: "Inactive",
    },
    activeLabel: "Active",
    inactiveLabel: "Inactive",
  },

  PARTNER: {
    label: "Partner",
    pluralLabel: "Partners",
    description: "Strategic partners, referral networks, and alliances.",
    color: "indigo",
    badgeClass: "bg-indigo-100 text-indigo-700 border-indigo-200",
    detailFields: [
      { key: "paymentTerms", label: "Revenue Share / Terms", type: "text" },
      { key: "contractStart", label: "Partnership Start", type: "date" },
      { key: "contractEnd", label: "Partnership End", type: "date" },
      { key: "taxId", label: "Tax ID / EIN", type: "text" },
    ],
    stageLabels: {
      TARGET: "Identified",
      ENRICHING: "Assessing",
      ENRICHED: "Assessed",
      CONTACTED: "Outreach",
      ENGAGED: "Engaged",
      QUALIFIED: "Aligned",
      PROPOSAL: "Agreement Sent",
      WON: "Active Partner",
      LOST: "Ended",
    },
    activeLabel: "Active Partner",
    inactiveLabel: "Ended",
  },

  OTHER: {
    label: "Other",
    pluralLabel: "Other",
    description: "Any other relationship that doesn't fit the above categories.",
    color: "slate",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    detailFields: [
      { key: "paymentTerms", label: "Terms", type: "text" },
      { key: "taxId", label: "Tax ID", type: "text" },
      { key: "accountNumber", label: "Account #", type: "text" },
      { key: "contractStart", label: "Start Date", type: "date" },
      { key: "contractEnd", label: "End Date", type: "date" },
    ],
    stageLabels: {
      TARGET: "Target",
      ENRICHING: "Enriching",
      ENRICHED: "Enriched",
      CONTACTED: "Contacted",
      ENGAGED: "Engaged",
      QUALIFIED: "Qualified",
      PROPOSAL: "Proposal Sent",
      WON: "Active",
      LOST: "Inactive",
    },
    activeLabel: "Active",
    inactiveLabel: "Inactive",
  },
};

export function getTypeConfig(accountType: string | null | undefined): AccountTypeConfig {
  return ACCOUNT_TYPE_CONFIG[(accountType as AccountType) ?? "CUSTOMER"] ?? ACCOUNT_TYPE_CONFIG.CUSTOMER;
}

export function getStageLabelForType(
  stage: string,
  accountType: string | null | undefined,
): string {
  const config = getTypeConfig(accountType);
  return config.stageLabels[stage as AccountStageValue] ?? stage;
}

/** All types that should show the sales pipeline (only CUSTOMER by default) */
export const PIPELINE_TYPES: AccountType[] = ["CUSTOMER"];
