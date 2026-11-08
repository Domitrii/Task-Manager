# Mise — restaurant operations

Food safety, temperature and delivery management for restaurant teams. Every record is
entered by hand by the people on shift; there are no sensor, POS or supplier integrations
yet, and the architecture is arranged so they can be added without reworking the UI.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build
npm run lint
npm test         # every screen at phone, tablet, laptop and desktop sizes
```

`npm test` runs the Playwright suite in `tests/e2e/`. It opens every page, settings tab and
dialog at 360, 768, 1024 and 1440px wide and fails if anything doesn't fit: the page scrolling
sideways, something sticking out past the edge, a button hidden in a sideways-scrolling table,
or content cut off. It starts its own two copies of the app (device-only on :5199, and one with
dummy Supabase keys on :5198 whose requests the tests answer themselves), so it needs no
network or real project. `npm run test:ui` opens the same tests in Playwright's UI. The first
time on a new machine, run `npx playwright install chromium` to download the browser.

Tables that have buttons in them pair with a `CardList` (`src/components/ui/Table.tsx`) so
phones get stacked rows instead; read-only tables may scroll sideways.

On first run the app opens `/setup`, which offers two ways in:

- **Set up my venue** asks a few questions (venue, manager, type of venue, equipment counts,
  whether you cook from raw, opening hours), previews what it will create, and builds the venue
  from a setup pack in `src/data/setupPacks/`. History starts empty.
- **Explore with demo data** loads roughly two weeks of generated records so every screen has
  something real to render.

Either can be redone later from **Settings → Venue, team and data → Data**.

### Connecting Supabase

Without Supabase keys the app keeps everything on the device it runs on. With them, everyone
signs in with their own account and belongs to a team. The team owns the records, every device
signed in to it shares them, and recording carries on offline (see *Sync and offline* below).

1. In the Supabase dashboard, open **SQL Editor** and run each file in `supabase/migrations/` in
   order (or `supabase db push` with the CLI).
2. Copy `.env.example` to `.env` and fill in the project URL and the **publishable** key from
   **Settings → API**. The secret key is never needed by this app and must not go in a `VITE_`
   variable, because those are bundled into the browser build.
3. Under **Authentication → URL Configuration**, set the Site URL to where the app is deployed and
   add `http://localhost:5173` as a redirect URL, so sign-up confirmation links come back to the app.
4. Under **Authentication → Providers → Email**, set the minimum password length to 8, to match
   the app. Sign-in links ("Email me a sign-in link") and password resets need working email, so
   set up custom SMTP under **Authentication → Emails**.
5. On Vercel, add the same `VITE_` variables to the project and redeploy.

Optional, each switched on by its own setting:

- **Google sign-in.** Turn Google on under **Authentication → Providers** (it needs an OAuth
  client from Google Cloud), then set `VITE_GOOGLE_SIGN_IN=true`. Until then the button is hidden.
- **Reminders on a closed phone.** See *Reminders* below: it needs the push migration, an Edge
  Function, four secrets and a scheduled job.

After signing in, someone without a team either creates one or asks to join one with its
8-character code, which everyone in the team can find under **Settings → Team** (the owner can
replace it). Asking to join means choosing a role (or writing one in under *Other*) and waiting:
the owner, or anyone the owner allows under **Settings → Team**, approves or declines the request
there, and the top bar shows when someone is waiting. A new team offers setup as before; if the device already has records from before sync, they are
uploaded into the team instead. Accounts from before teams became teams of their own, with the
same records.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · React Router · Recharts · date-fns · lucide-react ·
Supabase (auth + Postgres) · idb-keyval · vite-plugin-pwa

## How it is put together

```
src/
  data/          domain model, demo data, setup packs, persistence and the app store
  lib/           compliance rules, formatting, CSV export, theme + chart tokens
  components/
    ui/          design-system primitives (Button, Card, Badge, Field, Table, Modal…)
    shared/      composed pieces used across features (StatCard, PageHeader, charts…)
    layout/      app shell, sidebar, bottom tabs, topbar, Log sheet, command palette
  features/      one folder per section of the app (today/ is the home screen; account/ is sign-in and sync)
  config/        navigation structure and category labels
```

