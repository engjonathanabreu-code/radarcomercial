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

-- Teto diário de gasto com IA (aplicado em 06/10/2026 como migração radar_orcamento_diario_ia).
create table if not exists public.radar_ai_usage(
  id bigserial primary key,
  day date not null default (now() at time zone 'America/Sao_Paulo')::date,
  created_at timestamptz not null default now(),
  kind text, model text,
  input_tokens integer not null default 0, output_tokens integer not null default 0,
  cache_write_tokens integer not null default 0, cache_read_tokens integer not null default 0,
  web_searches integer not null default 0,
  reserved_usd numeric(12,6) not null default 0, cost_usd numeric(12,6) not null default 0,
  status text not null default 'reservado'
);
create index if not exists radar_ai_usage_day on public.radar_ai_usage(day);
alter table public.radar_ai_usage enable row level security;

create or replace function public.radar_ia_gasto_hoje() returns numeric
language sql stable security invoker set search_path = '' as $$
  select coalesce(sum(case when status = 'reservado' then case when created_at > now() - interval '15 minutes' then reserved_usd else 0 end else cost_usd end), 0)
    from public.radar_ai_usage where day = (now() at time zone 'America/Sao_Paulo')::date
$$;

create or replace function public.radar_ia_reservar(p_limite numeric, p_estimativa numeric, p_kind text, p_model text)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare v bigint;
begin
  perform pg_advisory_xact_lock(hashtext('radar_ai_budget'));
  if public.radar_ia_gasto_hoje() + greatest(p_estimativa, 0) > p_limite then return null; end if;
  insert into public.radar_ai_usage(kind, model, reserved_usd) values (left(p_kind, 40), left(p_model, 80), greatest(p_estimativa, 0)) returning id into v;
  return v;
end $$;

create or replace function public.radar_ia_registrar(p_id bigint, p_input integer, p_output integer, p_cache_write integer, p_cache_read integer, p_searches integer, p_cost numeric, p_status text)
returns void language sql security invoker set search_path = '' as $$
  update public.radar_ai_usage
     set input_tokens = coalesce(p_input, 0), output_tokens = coalesce(p_output, 0),
         cache_write_tokens = coalesce(p_cache_write, 0), cache_read_tokens = coalesce(p_cache_read, 0),
         web_searches = coalesce(p_searches, 0), cost_usd = greatest(coalesce(p_cost, 0), 0), status = left(p_status, 20)
   where id = p_id
$$;
-- radar_claim_next_item passou a ordenar a fila pela cidade pesquisada há mais tempo (ver migração).
