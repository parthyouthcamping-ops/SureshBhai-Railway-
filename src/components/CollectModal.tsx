import { useState } from 'react';
import type { FC } from 'react';
import type { Booking } from '../types';
import { X, CheckCircle } from 'lucide-react';

interface CollectModalProps {
  booking: Booking;
  onClose: () => void;
  onConfirm: (collectorName: string, amount: number) => void;
}

export const CollectModal: FC<CollectModalProps> = ({ booking, onClose, onConfirm }) => {
  const [collectorName, setCollectorName] = useState('Ground Staff');
  const [collectAmount, setCollectAmount] = useState(booking.remaining_amount || 0);

  const handleConfirm = () => {
    const amt = parseFloat(String(collectAmount));
    if (isNaN(amt) || amt <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    onConfirm(collectorName.trim() || 'Ground Staff', amt);
  };

  return (
    <div className="modal-overlay" role="dialog" aria-labelledby="collect-title">
      <div className="modal-content">
        <div className="modal-header">
          <h2 id="collect-title" style={{ fontSize: '1.2rem', margin: 0 }}>Cash Collection</h2>
          <button className="btn btn-ghost" title="Close" aria-label="Close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="card bg-soft-green p-1" style={{ textAlign: 'center' }}>
          <div className="text-xs text-muted">Processing for</div>
          <div className="text-bold" style={{ fontSize: '1.1rem' }}>{booking.name}</div>
          <div className="text-xs text-muted">Room: {booking.room || 'N/A'}</div>
        </div>

        <div className="form-group mt-2">
          <label className="form-label" htmlFor="collect-amount">Payment Amount (INR)</label>
          <div className="flex-center" style={{ position: 'relative' }}>
             <span className="text-muted" style={{ position: 'absolute', left: '12px' }}>₹</span>
             <input 
               id="collect-amount"
               type="number" 
               className="input-field"
               style={{ paddingLeft: '28px', fontSize: '1.25rem', fontWeight: 800, color: '#10B981' }}
               value={collectAmount} 
               onChange={(e) => setCollectAmount(Number(e.target.value))} 
               placeholder="0.00" 
             />
          </div>
          <p className="text-muted text-xs" style={{ marginTop: '0.5rem', textAlign: 'right' }}>
             Max: ₹{booking.remaining_amount.toLocaleString()}
          </p>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="collector-name">Collector Name</label>
          <input 
            id="collector-name"
            type="text" 
            className="input-field"
            value={collectorName} 
            onChange={(e) => setCollectorName(e.target.value)} 
            placeholder="Your Name (e.g. Rahul)" 
          />
        </div>

        <div className="modal-footer mt-2">
          <button className="btn btn-secondary w-full" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button 
            className="btn btn-primary w-full" 
            style={{ flex: 2 }}
            onClick={handleConfirm}
            title="Confirm Cash Collection"
          >
            <CheckCircle size={18} />
            Confirm Payment
          </button>
        </div>
      </div>
    </div>
  );
};
