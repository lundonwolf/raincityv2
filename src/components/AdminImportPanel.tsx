import { useMemo, useState, type ChangeEvent } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Database,
  FileSpreadsheet,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';
import type { ScooterService } from '../data/scooterData';
import {
  importAdminBooking,
  saveAdminCustomer,
  saveServiceItem,
} from '../services/firestoreService';
import {
  autoDetectColumnMapping,
  BOOKING_FIELD_DEFS,
  CUSTOMER_FIELD_DEFS,
  mapRowsToBookings,
  mapRowsToCustomers,
  mapRowsToServices,
  parseReplitExportText,
  SERVICE_FIELD_DEFS,
  type ImportEntityType,
} from '../utils/replitImporter';

interface AdminImportPanelProps {
  services: ScooterService[];
  onImportComplete: (entity: ImportEntityType, count: number) => void;
}

const REPLIT_SQL_COMMANDS = [
  {
    id: 'list',
    label: '1. List your PostgreSQL tables in Replit Shell',
    command: 'psql "$DATABASE_URL" -c "\\dt"',
  },
  {
    id: 'csv',
    label: '2. Export a table as CSV (replace TABLE_NAME with e.g. bookings or customers)',
    command:
      'psql "$DATABASE_URL" -c "\\copy (SELECT * FROM TABLE_NAME) TO \'export.csv\' WITH CSV HEADER"',
  },
  {
    id: 'json',
    label: 'Alternative: Export a table as JSON (best for multiline notes or array columns)',
    command:
      'psql "$DATABASE_URL" -t -A -c "SELECT coalesce(json_agg(t), \'[]\'::json) FROM TABLE_NAME t;" > export.json',
  },
] as const;

const ENTITY_OPTIONS: { id: ImportEntityType; label: string; hint: string }[] = [
  {
    id: 'bookings',
    label: 'Bookings',
    hint: 'Preserves original status, mechanic notes, and historical created_at dates for Analytics.',
  },
  {
    id: 'customers',
    label: 'Customers (CRM)',
    hint: 'Imports rider contact details, scooter models, serial numbers, and service history notes.',
  },
  {
    id: 'services',
    label: 'Services & Pricing',
    hint: 'Imports custom repair packages or hourly labor items into your live pricing catalog.',
  },
];