### The data layer

Everything the app shows derives from a single `AppData` record (`data/types.ts`). Records
are flat and id-linked rather than nested, so they map cleanly onto API resources later.

The app never talks to storage directly. It talks to a **`DataRepository`**
(`data/repository.ts`):

```ts
interface DataRepository {
  load(): Promise<AppData>
  save(data: AppData): Promise<void>
  reset(): Promise<AppData>
}
```

`SupabaseRepository` syncs a team's records between devices (next section); `LocalStorageRepository`
keeps everything on one device and is used when no Supabase keys are set. `main.tsx` picks one,
and no screen knows which. That is also the seam integrations arrive through:

| Integration | Where it plugs in |
|---|---|
| Wireless temperature probes | Feed readings in as `TemperatureLog` records; the pass/fail rules already apply to them |
| EPOS / sales data | A new slice on `AppData` plus a section under `features/` |
| Supplier portals / EDI | Feed orders in as `SupplierOrder` records; checking them in and the review UI are unchanged |

`data/store.tsx` wraps the repository in a reducer exposed through context. Mutations are
intent-shaped (`recordTemperature`, `saveDelivery`, `recordChecklistRun`) rather than generic
setters, which keeps the compliance side effects in one place — a failed reading, a rejected
delivery line and a failed critical checklist item all raise a food safety issue from there.

### Sync and offline

Staff never wait on the network. `SupabaseRepository` (`data/supabaseRepository.ts`) writes every
save to IndexedDB first, so logging works with no signal at all, then:

- **Diffs each save into records.** `data/records.ts` turns `AppData` into one record per entity,
  keyed by its list and id: a reading, a fridge, a task, the venue settings. They are stored as
  rows of a single `records` table (`supabase/migrations/`), so devices merge record by record
  rather than overwriting each other's whole dataset. Two phones that log readings offline both
  keep theirs.
- **Queues them in an outbox.** Each unsent change is its own IndexedDB entry, so it survives a
  reload, and another tab picks it up if the tab that queued it closed while offline.
- **Pushes, then pulls.** Whenever the device is online and signed in, it uploads the outbox and
  asks for everything changed since it last looked. A Realtime notification, reconnecting, coming
  back to the tab and a one-minute poll all trigger this. Remote changes reach the store as a
  `remote/apply` action, merged over whatever is on screen.
- **Resolves conflicts per record, last write wins.** Most records are only ever added, so in
  practice devices only contend when two people edit the same task, issue or setting at once.
- **Uploads photos last.** Every temperature reading needs a photo of the probe or display. It is
  shrunk, stamped with the item, time and person (`lib/photo.ts`), kept in IndexedDB and uploaded
  to the private `reading-photos` Storage bucket after the records, counting as waiting to sync
  until then. Uploaded photos stay on the device for a week; after that they are downloaded when
  someone opens one.

Whoever entered a reading can change it for 20 minutes; after that only the owner and the
managers the owner chooses (**Settings → Team**) can, and each change keeps what the reading said
before, who changed it and why. The server enforces this too: a trigger on `records` turns away
late changes to someone else's or an old reading (with 10 minutes' slack for a slow connection),
and Storage only lets managers and whoever took a photo look at it. Managers get
**Temperatures → Review**, every reading for a day or week with its photo and the checks nobody
did; everyone else sees today's checks and their own readings. Without accounts, anyone down as a
Manager on the staff list counts as a manager.

Deletes are tombstones, so a device that was offline still hears about them. `updated_at` is set by
the server, not the device, so a phone with the wrong clock can't hide its changes. Lists the app
keeps in entry order (equipment, staff, suppliers) carry a sort key, so a new device shows them in
the same order.

