-- Agente Comercial Integral — esquema do banco
-- Rode no SQL Editor do Supabase (projeto novo ou existente).
-- O app usa a service role key no servidor; o RLS fica ligado SEM políticas,
-- ou seja: nada é acessível pela chave anônima.

create extension if not exists pgcrypto;

create table if not exists cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  uf text not null check (char_length(uf) = 2),
  ibge_code text,
  contact_name text,
  contact_role text,
  contact_email text,
  contact_phone text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (name, uf)
);

create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null default 'cron',         -- cron | manual
  status text not null default 'running',       -- running | done
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  digest_sent boolean not null default false
);

create table if not exists run_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  city_id uuid not null references cities(id) on delete cascade,
  status text not null default 'pending',       -- pending | running | done | error
  attempts int not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  searches int default 0,
  report jsonb,
  error text,
  unique (run_id, city_id)
);

create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references cities(id) on delete cascade,
  run_id uuid references runs(id) on delete set null,
  kind text not null,                           -- licitacao | noticia | bairro | contato | sinal
  product text,                                 -- reurb | software | ambos | etsa | outro
  title text not null,
  summary text,
  why_it_matters text,
  suggested_action text,
  neighborhood text,
  source_url text,
  source_name text,
  published_at date,
  deadline_at timestamptz,
  deadline_verified boolean not null default false,
  business_days_left int,
  eligible boolean,                             -- só para licitações
  score int not null default 0,
  confidence text,
  extra jsonb,
  status text not null default 'novo',          -- novo | em_andamento | descartado | ganho
  fingerprint text not null unique,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index if not exists opportunities_city_idx on opportunities(city_id);
create index if not exists opportunities_seen_idx on opportunities(first_seen desc);

create table if not exists email_drafts (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references cities(id) on delete cascade,
  opportunity_ids uuid[] default '{}',
  intent text,
  briefing text,
  to_email text,
  cc text,
  subject text,
  body text,
  status text not null default 'rascunho',      -- rascunho | enviado | erro
  message_id text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table cities enable row level security;
alter table runs enable row level security;
alter table run_items enable row level security;
alter table opportunities enable row level security;
alter table email_drafts enable row level security;
alter table settings enable row level security;

-- Reserva atômica da próxima cidade de uma rodada (permite várias cadeias em paralelo
-- sem pesquisar a mesma cidade duas vezes). Itens travados há mais de 12 min voltam à fila.
create or replace function claim_next_item(p_run_id uuid)
returns setof run_items
language plpgsql
as $$
begin
  update run_items
     set status = 'pending'
   where run_id = p_run_id
     and status = 'running'
     and started_at < now() - interval '12 minutes'
     and attempts < 3;

  return query
  update run_items
     set status = 'running', started_at = now(), attempts = attempts + 1
   where id = (
     select id from run_items
      where run_id = p_run_id and status = 'pending'
      order by id
      for update skip locked
      limit 1
   )
  returning *;
end;
$$;
