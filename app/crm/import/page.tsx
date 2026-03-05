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
    </div>
  );
}
