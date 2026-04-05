import { useState } from 'react';
import type { FC } from 'react';
import type { Booking } from '../types';
import { X, CheckCircle } from 'lucide-react';

interface CollectModalProps {
  booking: Booking;
  onClose: () => void;
  onConfirm: (collectorName: string, amount: number, paymentMethod: 'Cash' | 'Online') => void;
}

export const CollectModal: FC<CollectModalProps> = ({ booking, onClose, onConfirm }) => {
  const [collectorName, setCollectorName] = useState('Ground Staff');
  const [collectAmount, setCollectAmount] = useState(booking.remaining_amount || 0);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Online'>('Cash');

  const handleConfirm = () => {
    const amt = parseFloat(String(collectAmount));
    if (isNaN(amt) || amt <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    onConfirm(collectorName.trim() || 'Ground Staff', amt, paymentMethod);
  };

  return (
    <div className="modal-overlay animate-fade-in" role="dialog" aria-labelledby="collect-title">
      <div className="modal-content shadow-lg">
        <div className="modal-header">
           <div className="flex-center gap-1">
             <div className="icon-bg icon-bg-small">
                <Wallet size={18} />
             </div>
             <h2 id="collect-title" className="text-lg font-bold m-0 text-primary">Payment Collection</h2>
           </div>
           <button className="btn btn-ghost btn-icon-small" title="Close" aria-label="Close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="card bg-soft-green p-1 text-center mb-1">
          <div className="text-xs text-muted font-medium mb-4px uppercase tracking-wider">Processing Payment for</div>
          <div className="text-xl font-black text-primary">{booking.name}</div>
          <div className="text-xs text-muted mt-4px">Room: {booking.room || 'N/A'} • #{booking.sr_no}</div>
        </div>

        <div className="form-group mt-2">
          <label className="form-label">Payment Method</label>
          <div className="payment-method-toggle">
            <button 
              className={`method-btn ${paymentMethod === 'Cash' ? 'active' : ''}`}
              onClick={() => setPaymentMethod('Cash')}
            >
              Cash
            </button>
            <button 
              className={`method-btn ${paymentMethod === 'Online' ? 'active' : ''}`}
              onClick={() => setPaymentMethod('Online')}
            >
              Online
            </button>
          </div>
        </div>

        <div className="form-group mt-1">
          <label className="form-label" htmlFor="collect-amount">Payment Amount (INR)</label>
          <div className="flex-center relative">
             <span className="text-muted absolute left-12">₹</span>
             <input 
               id="collect-amount"
               type="number" 
               className="input-field pl-7 text-xl font-black text-success"
               value={collectAmount} 
               onChange={(e) => setCollectAmount(Number(e.target.value))} 
               placeholder="0.00" 
             />
          </div>
          <p className="text-muted text-xs mt-05 text-right">
             Max: ₹{booking.remaining_amount.toLocaleString()}
          </p>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="collector-name">{paymentMethod === 'Cash' ? 'Collector Name' : 'Verified By'}</label>
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
          <button className="btn btn-secondary flex-1" onClick={onClose}>Discard</button>
          <button 
            className="btn btn-primary flex-2" 
            onClick={handleConfirm}
            title={`Confirm ${paymentMethod} Payment`}
          >
            <CheckCircle size={18} />
            Finalize Receipt
          </button>
        </div>
      </div>
    </div>
  );
};
