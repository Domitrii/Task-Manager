-- Who can do what, held by the server as well as the app.
--
-- Until now the app hid buttons, and only temperature readings were checked
-- here. From now on:
-- - The owner and managers can take someone out of the team. What they did
--   stays on the records under their name; they just can't get in any more.
-- - Someone who isn't a manager can only put their own name on a temperature
--   reading, a delivery or a checklist, whatever their device sends.
-- - Shifts, supplier orders and issue sign-off follow the same rules as the
--   app's screens: managers plan shifts and orders and sign issues off, and
--   everyone else clocks their own shifts and checks orders in. Someone with
--   no shift on the schedule can still clock in, which starts an extra shift
--   in their own name. A time someone clocks is the server's, give or take 15
--   minutes: the app only clocks in and out while online, and hours are paid
--   from these.
--
-- A change someone isn't allowed to make is put right rather than refused, as
-- for readings before: a refused row would fail the whole batch it was sent
-- in, and hold up everything else that device has to send.

/* Taking someone out of the team ------------------------------------------- */

create function public.remove_team_member(team uuid, person uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  my_role text;
  my_manager boolean;
  their_role text;
  their_manager boolean;
begin
  select m.role, m.is_manager into my_role, my_manager
  from public.team_members m where m.team_id = team and m.user_id = me;
  if my_role is null or not (my_role = 'owner' or my_manager) then
    raise exception 'cannot_remove';
  end if;
  if person = me then
    raise exception 'not_yourself';
  end if;

  select m.role, m.is_manager into their_role, their_manager
  from public.team_members m where m.team_id = team and m.user_id = person;
  if their_role is null then
    raise exception 'not_in_team';
  end if;
  -- Nobody can take the owner out. Only the owner can take out a manager.
  if their_role = 'owner' or (their_manager and my_role <> 'owner') then
    raise exception 'cannot_remove';
  end if;

  delete from public.team_members m where m.team_id = team and m.user_id = person;

  -- Their staff record stays, so their name stays on what they did, but they're
  -- no longer listed as working here.
  update public.records r
  set data = r.data || '{"active": false}'::jsonb
  where r.team_id = team and r.collection = 'staff' and not r.deleted and r.data ->> 'userId' = person::text;
end;
$$;

revoke execute on function public.remove_team_member(uuid, uuid) from public, anon;
grant execute on function public.remove_team_member(uuid, uuid) to authenticated;

/* Records ------------------------------------------------------------------ */

-- A time someone clocked, as the device sent it, if it's within 15 minutes of
-- the server's clock; otherwise the server's. Null when nothing was sent.
create function public.clock_time(sent text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  moment timestamptz;
begin
  if sent is null then
    return null;
  end if;
  begin
    moment := sent::timestamptz;
  exception when others then
    moment := null;
  end;
  if moment is null or abs(extract(epoch from moment - now())) > 15 * 60 then
    moment := now();
  end if;
  return to_jsonb(to_char(moment at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
end;
$$;

-- `changed`, with `keys` as they were in `original`, including not being there.
create function public.keep_keys(changed jsonb, original jsonb, keys text[])
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select (changed - keys) || coalesce(
    (select jsonb_object_agg(k, original -> k) from unnest(keys) k where original ? k),
    '{}'::jsonb
  );
$$;

-- As before, plus the rules above. Triggers on `records` run in name order, so
-- this still runs before `records_touch`.
create or replace function public.records_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  manager boolean;
  mine text;
  sent jsonb := new.data;
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := me;
  else
    -- Kept as first written, whatever a device sends.
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;

  -- Without a signed-in person this is the dashboard or an admin script, which
  -- may change anything.
  if me is null then
    return new;
  end if;
  manager := public.is_team_manager(coalesce(old.team_id, new.team_id));

  if tg_op = 'INSERT' then
    -- A device sends new and changed records alike as an insert. One that's
    -- already here is checked as a change, below, once the insert turns into one.
    if manager or exists (
      select 1 from public.records r
      where r.team_id = new.team_id and r.collection = new.collection and r.id = new.id
    ) then
      return new;
    end if;
  end if;

  -- Readings: the app allows 20 minutes. The extra 10 cover a change made just
  -- in time on a slow connection.
  if tg_op = 'UPDATE'
    and old.collection = 'temperatureLogs'
    and (new.data is distinct from old.data or new.deleted is distinct from old.deleted)
    and not manager
    and not coalesce(old.created_by = me and now() < old.created_at + interval '30 minutes', false)
  then
    -- Too late to change it, so it stays as it was. It still counts as
    -- touched, which sends the device that tried the original back.
    return old;
  end if;

  if manager then
    return new;
  end if;

  -- The staff record linked to this account, or the one the app is about to
  -- add for it. This isn't a stable function, so it sees a staff record sent
  -- earlier in the same batch.
  select r.id into mine from public.records r
  where r.team_id = new.team_id and r.collection = 'staff' and not r.deleted and r.data ->> 'userId' = me::text
  limit 1;
  mine := coalesce(mine, 'st_' || me::text);

  if tg_op = 'INSERT' then
    case new.collection
      when 'temperatureLogs' then
        new.data := new.data || jsonb_build_object('recordedBy', mine, 'enteredBy', mine);
      when 'deliveries' then
        new.data := new.data || jsonb_build_object('checkedBy', mine, 'enteredBy', mine);
      when 'checklistRuns' then
        new.data := new.data || jsonb_build_object('completedBy', mine, 'enteredBy', mine);
      when 'shifts' then
        -- Planned by managers only. Clocking in with nothing on the schedule
        -- starts an extra shift: theirs, starting now, and nothing else yet.
        if new.data -> 'unscheduled' = 'true'::jsonb then
          new.data := (new.data - array['clockedOutAt', 'breaks', 'timeCorrections']) || jsonb_strip_nulls(jsonb_build_object(
            'staffId', mine,
            'createdBy', mine,
            'clockedInAt', coalesce(public.clock_time(new.data ->> 'clockedInAt'), public.clock_time(now()::text))
          ));
        else
          return null;
        end if;
      when 'supplierOrders' then
        -- Placed by managers only.
        return null;
      else
        null;
    end case;
    return new;
  end if;

  -- Proof isn't deleted by someone who isn't a manager.
  if new.deleted and not old.deleted
    and old.collection in ('deliveries', 'checklistRuns', 'shifts', 'supplierOrders')
  then
    return old;
  end if;
  if new.deleted then
    return new;
  end if;

  case old.collection
    when 'temperatureLogs' then
      new.data := public.keep_keys(new.data, old.data, array['recordedBy', 'enteredBy']);
    when 'deliveries' then
      new.data := public.keep_keys(new.data, old.data, array['checkedBy', 'enteredBy']);
    when 'checklistRuns' then
      new.data := public.keep_keys(new.data, old.data, array['completedBy', 'enteredBy']);
    when 'shifts' then
      -- Only their own shift, and only the clock: in, breaks, out. A time
      -- that's been recorded stays as it was.
      if old.data ->> 'staffId' is distinct from mine then
        return old;
      end if;
      new.data := (old.data - array['clockedInAt', 'clockedOutAt', 'breaks']) || jsonb_strip_nulls(jsonb_build_object(
        'clockedInAt', coalesce(old.data -> 'clockedInAt', public.clock_time(sent ->> 'clockedInAt')),
        'clockedOutAt', coalesce(old.data -> 'clockedOutAt', public.clock_time(sent ->> 'clockedOutAt')),
        'breaks', case when old.data ? 'clockedOutAt' then old.data -> 'breaks' else sent -> 'breaks' end
      ));
      -- An extra shift's end is when they clocked out.
      if old.data -> 'unscheduled' = 'true'::jsonb and not (old.data ? 'clockedOutAt') and sent ->> 'endTime' ~ '^\d{2}:\d{2}$' then
        new.data := new.data || jsonb_build_object('endTime', sent -> 'endTime');
      end if;
    when 'supplierOrders' then
      -- Checking an order in is all they can do to one.
      if old.data ->> 'status' = 'open' and new.data ->> 'status' = 'received' then
        new.data := old.data || jsonb_strip_nulls(jsonb_build_object(
          'status', 'received',
          'receivedAt', new.data -> 'receivedAt',
          'receivedBy', mine,
          'deliveryId', new.data -> 'deliveryId',
          'lines', new.data -> 'lines'
        ));
      else
        return old;
      end if;
    when 'issues' then
      -- Only a manager signs an issue off.
      new.data := public.keep_keys(new.data, old.data, array['signedOffBy', 'signedOffAt']);
      if coalesce((old.data ->> 'needsSignOff')::boolean, false)
        and not coalesce((new.data ->> 'needsSignOff')::boolean, false)
        and new.data ->> 'status' = 'resolved'
      then
        new.data := new.data || '{"needsSignOff": true}'::jsonb;
      end if;
    else
      null;
  end case;
  return new;
end;
$$;
