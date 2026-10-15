-- Managers, and proof for temperature readings.
--
-- The owner chooses who else is a manager. Managers (and the owner) can change
-- any temperature reading at any time; everyone else can change only readings
-- they entered themselves, and only for a short while afterwards. Every reading
-- comes with a photo, kept in Storage, which only managers and whoever took it
-- can look at.

/* Managers ----------------------------------------------------------------- */

alter table public.team_members add column is_manager boolean not null default false;

-- For policies and the functions below: the owner is always a manager.
create function public.is_team_manager(team uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members m
    where m.team_id = team and m.user_id = (select auth.uid()) and (m.role = 'owner' or m.is_manager)
  );
$$;

create function public.set_team_manager(team uuid, person uuid, allowed boolean)
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

  update public.team_members m set is_manager = coalesce(allowed, false)
  where m.team_id = team and m.user_id = person and m.role <> 'owner';
  if not found then
    raise exception 'not_in_team';
  end if;
end;
$$;

-- As before, now saying who's a manager. Its columns change, so it's made again.
drop function public.team_people(uuid);

create function public.team_people(team uuid)
returns table (user_id uuid, name text, job_role text, role text, can_approve boolean, is_manager boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.user_id,
    coalesce(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
    m.job_role,
    m.role,
    m.can_approve,
    m.is_manager
  from public.team_members m
  join auth.users u on u.id = m.user_id
  where m.team_id = team and public.is_team_member(team)
  order by m.joined_at;
$$;

/* Who entered a record, and when ------------------------------------------- */

-- Set by the server when a record first arrives, never by the device. Records
-- from before this have no author, so only managers can change those readings.
alter table public.records
  add column created_at timestamptz not null default now(),
  add column created_by uuid references auth.users (id) on delete set null;

-- Runs before `records_touch` (triggers go in name order), so a change it
-- turns away still gets a new `updated_at`.
create function public.records_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := me;
    return new;
  end if;

  -- Kept as first written, whatever a device sends.
  new.created_at := old.created_at;
  new.created_by := old.created_by;

  -- The app allows 20 minutes. The extra 10 cover a change made just in time
  -- on a slow connection. Without a signed-in person this is the dashboard or
  -- an admin script, which may change anything.
  if me is not null
    and old.collection = 'temperatureLogs'
    and (new.data is distinct from old.data or new.deleted is distinct from old.deleted)
    and not public.is_team_manager(old.team_id)
    and not coalesce(old.created_by = me and now() < old.created_at + interval '30 minutes', false)
  then
    -- Too late to change it, so it stays as it was. It still counts as
    -- touched, which sends the device that tried the original back.
    return old;
  end if;
  return new;
end;
$$;

create trigger records_guard
before insert or update on public.records
for each row execute function public.records_guard();

/* Photos ------------------------------------------------------------------- */

-- Private: the app downloads each photo with the person's own session.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reading-photos', 'reading-photos', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

-- Photos are kept at `<team id>/<file>`. Anyone in the team can add one. Only
-- managers and whoever took it can look at it, and nobody can change or
-- delete one, so the proof stays as it was taken.
create policy "Team adds reading photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'reading-photos'
  and exists (
    select 1 from public.team_members m
    where m.user_id = (select auth.uid()) and m.team_id::text = (storage.foldername(objects.name))[1]
  )
);

create policy "Managers and whoever took it see reading photos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'reading-photos'
  and exists (
    select 1 from public.team_members m
    where m.user_id = (select auth.uid())
      and m.team_id::text = (storage.foldername(objects.name))[1]
      and (m.role = 'owner' or m.is_manager or objects.owner_id = (select auth.uid())::text)
  )
);

/* Who may call what -------------------------------------------------------- */

revoke execute on function public.set_team_manager(uuid, uuid, boolean) from public, anon;
revoke execute on function public.team_people(uuid) from public, anon;
grant execute on function public.set_team_manager(uuid, uuid, boolean) to authenticated;
grant execute on function public.team_people(uuid) to authenticated;
