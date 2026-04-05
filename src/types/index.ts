export type BookingStatus = 'Pending' | 'Collected' | 'Paid' | 'Not Arrived' | 'Check Required' | 'Partial/Paid';

export interface PaymentHistory {
  amount: number;
  date: string;
  collector: string;
  payment_method?: 'Cash' | 'Online';
}

export interface Booking {
  id?: string;
  sr_no?: number;
  name: string;
  email?: string;
  age?: number;
  gender?: string;
  phone: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: BookingStatus;
  collected_at?: string;
  collector_name?: string;
  collected_by?: string;
  room?: string;
  remark?: string;
  payment_method?: 'Cash' | 'Online';
  payment_history: PaymentHistory[];
}

export interface RawImport {
  id?: string;
  client_name: string;
  trip_name: string;
  total_amount: number;
  paid_amount: number;
  payment_date: string;
  phone: string;
  age?: number;
  room?: string;
  remark?: string;
  created_at?: string;
}

export interface GroupedImport {
  client_name: string;
  trip_name: string;
  total_amount: number;
  paid_total: number;
  remaining_amount: number;
  phone?: string;
  age?: number;
  room?: string;
  remark?: string;
  payments: {
    amount: number;
    date: string;
  }[];
}
