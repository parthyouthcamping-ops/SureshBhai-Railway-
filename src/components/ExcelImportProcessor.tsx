import { useState, useRef } from 'react';
import type { FC } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, X, CheckCircle, Table as TableIcon, AlertCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface ExcelImportProcessorProps {
  onComplete: () => void;
  onClose: () => void;
}

type ImportStep = 'upload' | 'processing' | 'grouped_preview';

export const ExcelImportProcessor: FC<ExcelImportProcessorProps> = ({ onComplete, onClose }) => {
  const [step, setStep] = useState<ImportStep>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [defaultTripName, setDefaultTripName] = useState('New Batch');
  const [results, setResults] = useState<{ total: number; inserted: number; skipped: number; trip: string } | null>(null);

  const processExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setStep('processing');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const allRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 });
        let headerRowIndex = 0;
        const keywords = ['name', 'mobile', 'phone', 'age', 'room', 'remark'];
        for (let i = 0; i < Math.min(allRows.length, 10); i++) {
          const row = allRows[i] as unknown[];
          if (!Array.isArray(row)) continue;
          const rowStr = row.map(c => String(c || '').toLowerCase()).join(' ');
          if (keywords.filter(k => rowStr.includes(k)).length >= 2) {
            headerRowIndex = i;
            break;
          }
        }

        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { range: headerRowIndex, defval: '' });
        const finalTrip = defaultTripName || 'Default Trip';
        let insertedCount = 0;
        let skippedCount = 0;
        const batchSize = 100;
        const bookingsToInsert: any[] = [];

        for (const row of jsonData) {
          const norm: Record<string, unknown> = {};
          Object.keys(row).forEach(k => norm[k.toUpperCase().replace(/\s/g, '_').replace(/\./g, '')] = row[k]);

          const name = String(norm.NAME || norm.GUEST_NAME || '').trim();
          const phone = String(norm.MOBILE_NO || norm.PHONE || norm.MOBILE || '').trim();
          
          if (!name) { skippedCount++; continue; }

          bookingsToInsert.push({
            name,
            phone,
            age: parseInt(String(norm.AGE)) || null,
            room: String(norm.ROOM || '').trim(),
            remark: String(norm.REMARK || '').trim(),
            trip_name: String(norm.TRIP || norm.TRIP_NAME || finalTrip).trim(),
            total_amount: 0,
            paid_amount: 0,
            remaining_amount: 0,
            status: 'Pending',
            payment_history: []
          });
        }

        if (isSupabaseConfigured) {
          for (let i = 0; i < bookingsToInsert.length; i += batchSize) {
            const batch = bookingsToInsert.slice(i, i + batchSize);
            for (const item of batch) {
              const { data: existing } = await supabase.from('bookings').select('id').eq('phone', item.phone).eq('trip_name', item.trip_name).maybeSingle();
              if (existing) { skippedCount++; continue; }
              const { error: insErr } = await supabase.from('bookings').insert([item]);
              if (!insErr) insertedCount++; else skippedCount++;
            }
          }
        } else {
          insertedCount = bookingsToInsert.length;
        }

        setResults({ total: jsonData.length, inserted: insertedCount, skipped: skippedCount, trip: finalTrip });
        setStep('grouped_preview');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Backend Ingestion Failed');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-450">
        <div className="modal-header">
          <div className="flex-center gap-1">
            <div className="icon-container-lite bg-soft-orange">
              {step === 'upload' && <Upload size={20} />}
              {step === 'processing' && <CheckCircle size={20} />}
              {step === 'grouped_preview' && <CheckCircle size={20} className="text-success" />}
            </div>
            <div>
              <h1 className="text-sm m-0">
                {step === 'upload' && 'Travel CRM Ingestion'}
                {step === 'processing' && 'Ingesting Data...'}
                {step === 'grouped_preview' && 'Ingestion Complete'}
              </h1>
              <p className="text-xs text-muted">Direct Feed Engine</p>
            </div>
          </div>
          <button className="btn btn-ghost" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body mb-2 mt-2">
          {error && (
            <div className="card text-danger bg-soft-orange p-1 mb-1 flex-center gap-1 animation-fade-in">
              <AlertCircle size={16} />
              <span className="text-xs">{error}</span>
            </div>
          )}

          {step === 'upload' && (
            <div className="animation-fade-in">
              <div className="card mb-1 p-1 bg-soft-orange">
                <div className="flex-center gap-1 mb-1">
                   <TableIcon size={16} />
                   <h4 className="text-xs m-0">Assignment Batch</h4>
                </div>
                <input 
                  type="text" 
                  className="input-field text-xs" 
                  value={defaultTripName} 
                  onChange={(e) => setDefaultTripName(e.target.value)}
                  placeholder="Default Trip Name"
                />
              </div>

              <div 
                className="upload-dropzone card bg-soft-green dashed-border py-25 text-center cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileSpreadsheet size={48} className="text-muted m-auto mb-1" />
                <h3 className="text-sm">Click to Upload & Ingest</h3>
                <p className="text-xs text-muted">NAME, MOBILE NO, AGE, ROOM, REMARK</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".xlsx,.xls,.csv" 
                  onChange={processExcel}
                />
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="text-center py-25 animation-pulse">
               <div className="icon-container-lite m-auto bg-soft-green mb-1 w-60 h-60">
                  <Upload size={32} className="text-success" />
               </div>
               <h2 className="text-sm">Processing Batch Ingestion...</h2>
               <p className="text-xs text-muted">Writing directly to travelers database.</p>
            </div>
          )}

          {step === 'grouped_preview' && results && (
            <div className="animation-fade-in">
              <div className="card bg-dark-slate text-white p-1 mb-1 shadow-lg">
                <pre className="text-xs m-0" style={{ fontFamily: 'monospace', color: '#10B981' }}>
{JSON.stringify({
  success: true,
  totalRows: results.total,
  inserted: results.inserted,
  skipped: results.skipped,
  trip: results.trip
}, null, 2)}
                </pre>
              </div>
              <button className="btn btn-primary w-full" onClick={onComplete}>Finish</button>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary w-full" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
