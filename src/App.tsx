import { useState, useEffect, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import type { Booking, BookingStatus } from './types';
import { UploadExcel } from './components/UploadExcel';
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

  const handleUpdateStatus = async (id: string, _status: BookingStatus, collectorName: string, amountCollected?: number) => {
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
      collector_name: collectorName 
    } : b);
    setBookings(updatedLocally);

    if (!isSupabaseConfigured) {
      localStorage.setItem('mock_bookings', JSON.stringify(updatedLocally));
      return;
    }
    
    try {
      await supabase.from('bookings').update({ 
        status: finalStatus, 
        remaining_amount: newRemaining, 
        paid_amount: newPaid, 
        collector_name: collectorName 
      }).eq('id', id);
      
      // Optionally fetch to confirm sync, but our local state is already ahead
      // fetchBookings(); 
    } catch (err) {
      console.error('Remote sync failed, kept local state.', err);
    }
  };

  const handleDataLoaded = async (data: Booking[]) => {
    setBookings(data);
    setShowUpload(false);
    
    if (isSupabaseConfigured) {
      try {
        setLoading(true);
        // Sync imported data to Supabase
        const { error } = await supabase.from('bookings').insert(data.map(b => ({
          id: b.id,
          sr_no: b.sr_no,
          name: b.name,
          phone: b.phone,
          trip_name: b.trip_name,
          total_amount: b.total_amount,
          paid_amount: b.paid_amount,
          remaining_amount: b.remaining_amount,
          status: b.status,
          room: b.room
        })));
        
        if (error) throw error;
      } catch (err) {
        console.error('Initial sync to Supabase failed', err);
        // Fallback to local storage if sync fails
        localStorage.setItem('mock_bookings', JSON.stringify(data));
      } finally {
        setLoading(false);
      }
    } else {
      localStorage.setItem('mock_bookings', JSON.stringify(data));
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
      <header className="header">
        <div className="flex-center gap-1">
          <div className="icon-bg">
            <Database size={20} color="var(--primary)" />
          </div>
          <h1>YouthCamping Dashboard</h1>
        </div>
      </header>

      <main className="app-container">
        <div className="flex-between mb-2">
           <div className="text-muted text-sm">
              Station Drop-off Tracker • <strong>{bookings.length}</strong> passengers
           </div>
           <button className="btn btn-primary" onClick={() => setShowUpload(true)}>+ Import List</button>
        </div>

        {loading ? (
          <div className="loading-container">Synchronizing station data...</div>
        ) : (
          <DashboardTable bookings={filteredBookings} onUpdateStatus={handleUpdateStatus} onDelete={handleDelete} />
        )}
      </main>

      {showUpload && (
        <UploadExcel 
          onDataLoaded={handleDataLoaded} 
          onClose={() => setShowUpload(false)} 
        />
      )}
    </div>
  );
}

export default App;
