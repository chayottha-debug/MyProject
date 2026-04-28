create extension if not exists "pgcrypto";

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  customer_code text,
  company_name text not null,
  contact_name text,
  phone text,
  email text,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  product_code text,
  product_name text not null,
  description text,
  unit text,
  unit_price numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_no text not null unique,
  quote_date date not null,
  due_date date,
  status text not null default 'draft',
  customer_id uuid references public.customers(id) on delete set null,
  customer_snapshot jsonb not null default '{}'::jsonb,
  items jsonb not null default '[]'::jsonb,
  remark text,
  delivery_term text not null default 'ภายใน 7-15 วัน',
  validity_term text not null default '30 วัน',
  prepared_by text,
  approved_by text,
  approver_signature_data_url text,
  subtotal numeric(12,2) not null default 0,
  discount_total numeric(12,2) not null default 0,
  vat_total numeric(12,2) not null default 0,
  grand_total numeric(12,2) not null default 0,
  vat_rate numeric(6,2) not null default 7,
  extra_discount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.quotes enable row level security;

drop policy if exists "public customers access" on public.customers;
create policy "public customers access"
on public.customers
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "public products access" on public.products;
create policy "public products access"
on public.products
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "public quotes access" on public.quotes;
create policy "public quotes access"
on public.quotes
for all
to anon, authenticated
using (true)
with check (true);

create index if not exists quotes_quote_no_idx on public.quotes (quote_no);
create index if not exists quotes_created_at_idx on public.quotes (created_at desc);
