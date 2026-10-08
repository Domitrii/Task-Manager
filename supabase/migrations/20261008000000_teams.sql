-- Teams.
--
-- Until now a venue was one shared Supabase account. From here each person has
-- their own account and belongs to a team, and the team owns the records.
-- Someone creates a team and shares its code; everyone else joins with it.
--
-- A person is in one team at a time. Leaving lets them join another.

create table public.teams (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null check (length(btrim(name)) between 1 and 80),
  -- What people type to join: 8 characters, no 0/O or 1/I to misread.
  join_code  text        not null unique,
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id   uuid        not null references public.teams (id) on delete cascade,
  user_id   uuid        not null references auth.users (id) on delete cascade,
  -- The owner can change the code. Everyone can see it and share it.
  role      text        not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id),
  unique (user_id)
);

create function public.new_join_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := uuid_send(gen_random_uuid());
  code text := '';
begin
  -- 32 characters, so each byte mod 32 is unbiased.
  for i in 0..7 loop
    code := code || substr(alphabet, get_byte(bytes, i) % 32 + 1, 1);
  end loop;
  return code;
end;
$$;

-- For policies: true when the signed-in person is in `team`. Security definer
-- so the check itself isn't filtered by team_members' own policy.
create function public.is_team_member(team uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members
    where team_id = team and user_id = (select auth.uid())
  );
$$;

/* Existing venues ----------------------------------------------------------- */

-- Each account that already has records becomes a team with the same id, owned
-- by that account, named after the venue in its settings. Devices that had it
-- open carry on with the same records.
insert into public.teams (id, name, join_code)
select
  venues.venue_id,
  coalesce(nullif(btrim(settings.data ->> 'venueName'), ''), 'My venue'),
  public.new_join_code()
from (select distinct venue_id from public.records) venues
left join public.records settings
  on settings.venue_id = venues.venue_id
  and settings.collection = 'settings'
  and settings.id = 'venue'
  and not settings.deleted;

insert into public.team_members (team_id, user_id, role)
select id, id, 'owner' from public.teams
where exists (select 1 from auth.users where auth.users.id = teams.id);

/* Records belong to a team -------------------------------------------------- */

drop policy "Venue reads its records" on public.records;
drop policy "Venue adds records" on public.records;
drop policy "Venue updates its records" on public.records;

alter table public.records drop constraint records_venue_id_fkey;
alter table public.records alter column venue_id drop default;
alter table public.records rename column venue_id to team_id;
alter index public.records_venue_updated_at_idx rename to records_team_updated_at_idx;
alter table public.records
  add constraint records_team_id_fkey foreign key (team_id) references public.teams (id) on delete cascade;

create policy "Team reads its records"
on public.records for select
to authenticated
using ((select public.is_team_member(team_id)));

create policy "Team adds records"
on public.records for insert
to authenticated
with check ((select public.is_team_member(team_id)));

create policy "Team updates its records"
on public.records for update
to authenticated
using ((select public.is_team_member(team_id)))
with check ((select public.is_team_member(team_id)));

/* Who sees what ------------------------------------------------------------- */

-- No insert, update or delete policies: those go through the functions below,
-- which check the code and the role.
alter table public.teams enable row level security;
alter table public.team_members enable row level security;

create policy "Members see their team"
on public.teams for select
to authenticated
using ((select public.is_team_member(id)));

create policy "People see their own membership"
on public.team_members for select
to authenticated
using (user_id = (select auth.uid()));

/* Creating, joining and leaving -------------------------------------------- */

-- Errors are raised with a short code as the message, which the app turns into words.

create function public.create_team(team_name text)
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
  return team;
end;
$$;

create function public.join_team(code text)
returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  team public.teams;
  current_team uuid;
begin
  if me is null then
    raise exception 'not_signed_in';
  end if;

  -- People type codes with spaces, dashes and in lower case.
  select * into team from public.teams
  where join_code = upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'));
  if team.id is null then
    raise exception 'invalid_code';
  end if;

  select team_id into current_team from public.team_members where user_id = me;
  if current_team = team.id then
    return team;
  end if;
  if current_team is not null then
    raise exception 'already_in_team';
  end if;

  insert into public.team_members (team_id, user_id, role) values (team.id, me, 'member');
  return team;
end;
$$;

-- A new code stops the old one working, for when it has been shared too widely.
create function public.regenerate_join_code(team uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  code text;
begin
  if not exists (
    select 1 from public.team_members
    where team_id = team and user_id = (select auth.uid()) and role = 'owner'
  ) then
    raise exception 'not_owner';
  end if;

  loop
    begin
      update public.teams set join_code = public.new_join_code() where id = team
      returning join_code into code;
      return code;
    exception when unique_violation then
    end;
  end loop;
end;
$$;

-- The team and its records stay for everyone else. An owner who leaves hands
-- the team to whoever has been in it longest.
create function public.leave_team()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  left_team uuid;
  left_role text;
begin
  delete from public.team_members where user_id = me
  returning team_id, role into left_team, left_role;

  if left_role = 'owner' then
    update public.team_members set role = 'owner'
    where (team_id, user_id) = (
      select team_id, user_id from public.team_members
      where team_id = left_team
      order by joined_at
      limit 1
    );
  end if;
end;
$$;

-- Only signed-in people may call these; the helpers aren't for calling directly.
revoke execute on function public.new_join_code() from public, anon, authenticated;
revoke execute on function public.create_team(text) from public, anon;
revoke execute on function public.join_team(text) from public, anon;
revoke execute on function public.regenerate_join_code(uuid) from public, anon;
revoke execute on function public.leave_team() from public, anon;
grant execute on function public.create_team(text) to authenticated;
grant execute on function public.join_team(text) to authenticated;
grant execute on function public.regenerate_join_code(uuid) to authenticated;
grant execute on function public.leave_team() to authenticated;
