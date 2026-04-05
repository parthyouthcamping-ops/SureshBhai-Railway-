import { useState, useEffect, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import type { Booking, BookingStatus } from './types';
import { ExcelImportProcessor } from './components/ExcelImportProcessor';
import { DashboardTable } from './components/DashboardTable';
import { Database } from 'lucide-react';

function App() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      if (!isSupabaseConfigured) {
        const saved = localStorage.getItem('mock_bookings');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
               const first = parsed[0] as Record<string, unknown> | undefined;
               if (first && 'group_name' in first) {
                  localStorage.removeItem('mock_bookings');
                  setBookings([]);
               } else {
                  setBookings((parsed as Booking[]).map(b => ({
                    ...b,
                    id: b.id || crypto.randomUUID()
                  })));
               }
            } else { setBookings([]); }
          } catch { setBookings([]); }
        }
        setLoading(false);
        return;
      }
      const { data, error: sbError } = await supabase.from('bookings').select('*').order('created_at', { ascending: false });
      if (sbError) throw sbError;
      setBookings(data || []);
    } catch (err) {
      console.error('Data sync error', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredBookings = useMemo(() => {
    return Array.isArray(bookings) ? [...bookings] : [];
  }, [bookings]);

  const handleUpdateStatus = async (id: string, _status: BookingStatus, collectorName: string, amountCollected: number, paymentMethod: 'Cash' | 'Online') => {
    const amt = amountCollected || 0;
    const target = bookings.find(b => b.id === id);
    if (!target) return;
    
    const newPaid = (target.paid_amount || 0) + amt;
    const newRemaining = Math.max(0, (target.remaining_amount || 0) - amt);
    const finalStatus = newRemaining === 0 ? 'Paid' : 'Partial/Paid';

    // OPTIMISTIC UPDATE: Update local state immediately
    const updatedLocally = bookings.map(b => b.id === id ? { 
      ...b, 
      status: finalStatus as BookingStatus, 
      remaining_amount: newRemaining, 
      paid_amount: newPaid, 
      collector_name: collectorName,
      payment_method: paymentMethod,
      payment_history: [
        ...(b.payment_history || []),
        { amount: amt, date: new Date().toISOString(), collector: collectorName, payment_method: paymentMethod }
      ]
    } : b);
    setBookings(updatedLocally);

    if (!isSupabaseConfigured) {
      localStorage.setItem('mock_bookings', JSON.stringify(updatedLocally));
      return;
    }
    
    try {
      const updatedBooking = updatedLocally.find(b => b.id === id);
      await supabase.from('bookings').update({ 
        status: finalStatus, 
        remaining_amount: newRemaining, 
        paid_amount: newPaid, 
        collector_name: collectorName,
        payment_method: paymentMethod,
        payment_history: updatedBooking?.payment_history
      }).eq('id', id);
    } catch (err) {
      console.error('Remote sync failed, kept local state.', err);
    }
  };


  const handleDelete = async (id: string) => {
    const updated = bookings.filter(b => b.id !== id);
    setBookings(updated);
    
    if (!isSupabaseConfigured) {
      localStorage.setItem('mock_bookings', JSON.stringify(updated));
    } else {
      try {
        await supabase.from('bookings').delete().eq('id', id);
      } catch (err) {
        console.error('Failed to delete from Supabase', err);
      }
    }
  };

  return (
    <div className="app-shell">
      <header className="header shadow-sm">
        <div className="flex-center gap-1">
          <div className="icon-bg">
            <Database size={20} />
          </div>
          <div>
            <h1 className="text-xl mb-0 pr-15">YouthCamping</h1>
            <div className="text-muted text-xs font-medium uppercase tracking-widest mt-4px">Rail Operations OS</div>
          </div>
        </div>
        <div className="desktop-only text-muted text-sm font-medium">
           <span className="opacity-50">STATION TRACKER</span>
        </div>
      </header>

      <main className="app-container animate-fade-in">
        <div className="flex-between mb-1">
           <div>
              <h2 className="text-lg">Dashboard</h2>
              <div className="text-muted text-xs">
                 Managing <strong>{bookings.length}</strong> passengers for today
              </div>
           </div>
           <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
             <Database size={16} />
             Import List
           </button>
        </div>

        {loading ? (
          <div className="loading-container text-lg font-medium opacity-50">
             <div className="animation-pulse">Synchronizing secure data...</div>
          </div>
        ) : (
          <DashboardTable bookings={filteredBookings} onUpdateStatus={handleUpdateStatus} onDelete={handleDelete} />
        )}
      </main>

      {showUpload && (
        <ExcelImportProcessor 
          onComplete={fetchBookings} 
          onClose={() => setShowUpload(false)} 
        />
      )}
    </div>
  );
}

export default App;
