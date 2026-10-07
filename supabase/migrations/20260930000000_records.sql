-- Mise sync store.
--
-- Every record in the app (a temperature log, a delivery, a fridge, the venue
-- settings…) is one row here, keyed by the collection it belongs to on
-- `AppData` and its own id. Devices merge record by record, so two phones that
-- log readings offline both keep theirs when they reconnect.
--
-- A venue is one Supabase account: `venue_id` is that account's user id. Every
-- device signed in to it shares the same records.

create table public.records (
  venue_id   uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  collection text        not null,
  id         text        not null,
  -- The record exactly as the app holds it. Null once deleted.
  data       jsonb,
  -- Deletes are kept as tombstones so devices that were offline hear about them.
  deleted    boolean     not null default false,
  -- Position in lists the app keeps in entry order (equipment, staff…), so a
  -- new device shows them in the same order. Null where the app sorts by time.
  sort       double precision,
  -- Set by the server, never the device, so a phone with a wrong clock can't
  -- hide its changes from the others.
  updated_at timestamptz not null default clock_timestamp(),
  primary key (venue_id, collection, id)
);

-- Devices ask "what changed since I last looked?"
create index records_venue_updated_at_idx on public.records (venue_id, updated_at);

create function public.records_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger records_touch
before insert or update on public.records
for each row execute function public.records_touch();

-- Only the venue's own account can see or change its records. There is no
-- delete policy: the app never hard-deletes, it writes a tombstone.
alter table public.records enable row level security;

create policy "Venue reads its records"
on public.records for select
to authenticated
using (venue_id = (select auth.uid()));

create policy "Venue adds records"
on public.records for insert
to authenticated
with check (venue_id = (select auth.uid()));

create policy "Venue updates its records"
on public.records for update
to authenticated
using (venue_id = (select auth.uid()))
with check (venue_id = (select auth.uid()));

-- Lets open devices hear about changes straight away instead of on their next poll.
alter publication supabase_realtime add table public.records;
