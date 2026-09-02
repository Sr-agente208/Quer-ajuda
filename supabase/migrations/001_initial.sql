-- ============================================================
-- Quer Ajuda? — Schema inicial do Supabase
-- ============================================================
-- Como rodar:
-- 1) Supabase Dashboard > SQL Editor > New query
-- 2) Cole este arquivo inteiro
-- 3) Clique em "Run" (Ctrl+Enter)
-- ============================================================

-- ============= PERFIS =============
-- Vinculado 1:1 ao auth.users do Supabase Auth
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('idoso', 'responsavel')),
  full_name text,
  font_scale numeric default 1.0 check (font_scale between 0.85 and 1.6),
  theme text default 'light' check (theme in ('light','dark','auto')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger que cria o profile automaticamente quando um user se cadastra
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'idoso'),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============= VÍNCULO IDOSO <-> RESPONSÁVEL =============
-- Um responsável pode estar vinculado a 1+ idosos
-- Cada idoso pode ter 1+ responsáveis
create table if not exists public.care_links (
  id uuid primary key default gen_random_uuid(),
  idoso_id uuid not null references public.profiles(id) on delete cascade,
  responsavel_id uuid not null references public.profiles(id) on delete cascade,
  relationship text,
  created_at timestamptz not null default now(),
  unique (idoso_id, responsavel_id)
);
create index if not exists care_links_idoso_idx on public.care_links(idoso_id);
create index if not exists care_links_responsavel_idx on public.care_links(responsavel_id);

-- ============= REMÉDIOS =============
create table if not exists public.remedios (
  id uuid primary key default gen_random_uuid(),
  idoso_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  dosage text,
  schedule text, -- ex: "08:00, 20:00"
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists remedios_idoso_idx on public.remedios(idoso_id);

-- ============= CONSULTAS / COMPROMISSOS =============
create table if not exists public.consultas (
  id uuid primary key default gen_random_uuid(),
  idoso_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  specialty text,
  location text,
  scheduled_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists consultas_idoso_idx on public.consultas(idoso_id);
create index if not exists consultas_when_idx on public.consultas(scheduled_at);

-- ============= ROW LEVEL SECURITY (RLS) =============
alter table public.profiles enable row level security;
alter table public.care_links enable row level security;
alter table public.remedios enable row level security;
alter table public.consultas enable row level security;

-- Helper: IDs dos idosos que o user atual (responsável) tem vínculo
create or replace function public.my_idoso_ids()
returns setof uuid language sql stable security definer set search_path = public
as $$
  select idoso_id from public.care_links where responsavel_id = auth.uid();
$$;

-- ----- profiles: cada user lê/edita o próprio perfil
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles
  for update using (auth.uid() = id);

-- profiles: responsável lê profiles dos seus idosos vinculados
drop policy if exists "profiles linked read" on public.profiles;
create policy "profiles linked read" on public.profiles
  for select using (id in (select public.my_idoso_ids()));

-- ----- care_links: o idoso e o responsável veem o vínculo
drop policy if exists "care_links self read" on public.care_links;
create policy "care_links self read" on public.care_links
  for select using (auth.uid() = idoso_id or auth.uid() = responsavel_id);

drop policy if exists "care_links responsavel create" on public.care_links;
create policy "care_links responsavel create" on public.care_links
  for insert with check (auth.uid() = responsavel_id);

drop policy if exists "care_links self delete" on public.care_links;
create policy "care_links self delete" on public.care_links
  for delete using (auth.uid() = idoso_id or auth.uid() = responsavel_id);

-- ----- remedios: idoso lê/escreve os próprios; responsável lê/escreve dos vinculados
drop policy if exists "remedios idoso all" on public.remedios;
create policy "remedios idoso all" on public.remedios
  for all using (auth.uid() = idoso_id) with check (auth.uid() = idoso_id);

drop policy if exists "remedios responsavel all" on public.remedios;
create policy "remedios responsavel all" on public.remedios
  for all using (idoso_id in (select public.my_idoso_ids()))
  with check (idoso_id in (select public.my_idoso_ids()));

-- ----- consultas: idoso lê/escreve as próprias; responsável lê/escreve dos vinculados
drop policy if exists "consultas idoso all" on public.consultas;
create policy "consultas idoso all" on public.consultas
  for all using (auth.uid() = idoso_id) with check (auth.uid() = idoso_id);

drop policy if exists "consultas responsavel all" on public.consultas;
create policy "consultas responsavel all" on public.consultas
  for all using (idoso_id in (select public.my_idoso_ids()))
  with check (idoso_id in (select public.my_idoso_ids()));

-- ============================================================
-- PRONTO! O banco está estruturado com RLS ativo.
-- Cada usuário só vê e edita o que tem permissão.
-- ============================================================