Each person has their own account and belongs to one team; records belong to the team.
Row-level security limits each account to its team's records, and creating, asking to join,
approving, leaving and changing the code go through database functions that check the code and
the person's role. Someone waiting for approval can't see any of the team's records. Staff
still pick who is recording from the top bar, so a shared kitchen tablet can stay signed in to one
account. A device remembers its account and team after the first sign-in and opens straight into
them, including offline, until it is signed out from the profile menu or **Settings → Team**.
Signing out warns before discarding anything that hasn't synced.

The sync state shows in the top bar and in **Settings → Data**. It is deliberately neutral:
status colours are kept for compliance, and an offline device is working as intended.

A service worker (`vite-plugin-pwa`) caches the app itself, so a reload in the walk-in, or a QR
label scanned with no signal, still opens. It is only generated by `npm run build`, not in dev.

### Derived views

`data/selectors.ts` holds derived views. The Today screen, the nav badges, the check rounds
and the reports all read from the same selectors, so they can never disagree about what
"overdue today" means.

### Home and logging

Home says how the venue stands, then opens onto three cards: **Tasks**, **Temperatures** and
**Food probe** (`data/attention.ts`, `selectHome`). Underneath, `selectToday` still folds every
scheduled temperature check and checklist into the check windows (opening, midday, evening,
closing), each task in one state:

| State | Meaning |
|---|---|
| `due` | Its window is open and nothing is logged yet |
| `missed` | The window closed with nothing logged, and nobody has followed up |
| `late` | Missed, but the item has been checked since. The miss stays on the record (the check matrix still shows it); it just no longer needs doing |
| `failed` | Logged, but out of range or with failed checklist items |
| `done` / `upcoming` | As they say |

Readings are never backdated into a closed window, so a missed check can only become `late`,
never `done`.

Home's **need attention** count is the bell's *Missed*, *Overdue* and *Needs attention* together,
and tapping it opens that list. The bell is personal: someone who isn't a manager hears about their
own tasks and ones nobody has been given, not everyone else's, and sign-off requests only go to
managers. Temperatures, checklists and deliveries are anyone's, so everyone hears about those.

Everything that adds a record goes through one API, `useQuickEntry()`
(`components/layout/quickEntry.ts`), and the **Log** button (the centre tab on phones, top
right on desktop) opens a sheet over it. Entering a temperature offers **Save and next**
whenever another scheduled check is waiting, so a round of fridges is one sheet, not ten.

### The day's progress bar

A bar in the top band shows today's whole list (`selectDayProgress`), as "12 of 52 done today",
except on Calendar and Notifications. A page can put its own list there instead (`useHeaderProgress`), as the Checklist
does:
- the scheduled temperature checks and checklists, later ones included
- tasks due today or overdue
- orders waiting to be checked in

Tapping the bar opens who did what and what's left, with missed and overdue items called out, and
there each person's share is in their own colour, biggest first. Extra records nobody had to make,
like an ad-hoc probe reading, aren't on the list.

Each person's colour (`data/staffColors.ts`) is the same on their avatar and in that sheet. Colours are
handed out per team, so up to eight people never share one. Someone new keeps the colour they're
given (`StaffMember.color`), so nobody else's colour moves when they join. Tasks now record who
ticked them off (`Task.completedBy`).

### QR labels and scanning

**Temperatures → QR labels** (also linked from Settings → Equipment) prints a 60 × 66 mm label
for each unit, and any list of equipment has a **Show QR** action. Each code is drawn in the
browser with the `qrcode` package and encodes `${origin}/scan/{itemId}`, a full-screen
logging page that saves through the same `recordTemperature` as the Log sheet.

> **With Supabase connected, labels work from any phone.** A phone that has never been used
> signs in first and then lands on the label's page. Without Supabase, records live in one
> browser, so a label scanned on any other phone opens a "not set up on this device" page.

### Where things live

The screens come from the Figma design. Where an older page did more than its Figma screen, it
moved one level down and the new screen links to it, so nothing was lost:

