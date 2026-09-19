-- Backfill per-child settings for families that already use rewards.
-- Applied remotely on project lgiqyybjnjfjxixzennr as reward_child_settings_backfill
-- (version 20260919081549); this file mirrors that DML for local / future envs.

insert into public.reward_child_settings (child_profile_id, family_id, unit_kind, enabled, updated_at)
select cp.id, cp.family_id, 'points', true, now()
from public.child_profiles cp
inner join public.reward_settings rs on rs.family_id = cp.family_id and rs.enabled = true
where not exists (
  select 1 from public.reward_child_settings rcs where rcs.child_profile_id = cp.id
)
on conflict (child_profile_id) do nothing;
