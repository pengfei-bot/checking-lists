-- Proof photo required flag on tasks
alter table public.tasks
  add column if not exists photo_required boolean not null default false;

comment on column public.tasks.photo_required is
  ''When true, child should attach a proof photo to complete the task.'';
