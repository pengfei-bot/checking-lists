-- Per-child reward unit (points vs money). Family unit_label kept for compat.
-- Applied remotely on project lgiqyybjnjfjxixzennr; this file mirrors that DDL.

create table if not exists public.reward_child_settings (
  child_profile_id uuid primary key references public.child_profiles (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  unit_kind text not null default 'points' check (unit_kind = any (array['points'::text, 'money'::text])),
  updated_at timestamptz not null default now()
);

create index if not exists reward_child_settings_family_id_idx
  on public.reward_child_settings (family_id);

alter table public.reward_child_settings enable row level security;

drop policy if exists reward_child_settings_select on public.reward_child_settings;
create policy reward_child_settings_select on public.reward_child_settings
  for select using (public.is_family_member(family_id));

drop policy if exists reward_child_settings_insert on public.reward_child_settings;
create policy reward_child_settings_insert on public.reward_child_settings
  for insert with check (public.is_family_parent(family_id));

drop policy if exists reward_child_settings_update on public.reward_child_settings;
create policy reward_child_settings_update on public.reward_child_settings
  for update using (public.is_family_parent(family_id))
  with check (public.is_family_parent(family_id));

drop policy if exists reward_child_settings_delete on public.reward_child_settings;
create policy reward_child_settings_delete on public.reward_child_settings
  for delete using (public.is_family_parent(family_id));