| Screen | Address | Reached from it |
|---|---|---|
| Checklist | `/tasks` | |
| Calendar | `/calendar`, `/calendar/shift/:id` | |
| Notifications | `/notifications` | |
| More | `/more` | |
| Temps | `/temperatures`, `/temperatures/appliance/:id` | `/temperatures/records`: check matrix, history, review, QR labels |
| Food probe | `/food-probe` | |
| Deliveries | `/deliveries`, `/deliveries/order/:id`, `/deliveries/received/:id` | `/deliveries/records`: all deliveries, rejections, use-by |
| Suppliers | `/suppliers`, `/suppliers/:id` | `/suppliers/orders`: order planning |
| Issues | `/food-safety`, `/food-safety/:id` | |
| Stock | `/stock`, `/stock/:id` | |
| Team | `/team`, `/team/:id` | `/settings/manage?tab=staff`: join code, approvals, permissions |
| Settings | `/settings` and its sub-pages | `/settings/manage`: check windows, equipment, staff, suppliers, templates, data |

The Checklist's sections are `taskSections`; a task's `sectionId` puts it in one, and tasks with
none show under *Other tasks*. **Sign-off checklists** (`/checklists`) are the older signed records
for the due diligence file, and are a different thing from the Checklist.

Shifts, unavailability and invitations are ordinary lists on `AppData`, so they sync through the
same `records` table with no migration. There's no server to send email, so **Send invitation**
opens the inviter's own mail app with the join code.

### Shifts and clocking

Managers get a **Schedule** tab on the Calendar: the whole team's week as a time grid. Clicking a
time opens the shift form at that hour (eight hours long to begin with), and dragging picks the
hours. With a mouse, a shift can be dragged to another time or day and stretched by its bottom edge;
on a touch screen those same movements scroll the week, so tapping a shift opens the form instead.
A day with more people overlapping takes more width, and when a day is too narrow to read across,
names run down each strip. Anyone marked unavailable shows at the top of the day. Once someone has
clocked in, their shift's times are a record: it can't be moved, and opens on its own page instead.

Everyone clocks in from the bar at the foot of the Calendar. **Clock in** only works from the
shift's start time; there's no limit on how late, so someone can still start after a shift should
have ended. Once clocked in, the bar shows a running timer with **Break** and **End shift**. The
timer counts time worked: during a break it shows the time on break instead, and breaks aren't
counted in the total. **End shift** works at any time, and the confirmation says how far off the
schedule that is.

**No shift on the schedule?** People can still clock in. It starts an *extra shift* in their name,
from that moment (`Shift.unscheduled`), which ends when they clock out. Once a shift is done the bar
offers **Clock in again**, which starts another. The one thing they still can't do is start a planned
shift early: before it starts, Clock in waits for it. Extra shifts show on the week as drawn so far,
count towards hours worked but not hours scheduled, and are marked in the Hours export.

Managers see **Clocked in now** at the top of the Calendar: everyone on the clock, since when, how
long they've worked, and whether it's an extra shift, a break, or a shift past its planned end
(usually a forgotten End shift). **Clock out** beside each person (and on their shift's page) ends
it now or when they actually left, with a one-tap choice of the planned end for a shift that has run
past it; it can't be before they clocked in or started a break. Any break still running ends then
too. The shift keeps who clocked them out (`clockedOutBy`), which they see on their Calendar and
which is in the Hours export. Each person also opens their shift, where a manager can correct the
times.

The rules are checked on the device, in the store as well as on the buttons, against the device's
own clock. The server holds who may clock what (see *Who can do what*) and takes a clocked time as
the device sends it only within 15 minutes of its own clock, since the app only clocks while online
and hours are paid from these. It doesn't check "not before the shift starts", because it doesn't
know the venue's time zone.

### Reminders

Anyone can set their own reminders under **Settings → Notifications** (the top of the bell's page
links there): a time, how it repeats (every day, chosen days or just once) and, if they like, what
to check. Left blank, it says *Check all the details*. At that time it joins the bell's list under
*Your reminders*, counting what's waiting (`1 missed · 11 overdue · 6 coming soon`), and stays
until the end of the day. A one-off leaves the settings list once it has gone off.

Reminders live on the person (`StaffMember.reminders`), so they follow them between devices and
sync with no migration. Nothing is scheduled anywhere: `wentOffToday` works it out from the clock,
and `Reminder.setAt` stops one going off for a time that had already passed when it was set.

`useReminderAlarm` also announces each one once per device: a device notification if that's allowed
and it's within five minutes of the time, otherwise a toast. Saving a reminder is what asks for
permission. Phones only accept notifications from the service worker, which `vite.config.ts` gives
`public/sw-notifications.js`: it shows pushed reminders and handles tapping a notification.

**With Mise closed**, reminders come by Web Push. Each device that allows notifications registers
with its browser's push service and saves where to send in `push_subscriptions`, with its time zone
(`src/features/notifications/push.ts`). Every minute a scheduled job calls the `send-reminders` Edge
Function, which asks `due_reminder_pushes` what went off in the last 10 minutes on each device's
clock and sends it once (`push_sent`). Its tag is the bell's key, so if the open app already showed
it, the two don't double up. Signing out, leaving or being taken out of the team stops it. A shared
kitchen device doesn't register. iPhones only allow this once Mise is on the Home Screen (it has a
web app manifest and icons in `public/`); the settings page says so.

