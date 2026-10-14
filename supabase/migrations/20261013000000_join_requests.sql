-- Joining a team needs approval.
--
-- A team code no longer lets someone straight in. It sends a request, with the
-- role they do at the venue, and the team's owner (or anyone the owner allows)
-- approves or declines it. Until then they can't see any of the team's records.

alter table public.team_members
  -- What they said they do when they asked to join: one of the app's staff
  -- roles (`head_chef`) or their own words (`Sous chef`). Null for whoever
  -- created the team.
  add column job_role text check (job_role is null or length(btrim(job_role)) between 1 and 60),
  -- Set by the owner. The owner can always approve.
  add column can_approve boolean not null default false;

-- One request per person at a time; asking another team replaces it.
create table public.join_requests (
  user_id      uuid        primary key references auth.users (id) on delete cascade,
  team_id      uuid        not null references public.teams (id) on delete cascade,
  job_role     text        not null check (length(btrim(job_role)) between 1 and 60),
  -- Declined requests stay until the person has seen the answer.
  status       text        not null default 'pending' check (status in ('pending', 'declined')),
  requested_at timestamptz not null default now()
);

create index join_requests_team_idx on public.join_requests (team_id) where status = 'pending';

-- No policies: everything goes through the functions below.
alter table public.join_requests enable row level security;

-- The code alone no longer gets anyone in.
drop function public.join_team(text);

/* Helpers ------------------------------------------------------------------ */

create function public.can_approve_joins(team uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members m
    where m.team_id = team and m.user_id = (select auth.uid()) and (m.role = 'owner' or m.can_approve)
  );
$$;

/* Asking to join ----------------------------------------------------------- */

