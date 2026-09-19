-- Rewards MVP: settings, per-task points, append-only ledger (no shop).
-- Applied remotely on project lgiqyybjnjfjxixzennr; this file mirrors that DDL.

create table if not exists public.reward_settings (
  family_id uuid primary key references public.families (id) on delete cascade,
  enabled boolean not null default true,
  unit_label text not null default '⭐',
  updated_at timestamptz not null default now()
);

create table if not exists public.reward_tasks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  task_id uuid not null unique references public.tasks (id) on delete cascade,
  points integer not null check (points > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists reward_tasks_family_id_idx
  on public.reward_tasks (family_id);

create table if not exists public.reward_ledger (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_profile_id uuid not null references public.child_profiles (id) on delete cascade,
  amount integer not null,
  kind text not null check (kind = any (array['earn'::text, 'reset'::text, 'adjust'::text])),
  task_id uuid references public.tasks (id) on delete set null,
  completion_id uuid references public.task_completions (id) on delete set null,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint reward_ledger_earn_positive check ((kind <> 'earn'::text) or (amount > 0)),
  constraint reward_ledger_reset_nonpositive check ((kind <> 'reset'::text) or (amount <= 0))
);

create index if not exists reward_ledger_child_idx
  on public.reward_ledger (family_id, child_profile_id, created_at desc);

alter table public.reward_settings enable row level security;
alter table public.reward_tasks enable row level security;
alter table public.reward_ledger enable row level security;

-- reward_settings: members SELECT; parents INSERT/UPDATE
drop policy if exists reward_settings_select on public.reward_settings;
create policy reward_settings_select on public.reward_settings
  for select using (public.is_family_member(family_id));

drop policy if exists reward_settings_insert on public.reward_settings;
create policy reward_settings_insert on public.reward_settings
  for insert with check (public.is_family_parent(family_id));

drop policy if exists reward_settings_update on public.reward_settings;
create policy reward_settings_update on public.reward_settings
  for update using (public.is_family_parent(family_id))
  with check (public.is_family_parent(family_id));

-- reward_tasks: members SELECT; parents INSERT/UPDATE/DELETE
drop policy if exists reward_tasks_select on public.reward_tasks;
create policy reward_tasks_select on public.reward_tasks
  for select using (public.is_family_member(family_id));

drop policy if exists reward_tasks_insert on public.reward_tasks;
create policy reward_tasks_insert on public.reward_tasks
  for insert with check (public.is_family_parent(family_id));

drop policy if exists reward_tasks_update on public.reward_tasks;
create policy reward_tasks_update on public.reward_tasks
  for update using (public.is_family_parent(family_id))
  with check (public.is_family_parent(family_id));

drop policy if exists reward_tasks_delete on public.reward_tasks;
create policy reward_tasks_delete on public.reward_tasks
  for delete using (public.is_family_parent(family_id));

-- reward_ledger: members SELECT; parents INSERT-only (append-only)
drop policy if exists reward_ledger_select on public.reward_ledger;
create policy reward_ledger_select on public.reward_ledger
  for select using (public.is_family_member(family_id));

drop policy if exists reward_ledger_insert on public.reward_ledger;
create policy reward_ledger_insert on public.reward_ledger
  for insert with check (public.is_family_parent(family_id));