To switch it on:

1. Run `supabase/migrations/20261108120000_push_reminders.sql`.
2. Make a key pair with `npx web-push@3.6.7 generate-vapid-keys`.
3. `supabase secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:you@example.com CRON_SECRET=<a long random string>`
4. `supabase functions deploy send-reminders --no-verify-jwt`
5. In the SQL Editor, turn on the `pg_cron` and `pg_net` extensions and schedule it:

   ```sql
   select cron.schedule('send-reminders', '* * * * *', $$
     select net.http_post(
       url := 'https://<project-ref>.supabase.co/functions/v1/send-reminders',
       headers := jsonb_build_object('x-cron-secret', '<the same CRON_SECRET>')
     )
   $$);
   ```

6. Set `VITE_VAPID_PUBLIC_KEY` to the public key in `.env` and on Vercel, and redeploy.

Without the key, everything else works and reminders only pop up while Mise is open.

### Who can do what

Everyone in a team has their own account. The owner, and whoever the owner makes a manager, can do
more; the server holds the same lines as the screens (`records_guard`, migration
`20261108000000_access_rules.sql`), so a change made round the app is put right:

- **A record is in the name of whoever did it.** Someone who isn't a manager records temperatures,
  deliveries and checklists as themselves, at the time they enter them; the forms don't offer anyone
  else, and the server writes their name over any other. A manager can record for someone else or
  for an earlier time, and the record then says who entered it and when (`enteredBy`/`enteredAt`,
  shown as "entered by Amara, 14:05", and in the CSV exports).
- **Shifts and orders.** Only managers add, move or delete shifts and place, change or cancel
  orders. Everyone else can clock their own shift in and out and take breaks, and once a time is
  recorded it stays; clocking in with no shift creates an extra one, only ever in their own name and
  starting at the server's time. They can check an order in, in their own name. Only managers delete deliveries
  or checklists, and only managers sign issues off.
- **Taking someone out.** In **Settings → Team**, the owner can take anyone out of the team, and a
  manager anyone who isn't a manager. They lose access straight away; their staff record is marked
  as not working here, and their name stays on what they did. Their device notices within a
  minute, clears the team's records and goes back to choosing a team.
- **A shared kitchen device.** A manager signs in on a tablet that stays in the kitchen and turns on
  **Settings → Shared kitchen device**. People then tap their name and enter their kitchen PIN; what
  they record is in their name, and they can do what they could on their own phone. It locks after a
  few idle minutes (2, 5, 10 or 30) and on every reload. PINs are 4 to 6 digits, set by each person
  in their profile or by a manager for anyone, and kept only as a slow salted hash (`lib/pin.ts`).
  Five wrong PINs make it wait 30 seconds. The tablet itself is signed in as a manager, so someone
  who got round the app on it could do what a manager can; the settings page says to keep it where
  the team works. PINs from before were kept as typed; a manager's device hashes them and drops the
  typed ones.

