-- Per-child rewards activation (Rewards V2).
-- Applied remotely on project lgiqyybjnjfjxixzennr; this file mirrors that DDL.
-- Family reward_settings.enabled remains optional master; child.enabled gates UX/pending.

alter table public.reward_child_settings
  add column if not exists enabled boolean not null default false;

-- Existing rows already configured: keep them active so current families keep working.
update public.reward_child_settings
  set enabled = true
  where enabled = false;
