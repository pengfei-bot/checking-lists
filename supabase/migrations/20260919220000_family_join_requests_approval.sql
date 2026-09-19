-- Parent approval before a child device fully joins a family.
-- redeem_family_invite creates a pending join request (no family_members row)
-- until a parent approves. Pending users are not is_family_member → no family data.

create table if not exists public.family_join_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null default 'Appareil enfant',
  status text not null default 'pending'
    check (status = any (array['pending'::text, 'approved'::text, 'refused'::text])),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null
);

create unique index if not exists family_join_requests_pending_unique
  on public.family_join_requests (family_id, user_id)
  where (status = 'pending');

create index if not exists family_join_requests_family_status_idx
  on public.family_join_requests (family_id, status, created_at desc);

create index if not exists family_join_requests_user_idx
  on public.family_join_requests (user_id, created_at desc);

alter table public.family_join_requests enable row level security;

-- Parents see requests for their family; requester sees own rows.
drop policy if exists join_requests_select on public.family_join_requests;
create policy join_requests_select on public.family_join_requests
  for select using (
    public.is_family_parent(family_id) or user_id = auth.uid()
  );

-- Mutations only via SECURITY DEFINER RPCs (no direct client insert/update/delete).
revoke insert, update, delete on public.family_join_requests from anon, authenticated;
grant select on public.family_join_requests to authenticated;

-- Replace redeem: create pending request instead of immediate membership.
-- Must DROP first: return type changes from uuid → jsonb.
drop function if exists public.redeem_family_invite(text, text);
create or replace function public.redeem_family_invite(
  p_code text,
  p_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_family public.families%rowtype;
  v_norm text := upper(trim(p_code));
  v_name text := coalesce(nullif(trim(p_display_name), ''), 'Appareil enfant');
  v_req public.family_join_requests%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_family from public.families where invite_code = v_norm;
  if v_family.id is null then
    raise exception 'invalid invite code';
  end if;

  -- Already a member → treat as approved (idempotent re-link).
  if exists (
    select 1 from public.family_members m
    where m.family_id = v_family.id and m.user_id = v_uid
  ) then
    return jsonb_build_object(
      'status', 'approved',
      'family_id', v_family.id,
      'family_name', v_family.name,
      'request_id', null
    );
  end if;

  -- Reuse existing pending request for this family.
  select * into v_req
  from public.family_join_requests
  where family_id = v_family.id and user_id = v_uid and status = 'pending'
  order by created_at desc
  limit 1;

  if v_req.id is null then
    insert into public.family_join_requests (family_id, user_id, display_name, status)
    values (v_family.id, v_uid, left(v_name, 40), 'pending')
    returning * into v_req;
  else
    update public.family_join_requests
    set display_name = left(v_name, 40)
    where id = v_req.id
    returning * into v_req;
  end if;

  return jsonb_build_object(
    'status', 'pending',
    'family_id', v_family.id,
    'family_name', v_family.name,
    'request_id', v_req.id
  );
end;
$$;

revoke all on function public.redeem_family_invite(text, text) from public;
grant execute on function public.redeem_family_invite(text, text) to authenticated;

-- Child polls own request status (and discovers approval without family data access).
create or replace function public.get_my_join_request(p_request_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.family_join_requests%rowtype;
  v_family_name text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_request_id is not null then
    select * into v_req
    from public.family_join_requests
    where id = p_request_id and user_id = v_uid;
  else
    select * into v_req
    from public.family_join_requests
    where user_id = v_uid
    order by created_at desc
    limit 1;
  end if;

  if v_req.id is null then
    -- Maybe already approved as member (request row cleaned / old flow).
    if exists (select 1 from public.family_members where user_id = v_uid) then
      return jsonb_build_object('status', 'approved', 'family_id', (
        select family_id from public.family_members where user_id = v_uid limit 1
      ));
    end if;
    return jsonb_build_object('status', 'none');
  end if;

  select name into v_family_name from public.families where id = v_req.family_id;

  return jsonb_build_object(
    'status', v_req.status,
    'request_id', v_req.id,
    'family_id', v_req.family_id,
    'family_name', coalesce(v_family_name, ''),
    'display_name', v_req.display_name,
    'created_at', v_req.created_at,
    'resolved_at', v_req.resolved_at
  );
end;
$$;

revoke all on function public.get_my_join_request(uuid) from public;
grant execute on function public.get_my_join_request(uuid) to authenticated;

create or replace function public.approve_family_join_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.family_join_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_req from public.family_join_requests where id = p_request_id for update;
  if v_req.id is null then
    raise exception 'request not found';
  end if;
  if not public.is_family_parent(v_req.family_id) then
    raise exception 'not a parent of this family';
  end if;
  if v_req.status <> 'pending' then
    return jsonb_build_object(
      'status', v_req.status,
      'request_id', v_req.id,
      'family_id', v_req.family_id
    );
  end if;

  insert into public.family_members (family_id, user_id, role, display_name)
  values (v_req.family_id, v_req.user_id, 'child_device', v_req.display_name)
  on conflict (family_id, user_id) do update
    set role = excluded.role,
        display_name = excluded.display_name;

  update public.family_join_requests
  set status = 'approved',
      resolved_at = now(),
      resolved_by = v_uid
  where id = v_req.id;

  return jsonb_build_object(
    'status', 'approved',
    'request_id', v_req.id,
    'family_id', v_req.family_id
  );
end;
$$;

revoke all on function public.approve_family_join_request(uuid) from public;
grant execute on function public.approve_family_join_request(uuid) to authenticated;

create or replace function public.refuse_family_join_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.family_join_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_req from public.family_join_requests where id = p_request_id for update;
  if v_req.id is null then
    raise exception 'request not found';
  end if;
  if not public.is_family_parent(v_req.family_id) then
    raise exception 'not a parent of this family';
  end if;
  if v_req.status <> 'pending' then
    return jsonb_build_object(
      'status', v_req.status,
      'request_id', v_req.id,
      'family_id', v_req.family_id
    );
  end if;

  update public.family_join_requests
  set status = 'refused',
      resolved_at = now(),
      resolved_by = v_uid
  where id = v_req.id;

  return jsonb_build_object(
    'status', 'refused',
    'request_id', v_req.id,
    'family_id', v_req.family_id
  );
end;
$$;

revoke all on function public.refuse_family_join_request(uuid) from public;
grant execute on function public.refuse_family_join_request(uuid) to authenticated;

-- Parent helper: list pending (also readable via RLS SELECT).
create or replace function public.list_family_join_requests(p_family_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_family_parent(p_family_id) then
    raise exception 'not a parent of this family';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'family_id', r.family_id,
          'user_id', r.user_id,
          'display_name', r.display_name,
          'status', r.status,
          'created_at', r.created_at,
          'resolved_at', r.resolved_at
        )
        order by r.created_at asc
      )
      from public.family_join_requests r
      where r.family_id = p_family_id and r.status = 'pending'
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.list_family_join_requests(uuid) from public;
grant execute on function public.list_family_join_requests(uuid) to authenticated;

-- Clean join requests when parent deletes account / family.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
  fid uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  for fid in
    select family_id from public.family_members
    where user_id = uid and role = 'parent'
  loop
    delete from public.family_join_requests where family_id = fid;
    delete from public.task_completions where family_id = fid;
    delete from public.tasks where family_id = fid;
    delete from public.child_profiles where family_id = fid;
    delete from public.family_members where family_id = fid;
    delete from public.families where id = fid;
  end loop;

  delete from public.family_join_requests where user_id = uid;
  delete from public.family_members where user_id = uid;
  delete from auth.users where id = uid;
end;
$$;
