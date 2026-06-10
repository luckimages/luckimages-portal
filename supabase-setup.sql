-- Profiles (role + info for all users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  role text not null default 'realtor',
  full_name text,
  phone text,
  brokerage text,
  areas text,
  birthday date,
  mailing_list boolean default false,
  referral_source text,
  invite_code text,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Own profile" on public.profiles for all using (auth.uid() = id);
create policy "Admin full access" on public.profiles for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'role', 'realtor')
  );
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Shoots
create table if not exists public.shoots (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references auth.users,
  photographer_id uuid references auth.users,
  address text,
  scheduled_at timestamptz,
  services text[],
  status text default 'pending',
  notes text,
  created_at timestamptz default now()
);
alter table public.shoots enable row level security;
create policy "Client sees own shoots" on public.shoots for select using (auth.uid() = client_id);
create policy "Photographer sees assigned shoots" on public.shoots for select using (auth.uid() = photographer_id);
create policy "Admin full access" on public.shoots for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Invoices
create table if not exists public.invoices (
  id uuid default gen_random_uuid() primary key,
  shoot_id uuid references public.shoots,
  client_id uuid references auth.users,
  amount_cents integer,
  paid boolean default false,
  due_date date,
  notes text,
  created_at timestamptz default now()
);
alter table public.invoices enable row level security;
create policy "Client sees own invoices" on public.invoices for select using (auth.uid() = client_id);
create policy "Admin full access" on public.invoices for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Media
create table if not exists public.media (
  id uuid default gen_random_uuid() primary key,
  shoot_id uuid references public.shoots,
  uploaded_by uuid references auth.users,
  file_path text,
  file_name text,
  file_type text,
  created_at timestamptz default now()
);
alter table public.media enable row level security;
create policy "Client and photographer see shoot media" on public.media for select using (
  exists (select 1 from public.shoots where id = shoot_id and (client_id = auth.uid() or photographer_id = auth.uid()))
);
create policy "Photographer can upload" on public.media for insert with check (auth.uid() = uploaded_by);
create policy "Admin full access" on public.media for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Pay stubs
create table if not exists public.pay_stubs (
  id uuid default gen_random_uuid() primary key,
  photographer_id uuid references auth.users,
  shoot_id uuid references public.shoots,
  amount_cents integer,
  paid boolean default false,
  paid_at timestamptz,
  notes text,
  created_at timestamptz default now()
);
alter table public.pay_stubs enable row level security;
create policy "Photographer sees own pay stubs" on public.pay_stubs for select using (auth.uid() = photographer_id);
create policy "Admin full access" on public.pay_stubs for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Storage bucket for shoot media
insert into storage.buckets (id, name, public) values ('shoot-media', 'shoot-media', false) on conflict do nothing;
create policy "Photographers can upload" on storage.objects for insert with check (bucket_id = 'shoot-media' and auth.role() = 'authenticated');
create policy "Authenticated users can view" on storage.objects for select using (bucket_id = 'shoot-media' and auth.role() = 'authenticated');