-- Which team a code belongs to, so the person can check it's the right one
-- before saying what they do there.
create function public.find_team(code text)
returns table (id uuid, name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not_signed_in';
  end if;
  if exists (select 1 from public.team_members m where m.user_id = me) then
    raise exception 'already_in_team';
  end if;

  -- People type codes with spaces, dashes and in lower case.
  return query
  select t.id, t.name from public.teams t
  where t.join_code = upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'));
  if not found then
    raise exception 'invalid_code';
  end if;
end;
$$;

create function public.request_to_join(code text, job_role text)
returns table (id uuid, name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  asked text := btrim(coalesce(job_role, ''));
  team record;
begin
  select * into team from public.find_team(code);
  if length(asked) not between 1 and 60 then
    raise exception 'role_required';
  end if;

  insert into public.join_requests (user_id, team_id, job_role)
  values (me, team.id, asked)
  on conflict (user_id) do update
  set team_id = excluded.team_id, job_role = excluded.job_role, status = 'pending', requested_at = now();

  return query select team.id, team.name;
end;
$$;

-- The signed-in person's request, if they have one, with the team's name
-- (which they can't otherwise see until they're in).
create function public.my_join_request()
returns table (team_id uuid, team_name text, job_role text, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.team_id, t.name, r.job_role, r.status
  from public.join_requests r
  join public.teams t on t.id = r.team_id
  where r.user_id = (select auth.uid());
$$;

create function public.cancel_join_request()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.join_requests where user_id = (select auth.uid());
$$;

/* Letting people in -------------------------------------------------------- */

-- Pending requests, for whoever can approve them. Nobody else gets any rows.
-- The email is there so they can tell who's asking.
create function public.team_join_requests(team uuid)
returns table (user_id uuid, name text, email text, job_role text, requested_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.user_id, coalesce(btrim(u.raw_user_meta_data ->> 'full_name'), ''), u.email::text, r.job_role, r.requested_at
  from public.join_requests r
  join auth.users u on u.id = r.user_id
  where r.team_id = team and r.status = 'pending' and public.can_approve_joins(team)
  order by r.requested_at;
$$;

create function public.approve_join_request(team uuid, person uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  asked text;
begin
  if not public.can_approve_joins(team) then
    raise exception 'not_allowed';
  end if;

  -- Taking the request and adding them happen together, so two people
  -- approving at once can't both do it.
  delete from public.join_requests r
  where r.user_id = person and r.team_id = team and r.status = 'pending'
  returning r.job_role into asked;
  if asked is null then
    raise exception 'request_gone';
  end if;

  insert into public.team_members (team_id, user_id, role, job_role) values (team, person, 'member', asked);
end;
$$;

create function public.decline_join_request(team uuid, person uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_approve_joins(team) then
    raise exception 'not_allowed';
  end if;

  update public.join_requests r set status = 'declined'
  where r.user_id = person and r.team_id = team and r.status = 'pending';
  if not found then
    raise exception 'request_gone';
  end if;
end;
$$;

/* Who's in the team -------------------------------------------------------- */

create function public.team_people(team uuid)
returns table (user_id uuid, name text, job_role text, role text, can_approve boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, coalesce(btrim(u.raw_user_meta_data ->> 'full_name'), ''), m.job_role, m.role, m.can_approve
  from public.team_members m
  join auth.users u on u.id = m.user_id
  where m.team_id = team and public.is_team_member(team)
  order by m.joined_at;
$$;

-- The owner chooses who else can approve new people.
create function public.set_join_approver(team uuid, person uuid, allowed boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.team_members m
    where m.team_id = team and m.user_id = (select auth.uid()) and m.role = 'owner'
  ) then
    raise exception 'not_owner';
  end if;

  update public.team_members m set can_approve = coalesce(allowed, false)
  where m.team_id = team and m.user_id = person and m.role <> 'owner';
  if not found then
    raise exception 'not_in_team';
  end if;
end;
$$;

/* Creating a team ---------------------------------------------------------- */

-- As before, and anything they'd asked to join is dropped: they're in their own team now.
create or replace function public.create_team(team_name text)
returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  team public.teams;
begin
  if me is null then
    raise exception 'not_signed_in';
  end if;
  if exists (select 1 from public.team_members where user_id = me) then
    raise exception 'already_in_team';
  end if;
  if length(btrim(coalesce(team_name, ''))) = 0 then
    raise exception 'name_required';
  end if;

  loop
    begin
      insert into public.teams (name, join_code)
      values (btrim(team_name), public.new_join_code())
      returning * into team;
      exit;
    exception when unique_violation then
      -- Another team has this code already: draw again.
    end;
  end loop;

  insert into public.team_members (team_id, user_id, role) values (team.id, me, 'owner');
  delete from public.join_requests where user_id = me;
  return team;
end;
$$;

/* Who may call what -------------------------------------------------------- */

revoke execute on function public.can_approve_joins(uuid) from public, anon, authenticated;

revoke execute on function public.find_team(text) from public, anon;
revoke execute on function public.request_to_join(text, text) from public, anon;
revoke execute on function public.my_join_request() from public, anon;
revoke execute on function public.cancel_join_request() from public, anon;
revoke execute on function public.team_join_requests(uuid) from public, anon;
revoke execute on function public.approve_join_request(uuid, uuid) from public, anon;
revoke execute on function public.decline_join_request(uuid, uuid) from public, anon;
revoke execute on function public.team_people(uuid) from public, anon;
revoke execute on function public.set_join_approver(uuid, uuid, boolean) from public, anon;

grant execute on function public.find_team(text) to authenticated;
grant execute on function public.request_to_join(text, text) to authenticated;
grant execute on function public.my_join_request() to authenticated;
grant execute on function public.cancel_join_request() to authenticated;
grant execute on function public.team_join_requests(uuid) to authenticated;
grant execute on function public.approve_join_request(uuid, uuid) to authenticated;
grant execute on function public.decline_join_request(uuid, uuid) to authenticated;
grant execute on function public.team_people(uuid) to authenticated;
grant execute on function public.set_join_approver(uuid, uuid, boolean) to authenticated;
