-- Auto-credit reward_ledger earn when a rewarded task is completed.
-- Children cannot INSERT into reward_ledger (parent-only RLS), so this runs as
-- SECURITY DEFINER — same pattern as void_reward_earn_on_uncomplete.
-- Parent validation / pending queue is removed; balance updates immediately.

create or replace function public.credit_reward_earn_on_complete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pts integer;
  child_on boolean;
  family_on boolean;
begin
  -- Optional family master switch: explicit false disables all credits.
  select rs.enabled into family_on
  from public.reward_settings rs
  where rs.family_id = new.family_id;

  if found and family_on = false then
    return new;
  end if;

  -- Per-child gate (missing row or enabled=false ⇒ no credit).
  select rcs.enabled into child_on
  from public.reward_child_settings rcs
  where rcs.child_profile_id = new.child_profile_id;

  if not found or child_on is distinct from true then
    return new;
  end if;

  select rt.points into pts
  from public.reward_tasks rt
  where rt.task_id = new.task_id
    and rt.active = true
    and rt.points > 0;

  if not found then
    return new;
  end if;

  -- Idempotent: one earn per completion_id (re-complete uses a new row).
  if exists (
    select 1
    from public.reward_ledger e
    where e.completion_id = new.id
      and e.kind = 'earn'
  ) then
    return new;
  end if;

  insert into public.reward_ledger (
    family_id,
    child_profile_id,
    amount,
    kind,
    task_id,
    completion_id,
    note
  ) values (
    new.family_id,
    new.child_profile_id,
    pts,
    'earn',
    new.task_id,
    new.id,
    'auto_complete'
  );

  return new;
end;
$$;

drop trigger if exists trg_credit_reward_earn_on_complete on public.task_completions;
create trigger trg_credit_reward_earn_on_complete
  after insert on public.task_completions
  for each row
  execute function public.credit_reward_earn_on_complete();

comment on function public.credit_reward_earn_on_complete() is
  'Append earn when a completion is inserted for an active rewarded task (no parent validation).';

-- Backfill: credit any still-pending completions (had points, child active, no earn yet).
insert into public.reward_ledger (
  family_id,
  child_profile_id,
  amount,
  kind,
  task_id,
  completion_id,
  note
)
select
  tc.family_id,
  tc.child_profile_id,
  rt.points,
  'earn',
  tc.task_id,
  tc.id,
  'auto_complete_backfill'
from public.task_completions tc
inner join public.reward_tasks rt
  on rt.task_id = tc.task_id
 and rt.active = true
 and rt.points > 0
inner join public.reward_child_settings rcs
  on rcs.child_profile_id = tc.child_profile_id
 and rcs.enabled = true
left join public.reward_settings rs
  on rs.family_id = tc.family_id
where (rs.family_id is null or rs.enabled = true)
  and not exists (
    select 1
    from public.reward_ledger e
    where e.completion_id = tc.id
      and e.kind = 'earn'
  );
