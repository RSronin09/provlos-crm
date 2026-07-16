"use client";

import { useAdminToken } from "@/lib/use-admin-token";
import { useCallback, useRef, useState } from "react";
import * as XLSX from "xlsx";

// ---------------------------------------------------------------------------
// Column-name → field mapping
// ---------------------------------------------------------------------------
type MappedField =
  | "companyName"
  | "website"
  | "industry"
  | "city"
  | "state"
  | "region"
  | "phone"
  | "notes"
  | "contactName"
  | "contactFirstName"
  | "contactLastName"
  | "contactTitle"
  | "contactEmail"
  | "contactPhone";

const FIELD_LABELS: Record<MappedField, string> = {
  companyName: "Company Name *",
  website: "Website",
  industry: "Industry",
  city: "City",
  state: "State",
  region: "Region",
  phone: "Phone",
  notes: "Notes",
  contactName: "Contact Full Name",
  contactFirstName: "Contact First Name",
  contactLastName: "Contact Last Name",
  contactTitle: "Contact Title",
  contactEmail: "Contact Email",
  contactPhone: "Contact Phone",
};

const COLUMN_MATCHERS: Record<MappedField, string[]> = {
  companyName: ["company", "company name", "business", "business name", "organization", "account", "account name", "company_name"],
  website: ["website", "url", "web", "domain", "web address", "site", "homepage"],
  industry: ["industry", "sector", "vertical", "market", "type"],
  city: ["city", "town", "municipality"],
  state: ["state", "province", "st"],
  region: ["region", "territory", "area", "zone"],
  phone: ["phone", "tel", "telephone", "phone number", "main phone"],
  notes: ["notes", "comments", "description", "memo", "details"],
  contactName: ["contact", "contact name", "primary contact", "key contact", "name", "full name"],
  contactFirstName: ["first name", "firstname", "first"],
  contactLastName: ["last name", "lastname", "last"],
  contactTitle: ["title", "job title", "position", "role", "contact title"],
  contactEmail: ["email", "email address", "contact email", "e-mail"],
  contactPhone: ["contact phone", "mobile", "cell", "direct", "contact mobile"],
};

