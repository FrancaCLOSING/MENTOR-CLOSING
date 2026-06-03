-- ══════════════════════════════════════
-- MENTOR — Supabase Schema
-- Colle ce SQL dans l'éditeur SQL de Supabase
-- ══════════════════════════════════════

-- Progression par étape
create table if not exists progress (
  id uuid primary key default gen_random_uuid(),
  step_key text not null unique,        -- ex: "0-3"
  completed_at timestamptz,
  drill_scores integer[] default '{}',  -- scores de chaque tentative
  created_at timestamptz default now()
);

-- Mémoire des erreurs récurrentes
create table if not exists memory (
  id uuid primary key default gen_random_uuid(),
  error_desc text not null unique,
  count integer default 1,
  last_seen timestamptz default now(),
  created_at timestamptz default now()
);

-- Historique des sessions
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  type text not null,                  -- 'drill' | 'roleplay' | 'fullcall' | 'transcript'
  module_id integer,
  step_id integer,
  score integer,
  duration_seconds integer,
  notes text,
  created_at timestamptz default now()
);

-- Analyses de calls
create table if not exists call_analyses (
  id uuid primary key default gen_random_uuid(),
  transcript text not null,
  context text,
  global_score integer,
  summary text,
  errors text[],
  plan text,
  line_results jsonb,
  created_at timestamptz default now()
);

-- Index pour performance
create index if not exists idx_progress_step on progress(step_key);
create index if not exists idx_memory_count on memory(count desc);
create index if not exists idx_sessions_created on sessions(created_at desc);
