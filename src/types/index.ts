export type BookingStatus = 'Pending' | 'Collected' | 'Paid' | 'Not Arrived' | 'Check Required' | 'Partial/Paid';

export interface PaymentHistory {
  amount: number;
  date: string;
  collector: string;
}

export interface Booking {
  id?: string;
  sr_no?: number;
  name: string;
  email?: string;
  age?: number;
  gender?: string;
  phone: string;
  room?: string;
  trip_name?: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: BookingStatus;
  collected_at?: string;
  collector_name?: string;
  collected_by?: string;
  payment_history: PaymentHistory[];
}
