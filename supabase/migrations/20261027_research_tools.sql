-- Additive migration: preserve existing projects, protocols, events and accounts.
begin;
create table if not exists public.research_designs (
  project_id uuid primary key references public.projects(id) on delete cascade,
  design jsonb not null default '{}'::jsonb check (jsonb_typeof(design) = 'object'),
  updated_at timestamptz not null default now()
);
create table if not exists public.research_datasets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  quantity text not null check (char_length(trim(quantity)) between 1 and 120),
  unit text not null check (char_length(trim(unit)) between 1 and 80),
  "values" jsonb not null check (jsonb_typeof("values") = 'array' and jsonb_array_length("values") between 1 and 10000 and not jsonb_path_exists("values", '$[*] ? (@.type() != "number")')),
  exclusions jsonb not null default '{}'::jsonb check (jsonb_typeof(exclusions) = 'object'),
  resolution double precision not null default 0 check (resolution >= 0 and resolution < 'Infinity'::float8),
  coverage_factor double precision not null default 2 check (coverage_factor > 0 and coverage_factor < 'Infinity'::float8),
  conditions text not null default '', notes text not null default '', run_date date not null,
  protocol_snapshot jsonb check (protocol_snapshot is null or jsonb_typeof(protocol_snapshot) = 'object'),
  archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists research_datasets_project_idx on public.research_datasets(project_id, updated_at desc);
alter table public.research_designs enable row level security;
alter table public.research_datasets enable row level security;
revoke all on public.research_designs, public.research_datasets from anon;
grant select, insert, update on public.research_designs, public.research_datasets to authenticated;
drop policy if exists "owners manage design" on public.research_designs;
create policy "owners manage design" on public.research_designs for all to authenticated
using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())))
with check (exists (select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())));
drop policy if exists "owners manage datasets" on public.research_datasets;
create policy "owners manage datasets" on public.research_datasets for all to authenticated
using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())))
with check (exists (select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())));
notify pgrst, 'reload schema';
commit;