Signing in: passwords need 8 characters and not a common one. **Email me a sign-in link** signs in
without a password, and says the same whether or not the address has an account. Changing your
password signs out your other devices unless you untick it, and **Sign out everywhere** in the
profile ends every session, for a lost phone.

### Hours and the inspection pack

**Calendar → Hours** shows each person's week from the clock: shifts, hours scheduled, hours worked
(clock in to clock out, less breaks) and time on break, with anyone still clocked in called out.
Managers see everyone and can export the week as CSV; everyone else sees their own. On a shift's
page a manager can **Correct times**, say for a forgotten End shift; the reason and what it said
before stay on the shift (`timeCorrections`) and in the export.

**Reports → Inspection pack** is every record an inspection asks for on one page, for 7 to 90 days:
a summary, readings out of range with what was done, every reading with who took it, checklists
with failed checks, deliveries with rejections, issues with sign-off, training certificates and probe
calibration. **Print or save as PDF** uses the browser's print dialog; the app's bars and menus
don't print.

### Supplier orders

**Orders** (`/suppliers/orders`) is where deliveries are planned. **New order** asks for the supplier,
the delivery date, an optional order-by date, the items (quantity, unit, £ price) and notes. Until
its delivery day, every order is laid out in full under *Upcoming deliveries*, with its items,
total, notes and who placed it. Below that, each supplier's card has its past orders. Managers can
change an order while it's open, repeat any past order as a new one, and cancel orders; cancelled
ones stay in the history. Suppliers themselves are still edited in Settings.

Low stock leads here too. For a manager, **Stock** lists what's low by supplier with **Start
order**, and a low item has **Order more from …**. Either opens a new order with those items on it,
each enough to take it back to twice its low-stock level (`data/restock.ts`), to change before
placing it.

**Deliveries** is for today: **Expected** lists the orders due to be checked in, and **Received**
the last week's deliveries.
All deliveries, rejections and the use-by watch are the other tabs.

- **Only `open`, `received` or `cancelled` is stored.** Draft (no delivery date yet), expected, due
  (delivery date is today) and overdue come from `orderState` in `lib/compliance.ts`, so an order
  rolls over at midnight without anyone touching it.
- **Prices are copied onto each order line**, so editing a later order never changes an old one.
  Naming a product the supplier has sold before fills in its last price, unit and category from
  that supplier's most recent order with it (`selectLastPrices`; cancelled orders don't count).
  Nothing is stored for this.
- **On its delivery day an order moves to Deliveries**, in a "Due today" section at the top.
  Overdue ones turn red there, and a manager can move the date or cancel. **Anyone can check an
  order in:** one tap per item, a temperature for anything probed, details (quantity received,
  a note, packaging, dates, accept or reject) on demand, and extras the driver brought, which can
  be moved onto the order. Completing it records an ordinary `Delivery` with `orderId`, in the name
  of whoever checked it in, so rejections still raise issues and the use-by watch and reports
  still see it. Ordered items that didn't come go in `Delivery.notReceived`, kept apart from
  `lines`, so line counts and rejection rates only count what arrived.
- **A discrepancy** is an item that didn't arrive, arrived short, or has a note. Discrepancies are
  amber in the order and delivery details, and the order gets a Discrepancies badge.
- The Deliveries nav badge counts orders waiting to be checked in, red when one is overdue.
  Rejections aren't counted there because each one already raises an issue.
- Ordering is manager-only in the app, using the same rule as changing temperature readings. The
  server doesn't enforce it: its trigger only guards readings.

### The compliance rules

`lib/compliance.ts` is the single source of truth for every judgement the app makes:

- **Pass / fail** — a reading is judged against its own item's `minTemp`/`maxTemp`. A missing
  bound never fails, so "63°C or above" and "0°C to 5°C" are both expressible.
- **Scheduled checks** — items declare which named periods they must be checked in
  (`opening`, `midday`, `evening`, `closing`). The windows are configured in Settings. A check
  counts for a period when it is recorded inside that window; once the window closes with
  nothing logged, the slot is **overdue**.
