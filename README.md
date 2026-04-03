# Railway Travel Operations Dashboard

A premium, mobile-first dashboard for travel on-ground teams to manage bookings and cash collections.

## Features
-   **Excel Import:** Upload booking data directly from Excel files.
-   **Supabase Sync:** Real-time data storage and updates.
-   **Cash Collection:** Mark cash as collected with collector name and timestamp.
-   **PDF Receipts:** Generate professional payment receipts automatically.
-   **WhatsApp Integration:** Send payment confirmations to clients in one click.

## setup instructions

### 1. Supabase Table Schema
Run this SQL in your Supabase SQL Editor:

```sql
create table bookings (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  phone text,
  trip_name text,
  remaining_amount numeric,
  pickup_location text,
  status text check (status in ('Pending', 'Collected')) default 'Pending',
  collector_name text,
  collected_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- Enable RLS (Optional)
-- alter table bookings enable row level security;
```

### 2. Configure environment variables
Create a `.env` file in the root directory:
```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Run Locally
```bash
npm install
npm run dev
```

## Dashboard Aesthetics
-   **Glassmorphism:** Elegant blur effects and semi-transparent backgrounds.
-   **Vibrant Gradients:** Modern Indigo/Violet color palette.
-   **Mobile First:** Responsive card-based layout for mobile devices.
-   **Micro-animations:** Smooth transitions using Framer Motion.
