export default function ImportTargetsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Import Targets</h2>
        <p className="text-sm text-slate-600">
          Upload the vendor map spreadsheet and prepare account seed records.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <label className="block text-sm font-medium text-slate-700">
          Select `.xlsx` file
          <input
            type="file"
            accept=".xlsx"
            className="mt-2 block w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
          />
        </label>

        <button
          type="button"
          disabled
          className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white opacity-60"
        >
          Import (coming soon)
        </button>

        {/* TODO: Parse ProvLOS_vendor_map.xlsx rows into Account records. */}
        {/* TODO: Add dedupe logic (company + website + address), preserve sourceRowJson. */}
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-lg font-semibold">Import Instructions</h3>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
          <li>Upload your vendor map `.xlsx` file.</li>
          <li>Preview parsed rows and validate stage/default mappings.</li>
          <li>Review duplicate detection suggestions before confirming import.</li>
          <li>Imported targets will be created as Accounts at stage `TARGET`.</li>
        </ol>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-lg font-semibold">Preview Table (Placeholder)</h3>
        <div className="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          Parsed rows preview will appear here before import.
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-lg font-semibold">Duplicate Detection (Placeholder)</h3>
        <div className="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          Potential duplicate accounts (company/website/address) will be listed here.
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-lg font-semibold">Import History (Placeholder)</h3>
        <div className="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          Recent import runs and statuses will appear here.
        </div>
      </section>
    </div>
  );
}