function autoDetectMapping(headers: string[]): Partial<Record<MappedField, string>> {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const result: Partial<Record<MappedField, string>> = {};
  const used = new Set<string>();

  for (const [field, candidates] of Object.entries(COLUMN_MATCHERS) as [MappedField, string[]][]) {
    for (const candidate of candidates) {
      const idx = lower.findIndex((h, i) => !used.has(headers[i]) && (h === candidate || h.includes(candidate)));
      if (idx !== -1) {
        result[field] = headers[idx];
        used.add(headers[idx]);
        break;
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ParsedRow = Record<string, string>;

type ImportResult = {
  created: number;
  skipped: number;
  contactsCreated: number;
  enrichedAccounts: number;
  enrichedContacts: number;
  cappedAt: number | null;
  errors: { row: number; error: string }[];
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function SpreadsheetImport() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [adminToken, handleTokenChange] = useAdminToken();
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<MappedField, string>>>({});
  const [autoEnrich, setAutoEnrich] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ---- File parsing -------------------------------------------------------
  const handleFile = useCallback((file: File) => {
    setResult(null);
    setError(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: "binary", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
          defval: "",
          raw: false,
        });

        if (!raw.length) {
          setError("The spreadsheet appears to be empty.");
          return;
        }

        const detectedHeaders = Object.keys(raw[0]);
        const parsedRows = raw.map((r) =>
          Object.fromEntries(
            Object.entries(r).map(([k, v]) => [k, String(v ?? "").trim()]),
          ),
        );

        setHeaders(detectedHeaders);
        setRows(parsedRows);
        setMapping(autoDetectMapping(detectedHeaders));
      } catch {
        setError("Could not parse the file. Please upload a valid .xlsx, .xls, or .csv file.");
      }
    };
    reader.readAsBinaryString(file);
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  // ---- Import -------------------------------------------------------------
  const handleImport = async () => {
    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const mappedRows = rows
        .map((raw, idx) => {
          const companyName = mapping.companyName ? raw[mapping.companyName]?.trim() : "";
          if (!companyName) return null;

          return {
            companyName,
            website: mapping.website ? raw[mapping.website] || null : null,
            industry: mapping.industry ? raw[mapping.industry] || null : null,
            city: mapping.city ? raw[mapping.city] || null : null,
            state: mapping.state ? raw[mapping.state] || null : null,
            region: mapping.region ? raw[mapping.region] || null : null,
            phone: mapping.phone ? raw[mapping.phone] || null : null,
            notes: mapping.notes ? raw[mapping.notes] || null : null,
            contactName: mapping.contactName ? raw[mapping.contactName] || null : null,
            contactFirstName: mapping.contactFirstName ? raw[mapping.contactFirstName] || null : null,
            contactLastName: mapping.contactLastName ? raw[mapping.contactLastName] || null : null,
            contactTitle: mapping.contactTitle ? raw[mapping.contactTitle] || null : null,
            contactEmail: mapping.contactEmail ? raw[mapping.contactEmail] || null : null,
            contactPhone: mapping.contactPhone ? raw[mapping.contactPhone] || null : null,
            sourceRowJson: { _sheet_row: idx + 2, ...raw },
          };
        })
        .filter(Boolean);

      if (!mappedRows.length) {
        setError("No valid rows found. Make sure the 'Company Name' column is mapped.");
        setImporting(false);
        return;
      }

      const res = await fetch("/api/discovery/import-spreadsheet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken,
        },
        body: JSON.stringify({ rows: mappedRows, autoEnrich }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Import failed. Please try again.");
      } else {
        setResult(json.data);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setImporting(false);
    }
  };

  const hasMapping = !!mapping.companyName;
  const previewRows = rows.slice(0, 5);
  const ALL_FIELDS = Object.keys(FIELD_LABELS) as MappedField[];

  return (
    <div className="space-y-6">
      {/* Admin Token */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Admin Token</label>
        <input
          type="password"
          value={adminToken}
          onChange={(e) => handleTokenChange(e.target.value)}
          placeholder="Enter your admin token"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-slate-400 mt-1">Stored locally in your browser.</p>
      </div>

      {/* Upload Zone */}
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center cursor-pointer transition hover:border-blue-400 hover:bg-blue-50"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={onFileChange}
        />
        <svg className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        {fileName ? (
          <p className="text-sm font-medium text-blue-700">{fileName}</p>
        ) : (
          <>
            <p className="text-sm font-medium text-slate-700">
              Drop your spreadsheet here, or click to browse
            </p>
            <p className="text-xs text-slate-500">Supports .xlsx, .xls, .csv — up to 500 rows</p>
          </>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Column Mapping */}
      {headers.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Column Mapping</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              We auto-detected {Object.values(mapping).filter(Boolean).length} of{" "}
              {headers.length} column{headers.length !== 1 ? "s" : ""} across {rows.length}{" "}
              row{rows.length !== 1 ? "s" : ""}. Adjust if needed.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ALL_FIELDS.map((field) => (
              <div key={field} className="flex items-center gap-2">
                <label className="w-40 shrink-0 text-xs text-slate-600">{FIELD_LABELS[field]}</label>
                <select
                  value={mapping[field] ?? ""}
                  onChange={(e) =>
                    setMapping((prev) => ({ ...prev, [field]: e.target.value || undefined }))
                  }
                  className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— not mapped —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      {previewRows.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">
              Preview — first {previewRows.length} of {rows.length} rows
            </h3>
            <span className="text-xs text-slate-500">
              {rows.length} total row{rows.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  {headers.slice(0, 8).map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-600">
                      {h}
                    </th>
                  ))}
                  {headers.length > 8 && (
                    <th className="px-3 py-2 text-left text-slate-400">
                      +{headers.length - 8} more
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    {headers.slice(0, 8).map((h) => (
                      <td key={h} className="max-w-[160px] truncate px-3 py-2 text-slate-700">
                        {row[h] || <span className="text-slate-300">—</span>}
                      </td>
                    ))}
                    {headers.length > 8 && <td className="px-3 py-2 text-slate-300">…</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Options + Import */}
      {rows.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={autoEnrich}
              onChange={(e) => setAutoEnrich(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>
              <span className="text-sm font-medium text-slate-800 group-hover:text-blue-700">
                Auto-enrich leads after import
              </span>
              <span className="block text-xs text-slate-500 mt-0.5">
                Looks up decision-maker contacts for each imported company live via Serper and Hunter.io (up to 20 companies). Takes ~30–60 s for large batches.
              </span>
            </span>
          </label>

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              onClick={handleImport}
              disabled={importing || !hasMapping || !adminToken}
              className="flex-1 sm:flex-none rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing
                ? autoEnrich
                  ? "Importing & enriching…"
                  : "Importing…"
                : `Import ${rows.length} Row${rows.length !== 1 ? "s" : ""}`}
            </button>
            <button
              onClick={() => {
                setFileName(null);
                setHeaders([]);
                setRows([]);
                setMapping({});
                setResult(null);
                setError(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
          {!hasMapping && rows.length > 0 && (
            <p className="text-xs text-amber-600">
              Map the &ldquo;Company Name&rdquo; column above to enable import.
            </p>
          )}
        </div>
      )}

      {/* Result */}
      {result && (() => {
        const nothingImported = result.created === 0 && result.contactsCreated === 0;
        const hasErrors = result.errors.length > 0;
        const isFailure = nothingImported && hasErrors;
        const isPartial = nothingImported && !hasErrors && result.skipped > 0;
        const colors = isFailure
          ? { border: "border-red-200", bg: "bg-red-50", icon: "text-red-600", title: "text-red-800" }
          : isPartial
            ? { border: "border-amber-200", bg: "bg-amber-50", icon: "text-amber-600", title: "text-amber-800" }
            : { border: "border-green-200", bg: "bg-green-50", icon: "text-green-600", title: "text-green-800" };
        const heading = isFailure
          ? "Import Failed"
          : isPartial
            ? "Nothing New to Import"
            : "Import Complete";

        return (
        <div className={`rounded-xl border ${colors.border} ${colors.bg} p-5 space-y-3`}>
          <div className="flex items-center gap-2">
            {isFailure ? (
              <svg className={`h-5 w-5 ${colors.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className={`h-5 w-5 ${colors.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            <h3 className={`text-sm font-semibold ${colors.title}`}>{heading}</h3>
          </div>
          {isPartial && (
            <p className="text-xs text-amber-700">
              All {result.skipped} row{result.skipped !== 1 ? "s" : ""} matched companies already in the CRM. No new accounts were created.
            </p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "Accounts created", value: result.created },
              { label: "Already existed", value: result.skipped },
              { label: "Contacts from sheet", value: result.contactsCreated },
              ...(result.enrichedAccounts > 0
                ? [
                    { label: "Companies enriched", value: result.enrichedAccounts },
                    { label: "Decision makers found", value: result.enrichedContacts },
                  ]
                : []),
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-white border border-green-100 p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {result.cappedAt && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Enrichment was limited to the first {result.cappedAt} companies. Open each account and use the &ldquo;Enrich&rdquo; button to look up decision makers for the rest.
            </p>
          )}

          {result.enrichedAccounts === 0 && autoEnrich && (
            <p className="text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-2">
              No decision makers were found during enrichment. This usually means the SERPER_API_KEY or HUNTER_API_KEY environment variables are not set on the server. You can still add contacts manually from each account page.
            </p>
          )}

          {result.errors.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">
                {result.errors.length} row{result.errors.length !== 1 ? "s" : ""} had errors:
              </p>
              <ul className="space-y-0.5">
                {result.errors.slice(0, 5).map((e) => (
                  <li key={e.row} className="text-xs text-amber-600">
                    Row {e.row}: {e.error}
                  </li>
                ))}
                {result.errors.length > 5 && (
                  <li className="text-xs text-amber-500">
                    …and {result.errors.length - 5} more
                  </li>
                )}
              </ul>
            </div>
          )}

          {!isFailure && (
            <p className="text-xs text-green-700">
              Go to{" "}
              <a href="/crm/relationships/customers" className="underline hover:text-green-900">
                Customers
              </a>{" "}
              or{" "}
              <a href="/crm/pipeline" className="underline hover:text-green-900">
                Pipeline
              </a>{" "}
              to see your imported leads. Each account has an{" "}
              <strong>Enrich</strong> button to fetch decision makers on demand.
            </p>
          )}
        </div>
        );
      })()}
    </div>
  );
}
