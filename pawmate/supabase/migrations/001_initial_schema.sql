-- PROFILES (extends Supabase auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_guest boolean default true,
  is_premium boolean default false,
  premium_until timestamptz,
  language text default 'he',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- PETS (one active at a time, but supports multiple for future)
create table public.pets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  species text not null check (species in ('dog','cat','rabbit','hamster','turtle','bird','fish')),
  rarity text not null default 'common' check (rarity in ('common','uncommon','rare','legendary')),
  level int not null default 1,
  xp int not null default 0,
  hunger int not null default 80 check (hunger between 0 and 100),
  happiness int not null default 80 check (happiness between 0 and 100),
  energy int not null default 80 check (energy between 0 and 100),
  hygiene int not null default 80 check (hygiene between 0 and 100),
  health int not null default 100 check (health between 0 and 100),
  bond int not null default 0 check (bond between 0 and 100),
  last_action_at timestamptz default now(),
  last_synced_at timestamptz default now(),
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ECONOMY
create table public.economy (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  coins int not null default 100 check (coins >= 0),
  gems int not null default 5 check (gems >= 0),
  updated_at timestamptz default now()
);

-- INVENTORY
create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null,
  item_type text not null check (item_type in ('food','toy','furniture','cosmetic','consumable')),
  quantity int not null default 1 check (quantity >= 0),
  acquired_at timestamptz default now()
);

create index idx_inventory_user on public.inventory(user_id, item_type);

-- TRANSACTIONS (log everything — future revenue reporting)
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  type text not null check (type in ('purchase','reward','refund','gift','ad_reward')),
  item_id text,
  currency text check (currency in ('coins','gems','usd','ils')),
  amount numeric not null,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- ANALYTICS EVENTS (funnel tracking)
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  event_name text not null,
  payload jsonb default '{}',
  created_at timestamptz default now()
);

create index idx_events_user_time on public.events(user_id, created_at desc);

-- ROW LEVEL SECURITY
alter table public.profiles enable row level security;
alter table public.pets enable row level security;
alter table public.economy enable row level security;
alter table public.inventory enable row level security;
alter table public.transactions enable row level security;
alter table public.events enable row level security;

create policy "users see own profile" on public.profiles for all using (auth.uid() = id);
create policy "users see own pets" on public.pets for all using (auth.uid() = user_id);
create policy "users see own economy" on public.economy for all using (auth.uid() = user_id);
create policy "users see own inventory" on public.inventory for all using (auth.uid() = user_id);
create policy "users see own transactions" on public.transactions for all using (auth.uid() = user_id);
create policy "users see own events" on public.events for all using (auth.uid() = user_id);

-- AUTO-CREATE PROFILE + ECONOMY ON SIGNUP
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, is_guest) values (new.id, new.is_anonymous);
  insert into public.economy (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