export function AdminImportPanel({ services, onImportComplete }: AdminImportPanelProps) {
  const [entity, setEntity] = useState<ImportEntityType>('bookings');
  const [rawInput, setRawInput] = useState('');
  const [sourceFilename, setSourceFilename] = useState('');
  const [mappingOverrides, setMappingOverrides] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [importSummary, setImportSummary] = useState<{
    succeeded: number;
    failed: { rowNumber: number; message: string }[];
  } | null>(null);

  const parsed = useMemo(() => parseReplitExportText(rawInput), [rawInput]);

  const autoMapping = useMemo(
    () => autoDetectColumnMapping(entity, parsed.headers),
    [entity, parsed.headers],
  );

  const activeMapping = useMemo(
    () => ({ ...autoMapping, ...mappingOverrides }),
    [autoMapping, mappingOverrides],
  );

  const fieldDefs = useMemo(() => {
    if (entity === 'bookings') return BOOKING_FIELD_DEFS;
    if (entity === 'customers') return CUSTOMER_FIELD_DEFS;
    return SERVICE_FIELD_DEFS;
  }, [entity]);

  const mappedBookings = useMemo(
    () =>
      entity === 'bookings' ? mapRowsToBookings(parsed.rows, activeMapping, services) : [],
    [entity, parsed.rows, activeMapping, services],
  );

  const mappedCustomers = useMemo(
    () => (entity === 'customers' ? mapRowsToCustomers(parsed.rows, activeMapping) : []),
    [entity, parsed.rows, activeMapping],
  );

  const mappedServices = useMemo(
    () => (entity === 'services' ? mapRowsToServices(parsed.rows, activeMapping) : []),
    [entity, parsed.rows, activeMapping],
  );

  const activeResults =
    entity === 'bookings'
      ? mappedBookings
      : entity === 'customers'
        ? mappedCustomers
        : mappedServices;

  const validCount = activeResults.filter((r) => r.valid).length;
  const invalidResults = activeResults.filter((r) => !r.valid);

  const handleCopyCommand = async (id: string, cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const handleEntityChange = (nextEntity: ImportEntityType) => {
    setEntity(nextEntity);
    setMappingOverrides({});
    setImportSummary(null);
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    if (lowerName.includes('customer') || lowerName.includes('inquir')) {
      setEntity('customers');
    } else if (lowerName.includes('booking') || lowerName.includes('field_job')) {
      setEntity('bookings');
    } else if (lowerName.includes('service') || lowerName.includes('pricing')) {
      setEntity('services');
    }
    setSourceFilename(file.name);
    setMappingOverrides({});
    setImportSummary(null);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setRawInput(reader.result);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleClear = () => {
    setRawInput('');
    setSourceFilename('');
    setMappingOverrides({});
    setImportSummary(null);
    setProgress({ done: 0, total: 0 });
  };

  const handleRunImport = async () => {
    if (validCount === 0 || importing) return;

    setImporting(true);
    setImportSummary(null);
    setProgress({ done: 0, total: validCount });

    let succeeded = 0;
    const failed: { rowNumber: number; message: string }[] = [];

    if (entity === 'bookings') {
      const validItems = mappedBookings.filter((item) => item.valid && item.data);
      for (let i = 0; i < validItems.length; i += 1) {
        const item = validItems[i];
        try {
          await importAdminBooking(item.data!);
          succeeded += 1;
        } catch (err) {
          failed.push({
            rowNumber: item.rowIndex + 1,
            message: err instanceof Error ? err.message : 'Write rejected by Firestore.',
          });
        }
        setProgress({ done: i + 1, total: validItems.length });
      }
    } else if (entity === 'customers') {
      const validItems = mappedCustomers.filter((item) => item.valid && item.data);
      for (let i = 0; i < validItems.length; i += 1) {
        const item = validItems[i];
        try {
          await saveAdminCustomer(item.data!);
          succeeded += 1;
        } catch (err) {
          failed.push({
            rowNumber: item.rowIndex + 1,
            message: err instanceof Error ? err.message : 'Write rejected by Firestore.',
          });
        }
        setProgress({ done: i + 1, total: validItems.length });
      }
    } else {
      const validItems = mappedServices.filter((item) => item.valid && item.data);
      for (let i = 0; i < validItems.length; i += 1) {
        const item = validItems[i];
        try {
          await saveServiceItem(item.data!);
          succeeded += 1;
        } catch (err) {
          failed.push({
            rowNumber: item.rowIndex + 1,
            message: err instanceof Error ? err.message : 'Write rejected by Firestore.',
          });
        }
        setProgress({ done: i + 1, total: validItems.length });
      }
    }

    setImporting(false);
    setImportSummary({ succeeded, failed });
    if (succeeded > 0) {
      onImportComplete(entity, succeeded);
    }
  };

  return (
    <div className="space-y-6">
      {/* Step 1: Replit PostgreSQL Export Instructions */}
      <div className="rounded-[22px] bg-[#F4F4F0] text-[#121214] p-6 sm:p-7 border border-black/10 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/10 pb-4">
          <div className="space-y-1">
            <div className="font-mono text-xs text-[#52525B] inline-flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-[#E8452C]" aria-hidden="true" />
              STEP 1 · EXPORT FROM REPLIT POSTGRESQL
            </div>
            <h2 className="text-xl font-semibold">Pull your tables out of Replit as CSV or JSON</h2>
          </div>
          <span className="font-mono text-[11px] text-[#52525B]">
            Also works with Replit Database UI → Export CSV
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {REPLIT_SQL_COMMANDS.map((item) => (
            <div
              key={item.id}
              className="rounded-[14px] bg-white border border-black/10 p-4 flex flex-col justify-between gap-3"
            >
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#121214] leading-snug">{item.label}</p>
                <pre className="rounded-[10px] bg-[#121214] text-[#F4F4F0] p-3 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap break-all">
                  {item.command}
                </pre>
              </div>
              <button
                type="button"
                onClick={() => handleCopyCommand(item.id, item.command)}
                className="self-start min-h-[34px] px-3 py-1 rounded-[8px] border border-black/15 hover:bg-black/5 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {copiedId === item.id ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#E8452C]" aria-hidden="true" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    Copy Command
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Step 2: Select Destination & Upload / Paste */}
      <div className="rounded-[22px] bg-[#131316] border border-white/10 p-6 sm:p-7 space-y-5">
        <div className="space-y-1">
          <div className="font-mono text-xs text-[#A1A1AA]">
            STEP 2 · UPLOAD OR PASTE YOUR EXPORT
          </div>
          <h2 className="text-xl font-semibold text-[#F4F4F0]">
            Choose target collection and load CSV or JSON
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {ENTITY_OPTIONS.map((opt) => {
            const isSelected = entity === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleEntityChange(opt.id)}
                className={`rounded-[14px] p-4 border text-left space-y-1.5 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#F4F4F0] text-[#121214] border-[#E8452C]'
                    : 'bg-[#18181C] text-[#F4F4F0] border-white/10 hover:border-white/25'
                }`}
              >
                <div className="text-sm font-semibold">{opt.label}</div>
                <p className={`text-xs leading-relaxed ${isSelected ? 'text-[#3F3F46]' : 'text-[#A1A1AA]'}`}>
                  {opt.hint}
                </p>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            <label className="min-h-[42px] px-4 py-2 rounded-[10px] bg-[#E8452C] hover:bg-[#D53A22] text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer">
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              Upload .csv or .json File
              <input
                type="file"
                accept=".csv,.json,.ndjson,.txt,text/csv,application/json"
                onChange={handleFileUpload}
                className="sr-only"
              />
            </label>
            {sourceFilename && (
              <span className="font-mono text-xs text-[#D4D4D8] inline-flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#E8452C]" aria-hidden="true" />
                {sourceFilename}
              </span>
            )}
          </div>

          {rawInput.trim().length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="min-h-[38px] px-3 py-1.5 rounded-[10px] border border-white/15 hover:bg-white/10 text-xs font-semibold text-[#A1A1AA] hover:text-[#F4F4F0] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              Clear Data
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="replit-raw-export" className="text-xs font-semibold text-[#D4D4D8] block">
            Or paste raw CSV / JSON directly below
          </label>
          <textarea
            id="replit-raw-export"
            rows={6}
            value={rawInput}
            onChange={(e) => {
              setRawInput(e.target.value);
              setImportSummary(null);
            }}
            placeholder={
              entity === 'bookings'
                ? 'id,customer_name,email,phone,scooter_model,address,services,total_price,status,created_at\n1,Alex Rivera,alex@example.com,206-555-0199,Segway Max G2,"1200 Pine St, Seattle",Silver Tune-Up,65,completed,2026-10-12 18:00:00+00'
                : entity === 'customers'
                  ? 'id,name,email,phone,address,scooter_model,serial_number,mechanic_notes'
                  : 'id,title,category,pricing_type,price,duration_minutes,summary'
            }
            className="w-full p-3.5 rounded-[12px] bg-[#0B0B0D] border border-white/12 text-xs font-mono text-[#F4F4F0] placeholder:text-[#52525B]"
          />
        </div>
      </div>

      {/* Step 3: Column Mapping & Live Preview */}
      {parsed.rows.length > 0 && (
        <div className="rounded-[22px] bg-[#F4F4F0] text-[#121214] p-6 sm:p-7 border border-black/10 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/10 pb-4">
            <div className="space-y-1">
              <div className="font-mono text-xs text-[#52525B]">
                STEP 3 · VERIFY COLUMN MAPPING ({parsed.format.toUpperCase()} · {parsed.rows.length}{' '}
                ROW{parsed.rows.length === 1 ? '' : 'S'})
              </div>
              <h2 className="text-xl font-semibold">
                {validCount} ready to import
                {invalidResults.length > 0 ? ` · ${invalidResults.length} skipped` : ''}
              </h2>
            </div>

            <button
              type="button"
              onClick={handleRunImport}
              disabled={importing || validCount === 0}
              className="min-h-[44px] px-5 py-2.5 rounded-[12px] bg-[#E8452C] hover:bg-[#D53A22] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Importing {progress.done} / {progress.total}...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" aria-hidden="true" />
                  Import {validCount} {entity === 'bookings' ? 'Booking' : entity === 'customers' ? 'Customer' : 'Service'}
                  {validCount === 1 ? '' : 's'} to Firestore
                </>
              )}
            </button>
          </div>

          {/* Column Mapping Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {fieldDefs.map((field) => (
              <div key={field.key} className="space-y-1">
                <label
                  htmlFor={`map-${entity}-${field.key}`}
                  className="text-[11px] font-semibold text-[#27272A] block"
                >
                  {field.label}
                  {field.required && <span className="text-[#E8452C]"> *</span>}
                </label>
                <select
                  id={`map-${entity}-${field.key}`}
                  value={activeMapping[field.key] ?? ''}
                  onChange={(e) =>
                    setMappingOverrides((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  className="w-full min-h-[38px] px-2.5 rounded-[10px] bg-white border border-black/15 text-xs font-mono"
                >
                  <option value="">— Not mapped / auto-default —</option>
                  {parsed.headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {invalidResults.length > 0 && (
            <div
              role="alert"
              className="rounded-[12px] bg-[#E8452C]/10 border border-[#E8452C]/35 p-4 text-xs text-[#7F1D1D] space-y-1"
            >
              <div className="font-semibold inline-flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" aria-hidden="true" />
                {invalidResults.length} row{invalidResults.length === 1 ? '' : 's'} missing required
                fields and will be skipped:
              </div>
              <p>
                {invalidResults
                  .slice(0, 5)
                  .map((r) => `Row ${r.rowIndex + 1}: ${r.errors.join(' ')}`)
                  .join(' · ')}
              </p>
            </div>
          )}

          {importSummary && (
            <div
              role="status"
              className="rounded-[14px] bg-[#121214] text-[#F4F4F0] p-4 text-xs space-y-2"
            >
              <div className="font-semibold flex items-center gap-2">
                <Check className="w-4 h-4 text-[#E8452C]" aria-hidden="true" />
                Imported {importSummary.succeeded} record
                {importSummary.succeeded === 1 ? '' : 's'} into Firestore
                {importSummary.failed.length > 0
                  ? ` (${importSummary.failed.length} failed)`
                  : ' with zero errors.'}
              </div>
              {importSummary.failed.length > 0 && (
                <div className="text-[#FCA5A5] font-mono text-[11px] space-y-1">
                  {importSummary.failed.slice(0, 5).map((f) => (
                    <div key={f.rowNumber}>
                      Row {f.rowNumber}: {f.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Preview Table (First 8 Mapped Rows) */}
          <div className="space-y-2">
            <div className="font-mono text-[11px] text-[#52525B]">
              PREVIEWING FIRST {Math.min(8, activeResults.length)} OF {activeResults.length}{' '}
              NORMALIZED RECORDS
            </div>
            <div className="overflow-x-auto rounded-[12px] border border-black/10 bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-black/10 bg-black/[0.03] font-mono text-[10px] text-[#52525B]">
                    <th className="py-2.5 px-3">ROW</th>
                    {entity === 'bookings' && (
                      <>
                        <th className="py-2.5 px-3">REF</th>
                        <th className="py-2.5 px-3">CUSTOMER</th>
                        <th className="py-2.5 px-3">SCOOTER</th>
                        <th className="py-2.5 px-3">SERVICES</th>
                        <th className="py-2.5 px-3">STATUS</th>
                        <th className="py-2.5 px-3">ORIGINAL DATE</th>
                      </>
                    )}
                    {entity === 'customers' && (
                      <>
                        <th className="py-2.5 px-3">NAME</th>
                        <th className="py-2.5 px-3">EMAIL</th>
                        <th className="py-2.5 px-3">PHONE</th>
                        <th className="py-2.5 px-3">SCOOTER</th>
                        <th className="py-2.5 px-3">SERIAL</th>
                      </>
                    )}
                    {entity === 'services' && (
                      <>
                        <th className="py-2.5 px-3">ID</th>
                        <th className="py-2.5 px-3">TITLE</th>
                        <th className="py-2.5 px-3">CATEGORY</th>
                        <th className="py-2.5 px-3">PRICE</th>
                        <th className="py-2.5 px-3">ACTIVE</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/10">
                  {entity === 'bookings' &&
                    mappedBookings.slice(0, 8).map((row) => (
                      <tr key={row.rowIndex} className={row.valid ? '' : 'bg-[#E8452C]/5'}>
                        <td className="py-2.5 px-3 font-mono text-[11px]">#{row.rowIndex + 1}</td>
                        {row.data ? (
                          <>
                            <td className="py-2.5 px-3 font-mono font-semibold">
                              {row.data.referenceId}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold">{row.data.riderName}</div>
                              <div className="text-[11px] text-[#52525B]">
                                {row.data.contactEmail}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">{row.data.scooterModel}</td>
                            <td className="py-2.5 px-3 max-w-[200px] truncate">
                              {row.data.serviceTitles.join(', ')}
                            </td>
                            <td className="py-2.5 px-3 font-mono uppercase text-[11px]">
                              {row.data.status}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] tabular-nums">
                              {row.data.createdAtDate.toISOString().slice(0, 10)}
                            </td>
                          </>
                        ) : (
                          <td colSpan={6} className="py-2.5 px-3 text-[#7F1D1D]">
                            Skipped: {row.errors.join(' ')}
                          </td>
                        )}
                      </tr>
                    ))}

                  {entity === 'customers' &&
                    mappedCustomers.slice(0, 8).map((row) => (
                      <tr key={row.rowIndex} className={row.valid ? '' : 'bg-[#E8452C]/5'}>
                        <td className="py-2.5 px-3 font-mono text-[11px]">#{row.rowIndex + 1}</td>
                        {row.data ? (
                          <>
                            <td className="py-2.5 px-3 font-semibold">{row.data.name}</td>
                            <td className="py-2.5 px-3">{row.data.email}</td>
                            <td className="py-2.5 px-3 font-mono text-[11px]">{row.data.phone}</td>
                            <td className="py-2.5 px-3">{row.data.scooterModel || '—'}</td>
                            <td className="py-2.5 px-3 font-mono text-[11px]">
                              {row.data.serialNumber || '—'}
                            </td>
                          </>
                        ) : (
                          <td colSpan={5} className="py-2.5 px-3 text-[#7F1D1D]">
                            Skipped: {row.errors.join(' ')}
                          </td>
                        )}
                      </tr>
                    ))}

                  {entity === 'services' &&
                    mappedServices.slice(0, 8).map((row) => (
                      <tr key={row.rowIndex} className={row.valid ? '' : 'bg-[#E8452C]/5'}>
                        <td className="py-2.5 px-3 font-mono text-[11px]">#{row.rowIndex + 1}</td>
                        {row.data ? (
                          <>
                            <td className="py-2.5 px-3 font-mono text-[11px]">{row.data.id}</td>
                            <td className="py-2.5 px-3 font-semibold">{row.data.title}</td>
                            <td className="py-2.5 px-3">{row.data.categoryLabel}</td>
                            <td className="py-2.5 px-3 font-mono tabular-nums">
                              ${row.data.price} ({row.data.pricingType})
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px]">
                              {row.data.active ? 'VISIBLE' : 'HIDDEN'}
                            </td>
                          </>
                        ) : (
                          <td colSpan={5} className="py-2.5 px-3 text-[#7F1D1D]">
                            Skipped: {row.errors.join(' ')}
                          </td>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
