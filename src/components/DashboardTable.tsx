import { useState } from 'react';
import type { FC } from 'react';
import { Phone, Receipt, Share2, Wallet, User, CheckCircle2, Trash2, Banknote, Globe, AlertCircle } from 'lucide-react';
import type { Booking, BookingStatus } from '../types';
import { generateReceipt } from '../utils/ReceiptGenerator';
import { CollectModal } from './CollectModal';

interface DashboardTableProps {
  bookings: Booking[];
  onUpdateStatus: (id: string, status: BookingStatus, collectorName: string, amount: number, paymentMethod: 'Cash' | 'Online') => void;
  onDelete: (id: string) => void;
}

export const DashboardTable: FC<DashboardTableProps> = ({ bookings = [], onUpdateStatus, onDelete }) => {
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  if (!Array.isArray(bookings) || bookings.length === 0) {
    return (
      <div className="card text-center py-25 animate-fade-in">
        <div className="icon-container-lite flex-center m-auto bg-light-gray mb-1">
          <User size={24} className="text-muted" />
        </div>
        <p className="text-muted font-medium">No travelers found. Click "+ Import List" to begin.</p>
      </div>
    );
  }

  const handleCall = (phone: string) => {
    if (!phone) return;
    window.location.assign(`tel:${phone}`);
  };

  const handleSendWhatsApp = (booking: Booking) => {
    const collector = booking.collector_name || booking.collected_by || 'Team YouthCamping';
    const amount = (booking.paid_amount || 0).toLocaleString();
    const remaining = (booking.remaining_amount || 0).toLocaleString();
    
    if (booking.paid_amount <= 0) {
      alert("No payment found to share confirmation for.");
      return;
    }

    generateReceipt(booking, collector);

    const message = `Dear *${booking.name}*,

Greetings from *YouthCamping!* 🏕️

We are pleased to acknowledge the successful receipt of your payment:
💰 *Amount Collected:* ₹${amount}
📉 *Remaining Balance:* ₹${remaining}

This payment has been verified by our representative, *${collector}*. 

Thank you for your valued trust. We look forward to crafting a refined and memorable experience for you!

With gratitude,
*Team YouthCamping*`;
    
    window.open(`https://wa.me/91${booking.phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleViewReceipt = (booking: Booking) => {
    if (booking.paid_amount <= 0) {
      alert("Receipt can only be generated for travelers who have made a payment.");
      return;
    }
    generateReceipt(booking, booking.collector_name || booking.collected_by || 'Ground Team');
  };

  const getStatusClass = (status: BookingStatus) => {
    return (status || 'Pending').toLowerCase().replace(/\s/g, '').replace('/', '');
  };

  const stats = bookings.reduce((acc, b) => {
    // If we have history, calculate from history for accuracy
    if (b.payment_history && b.payment_history.length > 0) {
      b.payment_history.forEach(p => {
        if (p.payment_method === 'Cash') acc.cash += p.amount;
        else if (p.payment_method === 'Online') acc.online += p.amount;
        else {
           // Fallback for older records where history didn't have method
           if (b.payment_method === 'Cash') acc.cash += p.amount;
           else acc.online += p.amount;
        }
      });
    } else {
       // Fallback for records with no history
       if (b.payment_method === 'Cash') acc.cash += (b.paid_amount || 0);
       else if (b.payment_method === 'Online') acc.online += (b.paid_amount || 0);
    }
    acc.remaining += (b.remaining_amount || 0);
    return acc;
  }, { cash: 0, online: 0, remaining: 0 });

  return (
    <div className="dashboard-container">
      <div className="grid-2 md-grid-3 gap-1 mb-2 animate-fade-in">
         <div className="card stat-card border-left-success">
            <div className="flex-between w-full">
              <div className="stat-label">Cash Collected</div>
              <Banknote size={20} className="text-success opacity-50" />
            </div>
            <div className="stat-value text-success">₹ {stats.cash.toLocaleString()}</div>
         </div>
         <div className="card stat-card border-left-accent">
            <div className="flex-between w-full">
              <div className="stat-label">Online Payments</div>
              <Globe size={20} className="text-accent opacity-50" />
            </div>
            <div className="stat-value text-accent">₹ {stats.online.toLocaleString()}</div>
         </div>
         <div className="card stat-card border-left-danger">
            <div className="flex-between w-full">
              <div className="stat-label">Total Outstandings</div>
              <AlertCircle size={20} className="text-danger opacity-50" />
            </div>
            <div className="stat-value text-danger">₹ {stats.remaining.toLocaleString()}</div>
         </div>
      </div>

      <div className="layout-switcher">
        {/* Mobile View */}
        <div className="mobile-only">
          {bookings.map((booking, idx) => (
            <div key={booking.id || idx} className="card mobile-card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">{booking.name}</h2>
                  <p className="text-muted text-xs mt-2-5px">Total: ₹ {booking.total_amount.toLocaleString()} • #{booking.sr_no}</p>
                </div>
                <span className={`status-badge status-${getStatusClass(booking.status)}`}>
                  {booking.status}
                </span>
              </div>
              
              <div className="card-body">
                <div className="grid-2">
                  <div className="bg-soft-green p-1 rounded-sm">
                    <label className="text-2xs text-muted block mb-1">PAID</label>
                    <div className="text-bold text-success text-xl">
                      ₹ {(booking.paid_amount || 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right bg-soft-orange p-1 rounded-sm">
                    <label className="text-2xs text-muted block mb-1">BALANCE</label>
                    <div className={`text-bold ${booking.status === 'Paid' ? 'text-success' : 'text-danger'} text-xl`}>
                      ₹ {(booking.remaining_amount || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex-between mt-075">
                  <div className="text-muted text-xs">
                    Collector: {booking.collector_name || booking.collected_by || 'N/A'}
                  </div>
                  {booking.paid_amount > 0 && (
                    <span className={`text-2xs font-black uppercase ${booking.payment_method === 'Cash' ? 'text-success' : 'text-primary'}`}>
                      {booking.payment_method || 'Cash'}
                    </span>
                  )}
                </div>
              </div>

              <div className="card-actions">
                <button className="btn btn-icon" onClick={() => handleCall(booking.phone)} title={`Call ${booking.name}`} aria-label={`Call ${booking.name}`}>
                  <Phone size={18} />
                </button>
                
                {(booking.remaining_amount > 0) ? (
                  <button className="btn btn-primary flex-1" onClick={() => setSelectedBooking(booking)} title="Record Cash Collection">
                    <Wallet size={16} /> Collect
                  </button>
                ) : (
                  <div className="text-success flex-center flex-1 gap-1 text-bold">
                    <CheckCircle2 size={16} /> Fully Paid
                  </div>
                )}

                <button 
                  className={`btn btn-icon ${booking.paid_amount <= 0 ? 'btn-disabled' : ''}`} 
                  onClick={() => handleSendWhatsApp(booking)}
                  disabled={booking.paid_amount <= 0}
                  title="Send WhatsApp Confirmation"
                  aria-label="Send WhatsApp"
                >
                  <Share2 size={18} />
                </button>
                
                <button 
                  className={`btn btn-icon ${booking.paid_amount <= 0 ? 'btn-disabled' : ''}`} 
                  onClick={() => handleViewReceipt(booking)}
                  disabled={booking.paid_amount <= 0}
                  title="Generate Official Receipt"
                  aria-label="Download Receipt"
                >
                  <Receipt size={18} />
                </button>

                <button 
                  className="btn btn-icon btn-danger-lite" 
                  onClick={() => { if(window.confirm(`Delete ${booking.name}?`)) onDelete(booking.id!); }}
                  title="Delete traveler"
                  aria-label="Delete"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop View */}
        <div className="desktop-only text-sm">
          <div className="card no-padding">
            <table>
              <thead>
                <tr>
                  <th className="w-60 text-center">Sr.No</th>
                  <th>Traveler</th>
                  <th className="text-right">Total Trip</th>
                  <th className="text-right">Paid Amt</th>
                  <th className="text-right">Remaining</th>
                  <th>Status / Collector</th>
                  <th className="text-right pr-15">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking, idx) => (
                  <tr key={booking.id || idx}>
                    <td className="text-center text-muted">{booking.sr_no || idx + 1}</td>
                    <td>
                      <div className="text-bold">{booking.name}</div>
                      <div className="text-muted text-xs">{booking.phone}</div>
                    </td>
                    <td className="text-right">₹ {booking.total_amount.toLocaleString()}</td>
                    <td className="text-bold text-success text-right">
                      ₹ {(booking.paid_amount || 0).toLocaleString()}
                    </td>
                    <td className={`text-bold ${booking.status === 'Paid' ? 'text-success' : 'text-danger'} text-right`}>
                      ₹ {(booking.remaining_amount || 0).toLocaleString()}
                    </td>
                    <td>
                      <span className={`status-badge status-${getStatusClass(booking.status)}`}>
                        {booking.status || 'Pending'}
                      </span>
                      <div className="text-muted mt-4px text-2xs flex-between">
                        <span>{booking.collector_name || booking.collected_by || '-'}</span>
                        {booking.paid_amount > 0 && (
                          <span className={`font-black ml-1 ${booking.payment_method === 'Cash' ? 'text-success' : 'text-primary'}`}>
                            {booking.payment_method || 'Cash'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-right pr-15">
                      <div className="flex-center gap-1 justify-end">
                        <button className="btn btn-icon btn-icon-small" onClick={() => handleCall(booking.phone)} title={`Call ${booking.name}`}>
                          <Phone size={14} />
                        </button>
                        <button className="btn btn-primary btn-icon-small" onClick={() => setSelectedBooking(booking)} title="Collect Cash">
                          Collect
                        </button>
                        <button 
                          className={`btn btn-secondary btn-icon-small ${booking.paid_amount <= 0 ? 'btn-disabled' : ''}`} 
                          onClick={() => handleViewReceipt(booking)} 
                          disabled={booking.paid_amount <= 0}
                          title="Generate Receipt"
                        >
                          Receipt
                        </button>
                        <button 
                          className={`btn btn-secondary btn-icon-small ${booking.paid_amount <= 0 ? 'btn-disabled' : ''}`} 
                          onClick={() => handleSendWhatsApp(booking)} 
                          title="WhatsApp Confirmation" 
                          disabled={booking.paid_amount <= 0}
                        >
                          WA
                        </button>
                        <button 
                          className="btn btn-icon btn-icon-small btn-danger-lite" 
                          onClick={() => { if(window.confirm(`Delete ${booking.name}?`)) onDelete(booking.id!); }}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedBooking && (
        <CollectModal 
          booking={selectedBooking} 
          onClose={() => setSelectedBooking(null)}
          onConfirm={(collectorName, amount, paymentMethod) => {
            onUpdateStatus(selectedBooking.id!, 'Partial/Paid', collectorName, amount, paymentMethod);
            setSelectedBooking(null);
          }}
        />
      )}
    </div>
  );
};
