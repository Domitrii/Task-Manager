-- Reminders that reach a phone with Mise closed.
--
-- A browser only shows a notification by itself while the app is running. To
-- reach a closed one, each device that allows notifications registers here with
-- its browser's push service (a "subscription"). Every minute a scheduled job
-- calls the `send-reminders` Edge Function, which asks `due_reminder_pushes`
-- whose reminders have just gone off and sends each one through Web Push.
--
-- Reminders live on each person's staff record (`reminders` in its data) and go
-- off by the clock where their device is, so each subscription says its time
-- zone. A reminder is only sent within 10 minutes of its time, so a job that
-- stops for an hour doesn't send an hour of stale reminders when it starts.

create table public.push_subscriptions (
  -- The push service's address for this browser on this device.
  endpoint   text        primary key,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  team_id    uuid        not null references public.teams (id) on delete cascade,
  -- Keys the message is encrypted with, from the browser.
  p256dh     text        not null,
  auth       text        not null,
  -- Where the device is, e.g. `Europe/London`.
  time_zone  text        not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- A time zone Postgres doesn't know would stop every reminder, not just this
-- device's, so it's refused on the way in.
create function public.push_subscriptions_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform now() at time zone new.time_zone;
  new.updated_at := now();
  return new;
end;
$$;

create trigger push_subscriptions_check
before insert or update on public.push_subscriptions
for each row execute function public.push_subscriptions_check();

alter table public.push_subscriptions enable row level security;

create policy "People keep their own devices"
on public.push_subscriptions for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()) and (select public.is_team_member(team_id)));

-- What has been sent to which device, so each reminder goes once. Only the
-- Edge Function, with the service role, reads or writes it.
create table public.push_sent (
  endpoint     text        not null references public.push_subscriptions (endpoint) on delete cascade,
  reminder_key text        not null,
  sent_at      timestamptz not null default now(),
  primary key (endpoint, reminder_key)
);

alter table public.push_sent enable row level security;

-- Someone who leaves a team, or is taken out of it, stops hearing from it.
create function public.push_subscriptions_leave()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.push_subscriptions s where s.user_id = old.user_id and s.team_id = old.team_id;
  return old;
end;
$$;

create trigger push_subscriptions_leave
after delete on public.team_members
for each row execute function public.push_subscriptions_leave();

-- Every reminder that went off in the last 10 minutes on a device's clock and
-- hasn't been sent to that device. The rules are the app's (`wentOffToday` in
-- `src/data/reminders.ts`), and the key is the bell's, so a notification from
-- here and one from the open app replace each other instead of doubling up.
create function public.due_reminder_pushes(moment timestamptz default now())
returns table (endpoint text, p256dh text, auth text, reminder_key text, title text)
language sql
stable
security definer
set search_path = ''
as $$
  with reminders as (
    select
      s.endpoint,
      s.p256dh,
      s.auth,
      s.time_zone,
      (moment at time zone s.time_zone) as local_now,
      r.value as reminder
    from public.push_subscriptions s
    join public.records st
      on st.team_id = s.team_id
      and st.collection = 'staff'
      and not st.deleted
      and st.data ->> 'userId' = s.user_id::text
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(st.data -> 'reminders') = 'array' then st.data -> 'reminders' else '[]'::jsonb end
    ) r
    where coalesce((r.value ->> 'on')::boolean, false)
      and r.value ->> 'time' ~ '^\d{2}:\d{2}$'
  ),
  today as (
    select
      x.*,
      x.local_now::date + (x.reminder ->> 'time')::time as local_at,
      'reminder:' || (x.reminder ->> 'id') || ':' || to_char(x.local_now, 'YYYY-MM-DD') || ':' || (x.reminder ->> 'time') as reminder_key
    from reminders x
    where case
      when x.reminder ->> 'date' is not null then (x.reminder ->> 'date') = to_char(x.local_now, 'YYYY-MM-DD')
      else coalesce(x.reminder -> 'days', '[]'::jsonb) @> to_jsonb(extract(dow from x.local_now)::int)
    end
  )
  select t.endpoint, t.p256dh, t.auth, t.reminder_key,
    coalesce(nullif(btrim(t.reminder ->> 'note'), ''), 'Check all the details')
  from today t
  where t.local_at <= t.local_now
    and t.local_at > t.local_now - interval '10 minutes'
    -- Not for a time already past when it was set, as in the app.
    and (t.local_at at time zone t.time_zone) >= (t.reminder ->> 'setAt')::timestamptz
    and not exists (
      select 1 from public.push_sent p where p.endpoint = t.endpoint and p.reminder_key = t.reminder_key
    );
$$;

revoke execute on function public.due_reminder_pushes(timestamptz) from public, anon, authenticated;
grant execute on function public.due_reminder_pushes(timestamptz) to service_role;
