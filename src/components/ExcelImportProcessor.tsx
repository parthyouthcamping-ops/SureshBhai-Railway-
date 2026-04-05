import { useState, useRef } from 'react';
import type { FC } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, X, CheckCircle, List, ArrowRight, Table as TableIcon, AlertCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { RawImport, GroupedImport } from '../types';

interface ExcelImportProcessorProps {
  onComplete: () => void;
  onClose: () => void;
}

type ImportStep = 'upload' | 'raw_preview' | 'grouped_preview' | 'processing';

export const ExcelImportProcessor: FC<ExcelImportProcessorProps> = ({ onComplete, onClose }) => {
  const [step, setStep] = useState<ImportStep>('upload');
  const [rawData, setRawData] = useState<RawImport[]>([]);
  const [groupedData, setGroupedData] = useState<GroupedImport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [defaultTripName, setDefaultTripName] = useState('New Batch');
  const [detectedHeaderRow, setDetectedHeaderRow] = useState<number | null>(null);

  const processExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // 1. SMART HEADER DETECTION (First 10 rows)
        const allRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 });
        let headerRowIndex = -1;
        
        const headerKeywords = ['name', 'mobile', 'phone', 'contact', 'age', 'room', 'remark', 'guest'];
        
        for (let i = 0; i < Math.min(allRows.length, 10); i++) {
          const row = allRows[i] as unknown[];
          if (!Array.isArray(row)) continue;
          const rowString = row.join(' ').toLowerCase();
          const matches = headerKeywords.filter(k => rowString.includes(k));
          if (matches.length >= 2) {
            headerRowIndex = i;
            break;
          }
        }

        // Fallback to row 0 if no clear headers found
        const finalHeaderIndex = headerRowIndex === -1 ? 0 : headerRowIndex;
        setDetectedHeaderRow(finalHeaderIndex + 1);

        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { range: finalHeaderIndex });

        if (!jsonData || jsonData.length === 0) {
          throw new Error('No travelers found in Excel.');
        }

        const cleanNumber = (val: unknown): number => {
          if (typeof val === 'number') return val;
          if (!val) return 0;
          const num = parseFloat(String(val).replace(/[₹$,]/g, '').trim());
          return isNaN(num) ? 0 : num;
        };

        const normalizedRows = jsonData.map((row) => {
          const newRow: Record<string, unknown> = {};
          Object.keys(row).forEach(key => {
            newRow[key.toLowerCase().replace(/\s/g, '_').replace('.', '')] = row[key];
          });
          return newRow;
        });

        const formattedRaw: RawImport[] = normalizedRows.map((row) => {
          const name = String(row.name || row.guest_name || row.passenger_name || '').trim();
          const phone = String(row.mobile_no || row.phone || row.contact || row.mobile || '').trim();
          // RULE 3: TRIP HANDLING
          const trip = String(row.trip || row.trip_name || row.package || defaultTripName || 'Trip').trim();
          const age = cleanNumber(row.age);
          const room = String(row.room || '').trim();
          const remark = String(row.remark || '').trim();
          
          return {
            client_name: name,
            trip_name: trip,
            phone: phone,
            age: age,
            room: room,
            remark: remark,
            total_amount: cleanNumber(row.total || row.total_amount || 0),
            paid_amount: cleanNumber(row.paid || row.paid_amount || 0),
            payment_date: new Date().toISOString().split('T')[0]
          };
        }).filter((r) => r.client_name && r.phone); // RULE 5: Name and Phone exist

        if (formattedRaw.length === 0) {
          const sampleKeys = jsonData.length > 0 ? Object.keys(jsonData[0]).join(', ') : 'unknown';
          throw new Error(`No valid travelers found. Detected headers row ${finalHeaderIndex + 1} with columns: [${sampleKeys}]. Ensure Name and Mobile columns exist.`);
        }

        setRawData(formattedRaw);
        
        if (isSupabaseConfigured) {
          const { error: insertError } = await supabase.from('raw_imports').insert(formattedRaw);
          if (insertError) throw insertError;
        }

        generateGroupedData(formattedRaw);
        setStep('raw_preview');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to process Excel file';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const generateGroupedData = (data: RawImport[]) => {
    const groups: Record<string, GroupedImport> = {};

    data.forEach(item => {
      const key = `${item.client_name.toLowerCase()}_${item.trip_name.toLowerCase()}`;
      if (!groups[key]) {
        groups[key] = {
          client_name: item.client_name,
          trip_name: item.trip_name,
          total_amount: item.total_amount,
          paid_total: 0,
          remaining_amount: 0,
          payments: []
        };
      }
      groups[key].paid_total += item.paid_amount;
      groups[key].payments.push({
        amount: item.paid_amount,
        date: item.payment_date
      });
    });

    Object.values(groups).forEach(group => {
      group.remaining_amount = group.total_amount - group.paid_total;
    });

    setGroupedData(Object.values(groups));
  };

  const handleConfirmImport = async () => {
    setLoading(true);
    setStep('processing');
    setError(null);

    try {
      if (!isSupabaseConfigured) {
        onComplete();
        return;
      }

      for (const group of groupedData) {
        const { data: clientData } = await supabase
          .from('clients')
          .select('id')
          .ilike('name', group.client_name)
          .maybeSingle();

        let clientId;
        if (clientData) {
          clientId = clientData.id;
        } else {
          const { data: newClient, error: createClientError } = await supabase
            .from('clients')
            .insert({ name: group.client_name })
            .select('id')
            .single();
          if (createClientError) throw createClientError;
          clientId = newClient.id;
        }

        const { data: tripData } = await supabase
          .from('trips')
          .select('id')
          .ilike('name', group.trip_name)
          .maybeSingle();

        let tripId;
        if (tripData) {
          tripId = tripData.id;
        } else {
          const { data: newTrip, error: createTripError } = await supabase
            .from('trips')
            .insert({ name: group.trip_name })
            .select('id')
            .single();
          if (createTripError) throw createTripError;
          tripId = newTrip.id;
        }

        const { data: bookingData, error: bookingError } = await supabase
          .from('bookings')
          .insert({
            client_id: clientId,
            trip_id: tripId,
            total_amount: group.total_amount,
            status: group.remaining_amount <= 0 ? 'Paid' : 'Partial/Paid'
          })
          .select('id')
          .single();
        if (bookingError) throw bookingError;

        const paymentsToInsert = group.payments.map((p) => ({
          booking_id: bookingData.id,
          amount: p.amount,
          payment_date: p.date,
          collector_name: 'Excel Import'
        }));

        const { error: paymentsError } = await supabase
          .from('payments')
          .insert(paymentsToInsert);
        if (paymentsError) throw paymentsError;
      }

      onComplete();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to complete import';
      setError(msg);
      setStep('grouped_preview');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className={`modal-content ${step !== 'upload' ? 'modal-large' : 'max-w-450'}`}>
        <div className="modal-header">
          <div className="flex-center gap-1">
            <div className="icon-container-lite bg-soft-orange">
              {step === 'upload' && <Upload size={20} />}
              {step === 'raw_preview' && <TableIcon size={20} />}
              {step === 'grouped_preview' && <List size={20} />}
              {step === 'processing' && <CheckCircle size={20} />}
            </div>
            <div>
              <h1 className="text-sm m-0">
                {step === 'upload' && 'Import Excel'}
                {step === 'raw_preview' && 'Step 1: Raw Data Received'}
                {step === 'grouped_preview' && 'Step 2: Logic Applied'}
                {step === 'processing' && 'Step 3: Finalizing'}
              </h1>
              <p className="text-xs text-muted">Syncing to system modules</p>
            </div>
          </div>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Close" title="Close import wizard">
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
                   <h4 className="text-xs m-0">Default Trip (if missing in Excel)</h4>
                </div>
                <input 
                  type="text" 
                  className="input-field text-xs" 
                  value={defaultTripName} 
                  onChange={(e) => setDefaultTripName(e.target.value)}
                  placeholder="e.g. Goa Batch April"
                />
              </div>

              <div 
                className="upload-dropzone card bg-soft-green dashed-border py-25 text-center cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileSpreadsheet size={48} className="text-muted m-auto mb-1" />
                <h3 className="text-sm">Click to Upload Payment File</h3>
                <p className="text-xs text-muted">NAME, MOBILE NO, AGE, ROOM, REMARK</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".xlsx,.xls,.csv" 
                  onChange={processExcel}
                  title="Select Excel file"
                />
                {loading && <div className="mt-1 text-xs text-primary">Parsing rows...</div>}
              </div>
            </div>
          )}

          {step === 'raw_preview' && (
            <div className="animation-fade-in">
              <div className="flex-between mb-1">
                 <div>
                    <div className="text-xs text-bold text-success">Header row detected at: #{detectedHeaderRow}</div>
                    <div className="text-2xs text-muted">Showing preview of first 5 / {rawData.length} travelers</div>
                 </div>
                 <button className="btn btn-primary text-xs" onClick={() => setStep('grouped_preview')}>
                    Next: Process Data <ArrowRight size={14} />
                 </button>
              </div>
              <div className="card no-padding overflow-x-auto max-h-300">
                <table className="text-xs">
                  <thead>
                    <tr>
                      <th>Name & Phone</th>
                      <th>Trip/Package</th>
                      <th>Room/Age</th>
                      <th>Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rawData.slice(0, 5).map((row, i) => (
                      <tr key={i}>
                        <td>
                          <div className="text-bold">{row.client_name}</div>
                          <div className="text-muted text-2xs">{row.phone}</div>
                        </td>
                        <td>{row.trip_name}</td>
                        <td>
                           <div>{row.room || '-'}</div>
                           <div className="text-2xs text-muted">Age: {row.age || '-'}</div>
                        </td>
                        <td className="text-2xs">{row.remark || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 'grouped_preview' && (
            <div className="animation-fade-in">
              <div className="flex-between mb-1">
                 <div className="text-xs text-muted">Ready to Import: <strong>{groupedData.length}</strong> unique records</div>
                 <div className="flex-center gap-1">
                    <button className="btn btn-secondary text-xs" onClick={() => setStep('raw_preview')}>Back</button>
                    <button className="btn btn-primary text-xs" onClick={handleConfirmImport} disabled={loading}>
                       {loading ? 'Processing...' : 'Confirm Import'}
                    </button>
                 </div>
              </div>
              <div className="card no-padding overflow-x-auto max-h-400">
                <table className="text-xs">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th className="text-right">Total</th>
                      <th className="text-right">Paid</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedData.map((group, i) => (
                      <tr key={i}>
                        <td>
                          <div className="text-bold">{group.client_name}</div>
                          <div className="text-muted text-2xs">{group.trip_name}</div>
                        </td>
                        <td className="text-right">₹{group.total_amount.toLocaleString()}</td>
                        <td className="text-right text-success text-bold">₹{group.paid_total.toLocaleString()}</td>
                        <td>
                           <span className={`status-badge text-2xs ${group.remaining_amount <= 0 ? 'status-paid' : 'status-partialpaid'}`}>
                              {group.remaining_amount <= 0 ? 'Fully Paid' : 'Partial'}
                           </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="text-center py-25 animation-pulse">
               <div className="icon-container-lite m-auto bg-soft-green mb-1 w-60 h-60">
                  <CheckCircle size={32} className="text-success" />
               </div>
               <h2 className="text-sm">Writing to DB...</h2>
               <p className="text-xs text-muted">Connecting Clients, Trips, Bookings and Payments.</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary w-full" onClick={onClose} title="Cancel and close">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
