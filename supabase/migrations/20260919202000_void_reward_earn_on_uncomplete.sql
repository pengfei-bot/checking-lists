-- When a completion is deleted (uncomplete), void any credited earn with an
-- append-only adjust so child/parent solde drops. Children cannot INSERT into
-- reward_ledger (parent-only RLS), so this runs as SECURITY DEFINER.

create or replace function public.void_reward_earn_on_uncomplete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  earn_row public.reward_ledger%rowtype;
begin
  select * into earn_row
  from public.reward_ledger
  where completion_id = old.id
    and kind = 'earn'
  order by created_at asc
  limit 1;

  if not found then
    return old;
  end if;

  -- Idempotent: do not double-void the same completion
  if exists (
    select 1
    from public.reward_ledger
    where completion_id = old.id
      and kind = 'adjust'
      and note = 'void_uncomplete'
  ) then
    return old;
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
    earn_row.family_id,
    earn_row.child_profile_id,
    -earn_row.amount,
    'adjust',
    earn_row.task_id,
    old.id,
    'void_uncomplete'
  );

  return old;
end;
$$;

drop trigger if exists trg_void_reward_earn_on_uncomplete on public.task_completions;
create trigger trg_void_reward_earn_on_uncomplete
  before delete on public.task_completions
  for each row
  execute function public.void_reward_earn_on_uncomplete();

comment on function public.void_reward_earn_on_uncomplete() is
  'Append adjust (-earn) when a completion with a credited reward is deleted (uncomplete).';
