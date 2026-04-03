import { useState } from 'react';
import type { FC } from 'react';
import { Phone, Receipt, Share2, Wallet, User, CheckCircle2, Trash2 } from 'lucide-react';
import type { Booking, BookingStatus } from '../types';
import { generateReceipt } from '../utils/ReceiptGenerator';
import { CollectModal } from './CollectModal';

interface DashboardTableProps {
  bookings: Booking[];
  onUpdateStatus: (id: string, status: BookingStatus, collectorName: string, amount?: number) => void;
  onDelete: (id: string) => void;
}

export const DashboardTable: FC<DashboardTableProps> = ({ bookings = [], onUpdateStatus, onDelete }) => {
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  if (!Array.isArray(bookings) || bookings.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <div className="icon-container-lite flex-center" style={{ margin: '0 auto 1.5rem', background: '#F3F4F6' }}>
          <User size={24} />
        </div>
        <p className="text-muted">No travelers found. Click "+ Import List" to begin your station drop-off collection.</p>
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

  return (
    <div className="dashboard-container">
      <div className="layout-switcher">
        {/* Mobile View */}
        <div className="mobile-only">
          {bookings.map((booking, idx) => (
            <div key={booking.id || idx} className="card mobile-card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">{booking.name}</h2>
                  <p className="text-muted text-xs" style={{ marginTop: '2.5px' }}>Total: ₹ {booking.total_amount.toLocaleString()} • #{booking.sr_no}</p>
                </div>
                <span className={`status-badge status-${getStatusClass(booking.status)}`}>
                  {booking.status}
                </span>
              </div>
              
              <div className="card-body">
                <div className="grid-2">
                  <div>
                    <label className="text-xs text-muted">Paid So Far</label>
                    <div className="text-bold text-success" style={{ fontSize: '1rem' }}>
                      ₹ {(booking.paid_amount || 0).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <label className="text-xs text-muted">Balance Due</label>
                    <div className={`text-bold ${booking.status === 'Paid' ? 'text-success' : 'text-danger'}`} style={{ fontSize: '1rem' }}>
                      ₹ {(booking.remaining_amount || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="text-muted text-xs" style={{ marginTop: '0.75rem' }}>
                  Collector: {booking.collector_name || booking.collected_by || 'N/A'}
                </div>
              </div>

              <div className="card-actions">
                <button className="btn btn-icon" onClick={() => handleCall(booking.phone)} title={`Call ${booking.name}`} aria-label={`Call ${booking.name}`}>
                  <Phone size={18} />
                </button>
                
                {(booking.remaining_amount > 0) ? (
                  <button className="btn btn-primary" onClick={() => setSelectedBooking(booking)} style={{ flex: 1 }} title="Record Cash Collection">
                    <Wallet size={16} /> Collect
                  </button>
                ) : (
                  <div className="text-success flex-center" style={{ flex: 1, gap: '0.5rem', fontWeight: 600 }}>
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
          <div className="card" style={{ padding: '0' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '60px', textAlign: 'center' }}>Sr.No</th>
                  <th>Traveler</th>
                  <th style={{ textAlign: 'right' }}>Total Trip</th>
                  <th style={{ textAlign: 'right' }}>Paid Amt</th>
                  <th style={{ textAlign: 'right' }}>Remaining</th>
                  <th>Status / Collector</th>
                  <th style={{ textAlign: 'right', paddingRight: '1.5rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking, idx) => (
                  <tr key={booking.id || idx}>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{booking.sr_no || idx + 1}</td>
                    <td>
                      <div className="text-bold">{booking.name}</div>
                      <div className="text-muted text-xs">{booking.phone}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>₹ {booking.total_amount.toLocaleString()}</td>
                    <td className="text-bold text-success" style={{ textAlign: 'right' }}>
                      ₹ {(booking.paid_amount || 0).toLocaleString()}
                    </td>
                    <td className={`text-bold ${booking.status === 'Paid' ? 'text-success' : 'text-danger'}`} style={{ textAlign: 'right' }}>
                      ₹ {(booking.remaining_amount || 0).toLocaleString()}
                    </td>
                    <td>
                      <span className={`status-badge status-${getStatusClass(booking.status)}`}>
                        {booking.status || 'Pending'}
                      </span>
                      <div className="text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>
                        {booking.collector_name || booking.collected_by || '-'}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: '1.5rem' }}>
                      <div className="flex-center gap-1" style={{ justifyContent: 'flex-end' }}>
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
          onConfirm={(collectorName, amount) => {
            onUpdateStatus(selectedBooking.id!, 'Partial/Paid', collectorName, amount);
            setSelectedBooking(null);
          }}
        />
      )}
    </div>
  );
};
