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
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

        if (!jsonData || jsonData.length === 0) {
          throw new Error('Excel sheet is empty or invalid.');
        }

        const cleanNumber = (val: unknown): number => {
          if (typeof val === 'number') return val;
          if (!val) return 0;
          const cleaned = String(val).replace(/[₹$,]/g, '').trim();
          const num = parseFloat(cleaned);
          return isNaN(num) ? 0 : num;
        };

        const normalizedRows = jsonData.map((row) => {
          const newRow: Record<string, unknown> = {};
          Object.keys(row).forEach(key => {
            newRow[key.toLowerCase().replace(/\s/g, '_')] = row[key];
          });
          return newRow;
        });

        const formattedRaw: RawImport[] = normalizedRows.map((row) => ({
          client_name: String(
            row.client_name || row.name || row.client || row.customer || 
            row.passenger_name || row.passenger || row.traveler_name || row.traveler || ''
          ).trim(),
          trip_name: String(
            row.trip_name || row.trip || row.package || row.trip_name || 
            row.destination || row.group || row.event || ''
          ).trim(),
          total_amount: cleanNumber(
            row.total_amount || row.total || row.cost || row.price || 
            row.trip_cost || row.total_price || 0
          ),
          paid_amount: cleanNumber(
            row.paid_amount || row.paid || row.amount || row.collected || 
            row.received || row.payment || 0
          ),
          payment_date: String(
            row.payment_date || row.date || row.payment_date || 
            row.created_at || new Date().toISOString().split('T')[0]
          ),
        })).filter((r: RawImport) => r.client_name && r.trip_name);

        if (formattedRaw.length === 0) {
          const keys = jsonData.length > 0 ? Object.keys(jsonData[0]).join(', ') : 'unknown';
          throw new Error(`No valid travelers found. Found columns: [${keys}]. Please ensure you have "Name" and "Trip" columns.`);
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
            <div 
              className="upload-dropzone card bg-soft-green dashed-border py-25 text-center cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileSpreadsheet size={48} className="text-muted m-auto mb-1" />
              <h3 className="text-sm">Click to Upload Payment File</h3>
              <p className="text-xs text-muted">client_name, trip_name, total_amount, paid_amount</p>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".xlsx,.xls,.csv" 
                onChange={processExcel}
                title="Select Excel file"
              />
              {loading && <div className="mt-1 text-xs text-primary">Parsing data...</div>}
            </div>
          )}

          {step === 'raw_preview' && (
            <div className="animation-fade-in">
              <div className="flex-between mb-1">
                 <div className="text-xs text-muted">Entries stored: <strong>{rawData.length}</strong></div>
                 <button className="btn btn-primary text-xs" onClick={() => setStep('grouped_preview')}>
                    Next: Group Data <ArrowRight size={14} />
                 </button>
              </div>
              <div className="card no-padding overflow-x-auto max-h-300">
                <table className="text-xs">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Trip</th>
                      <th className="text-right">Total</th>
                      <th className="text-right">Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rawData.map((row, i) => (
                      <tr key={i}>
                        <td>{row.client_name}</td>
                        <td>{row.trip_name}</td>
                        <td className="text-right">₹{row.total_amount.toLocaleString()}</td>
                        <td className="text-right text-success">₹{row.paid_amount.toLocaleString()}</td>
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
                 <div className="text-xs text-muted">Unique Bookings: <strong>{groupedData.length}</strong></div>
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
                      <th>Client & Trip</th>
                      <th className="text-right">Total</th>
                      <th className="text-right">Paid</th>
                      <th className="text-right">Balance</th>
                      <th>Payments</th>
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
                        <td className="text-right text-danger">₹{group.remaining_amount.toLocaleString()}</td>
                        <td>
                          <div className="flex-center gap-1 flex-wrap">
                            {group.payments.map((p, j) => (
                              <span key={j} className="status-badge bg-light-gray text-2xs">
                                ₹{p.amount} • {p.date}
                              </span>
                            ))}
                          </div>
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
