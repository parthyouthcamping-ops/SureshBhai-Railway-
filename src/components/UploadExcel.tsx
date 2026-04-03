import { useRef } from 'react';
import type { FC } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, X, Download } from 'lucide-react';
import type { Booking, BookingStatus } from '../types';

interface UploadExcelProps {
  onDataLoaded: (data: Booking[]) => void;
  onClose: () => void;
}

interface ExcelRow {
  [key: string]: string | number | undefined;
}

export const UploadExcel: FC<UploadExcelProps> = ({ onDataLoaded, onClose }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const templateData = [
      {
        "Sr.No": 1,
        "Name": "Yogita",
        "Email": "yogita@example.com",
        "Mobile No": "9512703134",
        "Total Amount": 15000,
        "Paid Amount": 5000,
        "Remaining Payment": 10000,
        "Room": "Room 101"
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Travelers");
    XLSX.writeFile(wb, "YouthCamping_Financial_Template.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const bstr = event.target?.result;
      const workbook = XLSX.read(bstr, { type: 'binary' });
      
      let finalData: ExcelRow[] = [];
      let foundSheetName = '';

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const rawRows: (string | number)[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(rawRows.length, 30); i++) {
          const row = rawRows[i].map(c => String(c).trim().toUpperCase());
          if (row.some(cell => ['NAME', 'MOBILE', 'REM', 'PEND', 'PAND', 'DUE'].some(h => cell.includes(h)))) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex !== -1) {
          finalData = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex });
          foundSheetName = sheetName;
          if (finalData.length > 0) break;
        }
      }

      const getValue = (row: ExcelRow, keywords: string[]) => {
        const rowKeys = Object.keys(row);
        const normalizedKeywords = keywords.map(k => k.toUpperCase().replace(/\s/g, ''));
        const foundKey = rowKeys.find(key => {
          const cleanKey = String(key).toUpperCase().replace(/\s/g, '');
          return normalizedKeywords.some(kw => cleanKey.includes(kw) || kw.includes(cleanKey));
        });
        return foundKey ? row[foundKey] : '';
      };

      const parseNumber = (val: string | number | undefined) => {
        if (typeof val === 'number') return val;
        if (val === undefined || val === null || val === '') return null;
        const cleaned = String(val).replace(/[^\d.-]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
      };

      const capitalize = (str: string) => {
        if (!str) return '';
        return String(str).split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
      };

      const formattedData: Booking[] = finalData.map((item, index) => {
        const rawName = String(getValue(item, ['NAME', 'CLIENT', 'PASSENGER', 'CUSTOMER']) || '').trim();
        const rawEmail = String(getValue(item, ['EMAIL', 'MAIL', 'ADDRESS']) || '').trim();
        const rawMobile = String(getValue(item, ['MOBILE', 'PHONE', 'CONTACT', 'NUMBER', 'CELL']) || '').replace(/\s/g, '');
        const rawSrNo = parseNumber(getValue(item, ['SR', 'NO', 'NUMBER']));
        
        const rTotal = parseNumber(getValue(item, ['TOTAL', 'COST', 'TRIPAMOUNT', 'NET']));
        const rPaid = parseNumber(getValue(item, ['PAID', 'ADVANCE', 'DEPOSIT', 'COLLECTED']));
        const rRemaining = getValue(item, ['REMAINING', 'REMAING', 'PANDING', 'BALANCE', 'DUE', 'PAYABLE', 'PENDING', 'BAL']);
        
        let remaining = parseNumber(rRemaining);
        const total = rTotal || 0;
        const paid = rPaid || 0;
        
        if (remaining === null) remaining = total - paid;
        
        const colBy = String(getValue(item, ['BY', 'COLLECTOR', 'REP']) || '').trim();
        const room = String(getValue(item, ['ROOM', 'STAY', 'STAYING']) || 'Not Assigned').trim();

        let status: BookingStatus = 'Check Required';
        if (remaining === 0 && total > 0) status = 'Paid';
        if (remaining !== null && remaining > 0) status = (paid > 0) ? 'Partial/Paid' : 'Pending';

        return {
          id: crypto.randomUUID(),
          sr_no: rawSrNo || (index + 1),
          name: capitalize(rawName),
          email: rawEmail,
          phone: rawMobile,
          trip_name: foundSheetName || 'Imported List',
          total_amount: total,
          paid_amount: paid,
          remaining_amount: remaining || 0,
          status: status as BookingStatus,
          collected_by: colBy || 'Imported',
          room: room,
          payment_history: paid > 0 ? [{ amount: paid, date: new Date().toISOString(), collector: colBy || 'Initial' }] : []
        };
      }).filter(b => b.name.length > 1);

      onDataLoaded(formattedData);
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="modal-overlay" role="dialog" aria-labelledby="upload-title">
      <div className="modal-content" style={{ maxWidth: '450px' }}>
        <div className="modal-header">
          <div className="flex-center gap-1">
            <div className="icon-container-lite bg-soft-orange">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h1 id="upload-title" className="text-sm" style={{ margin: 0 }}>Import Travelers</h1>
              <p className="text-xs text-muted">Fuzzy search enabled</p>
            </div>
          </div>
          <button className="btn btn-ghost" onClick={onClose} title="Close" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body mb-2 mt-2">
          <div 
            className="upload-dropzone card bg-soft-green"
            onClick={() => fileInputRef.current?.click()}
            style={{ 
              border: '2px dashed var(--border)',
              padding: '2.5rem 1rem',
              textAlign: 'center',
              cursor: 'pointer'
            }}
          >
            <Upload size={36} className="text-muted" style={{ marginBottom: '0.75rem' }} />
            <h3 className="text-sm">Click to Upload Excel</h3>
            <p className="text-xs text-muted">.xlsx or .xls files only</p>
            <input 
              title="Excel File Input"
              aria-label="Upload Excel File"
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept=".xlsx, .xls" 
              onChange={handleFileUpload} 
            />
          </div>

          <div className="p-1" style={{ border: '1px solid var(--border)', borderRadius: '12px' }}>
            <p className="text-xs text-muted" style={{ marginBottom: '1rem' }}>
              <strong>Standard Format:</strong> Use our template to ensure 100% accurate data matching.
            </p>
            <button className="btn btn-secondary w-full text-sm" onClick={downloadTemplate}>
              <Download size={16} /> Download Template
            </button>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary w-full" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};