- **Deliveries** — chilled, produce and bakery lines are checked against the chilled limit,
  frozen lines against the frozen limit. Anything over, or with damaged packaging, is flagged
  for rejection — staff can still override, but they must record a reason.

Resolved issues stay correctable. Whoever resolved one, or a manager, can edit what was done at
any time, even after sign-off. Each change keeps the old wording in `resolutionEdits` and clears
any sign-off, because a sign-off only covers the words the manager read. Like ordering, this is
enforced in the app, not on the server. Issues resolved before `resolvedBy` was kept can only be
changed by a manager, since nothing says whose answer they were.

Equipment and probed food share one `MonitoredItem` shape because every reading answers the
same question. That is why the fridge, freezer, hot-holding and cooking pages are one
component (`features/temperatures/TemperatureSection.tsx`) over different slices, rather than
four near-copies.

### Design system

Semantic tokens live in `src/index.css` — surfaces, text and borders are CSS variables
re-pointed for dark mode and exposed to Tailwind via `@theme inline`. Components reference
roles (`bg-surface`, `text-ink-muted`, `border-line`), never raw palette steps.

Colour carries meaning here and is not decorative:

- **Brand terracotta** — the top band, navigation, primary actions and focus.
- **Status green / amber / red** — reserved for compliance state. A stat tile only turns amber
  or red when the number itself is the thing that needs attention.

Type is Figtree: open shapes and a big x-height that read at arm's length on a tablet, plain
zeros for times, and tabular figures so temperature columns line up. Page titles, sheet titles and
the wordmark are Philosopher (`font-display`).

Chart colours are declared per mode in `lib/theme.tsx`, each at 3:1 or better against its mode's own
surface; the dark steps are chosen for the dark background rather than flipped from light. Pass/fail series always ship with a legend and labels, so the
meaning never rests on hue alone.

## Notes for the next person

- **Tables scroll horizontally on small screens rather than reflowing.** Column alignment
  between temperature readings is the point of the daily log sheet, so it is preserved rather
  than stacked. Pages that need a genuinely different mobile shape use a card list instead.
- **Phones get a bottom tab bar, not a drawer.** Home, Checklist, Log, Reports, More. Modals are
  bottom sheets there, or full pages for longer forms. Toasts sit above the tab bar and any pinned
  action, and move to the top while a sheet is open so they never cover its save button.
- **Freezer entry starts negative.** Phone decimal keypads have no minus key, so the reading
  field has a +/− toggle and items with an upper limit at or below 0°C default to negative.
- **What's drawn over what is one scale**, the `--layer-*` variables at the top of `src/index.css`:
  a page's pinned bar, the tab bar, the top bar, dialogs, menus, the shared-device lock, toasts,
  search. Use `z-(--layer-…)`, not a number. Each page draws in its own isolated layer (`main`), so a
  page's sticky headings can never cover the bars around it, and parts with sticky layers of their
  own (the week grid, the check matrix) are isolated too. Menus open on their own layer over
  everything, placed against their button, upwards when there's more room above.
  `tests/e2e/layers.spec.ts` checks what's actually on top.
- **Modals are mounted only while open.** That gives each one a fresh form from plain `useState`
  initialisers instead of a reset effect.
- **Nothing is pre-ticked.** Checklists start unanswered and a failed item needs a note before
  it can be signed off — a pre-filled compliance record is worth nothing to an inspector.
- **Corrective actions are mandatory on a failed reading**, for the same reason.
- **Check-in temperatures start empty and are required.** The plain "Record delivery" form still
  starts probed lines at 0°C. A line the rules rejected (too warm, damaged packaging) goes back to
  accepted when the reading is corrected, unless someone chose the reason themselves; typing
  "-18" passes through "-1" on the way.
- Demo data is seeded from a fixed PRNG so a regenerated set stays comparable run to run.
  Today is deliberately left partially complete, with a few genuinely missed checks, so the
  dashboard shows real "due" and "overdue" states rather than a perfect green board.
