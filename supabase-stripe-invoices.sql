-- Stripe payment support for invoices.

alter table public.invoices add column if not exists paid_at timestamptz;
alter table public.invoices add column if not exists stripe_session_id text;
alter table public.invoices add column if not exists stripe_payment_intent_id text;
alter table public.invoices add column if not exists description text;
alter table public.invoices add column if not exists contact_id uuid references public.contacts(id) on delete set null;

notify pgrst, 'reload schema';
