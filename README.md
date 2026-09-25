# Mise — restaurant operations

Food safety, temperature and delivery management for restaurant teams. Every record is
entered by hand by the people on shift; there are no sensor, POS or supplier integrations
yet, and the architecture is arranged so they can be added without reworking the UI.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build
npm run lint
```

On first run the app opens `/setup`, which offers two ways in:

- **Set up my venue** asks a few questions (venue, manager, type of venue, equipment counts,
  whether you cook from raw, opening hours), previews what it will create, and builds the venue
  from a setup pack in `src/data/setupPacks/`. History starts empty.
- **Explore with demo data** loads roughly two weeks of generated records so every screen has
  something real to render.

Either can be redone later from **Settings → Data**.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · React Router · Recharts · date-fns · lucide-react

## How it is put together

```
src/
  data/          domain model, demo data, setup packs, persistence and the app store
  lib/           compliance rules, formatting, CSV export, theme + chart tokens
  components/
    ui/          design-system primitives (Button, Card, Badge, Field, Table, Modal…)
    shared/      composed pieces used across features (StatCard, PageHeader, charts…)
    layout/      app shell, sidebar, bottom tabs, topbar, Log sheet, command palette
  features/      one folder per section of the app (today/ is the home screen)
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

`LocalStorageRepository` is the current implementation. Putting this on a real backend means
writing an `HttpRepository` and changing one line in `main.tsx` — no screen changes. That is
the seam integrations arrive through:

| Integration | Where it plugs in |
|---|---|
| Wireless temperature probes | Feed readings in as `TemperatureLog` records; the pass/fail rules already apply to them |
| EPOS / sales data | A new slice on `AppData` plus a section under `features/` |
| Supplier ordering | Replace manual `Delivery` entry with imported records; the review UI is unchanged |

`data/store.tsx` wraps the repository in a reducer exposed through context. Mutations are
intent-shaped (`recordTemperature`, `saveDelivery`, `recordChecklistRun`) rather than generic
setters, which keeps the compliance side effects in one place — a failed reading, a rejected
delivery line and a failed critical checklist item all raise a food safety issue from there.

`data/selectors.ts` holds derived views. The Today screen, the nav badges, the check rounds
and the reports all read from the same selectors, so they can never disagree about what
"overdue today" means.

### The Today screen and logging

Home is a to-do list for the trading day, not a dashboard. `selectToday` folds every scheduled
temperature check and checklist into the check windows (opening, midday, evening, closing),
each task in one state:

| State | Meaning |
|---|---|
| `due` | Its window is open and nothing is logged yet |
| `missed` | The window closed with nothing logged, and nobody has followed up |
| `late` | Missed, but the item has been checked since. The miss stays on the record (the Temperatures page still shows it); it just no longer needs doing |
| `failed` | Logged, but out of range or with failed checklist items |
| `done` / `upcoming` | As they say |

Readings are never backdated into a closed window, so a missed check can only become `late`,
never `done`.

Everything that adds a record goes through one API, `useQuickEntry()`
(`components/layout/quickEntry.ts`), and the **Log** button (the centre tab on phones, top
right on desktop) opens a sheet over it. Entering a temperature offers **Save and next**
whenever another scheduled check is waiting, so a round of fridges is one sheet, not ten.

### QR labels and scanning

**Temperatures → QR labels** (also linked from Settings → Equipment) prints a 60 × 66 mm label
for each unit, and any list of equipment has a **Show QR** action. Each code is drawn in the
browser with the `qrcode` package and encodes `${origin}/scan/{itemId}`, a full-screen
logging page that saves through the same `recordTemperature` as the Log sheet.

> **Scanning only works on the device that holds the data.** Records live in that browser's
> localStorage, so a label scanned on any other phone opens a "not set up on this device"
> page. Labels will work from any device once an `HttpRepository` replaces
> `LocalStorageRepository` (see *The data layer*); the URLs won't need to change.

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

Equipment and probed food share one `MonitoredItem` shape because every reading answers the
same question. That is why the fridge, freezer, hot-holding and cooking pages are one
component (`features/temperatures/TemperatureSection.tsx`) over different slices, rather than
four near-copies.

### Design system

Semantic tokens live in `src/index.css` — surfaces, text and borders are CSS variables
re-pointed for dark mode and exposed to Tailwind via `@theme inline`. Components reference
roles (`bg-surface`, `text-ink-muted`, `border-line`), never raw palette steps.

Colour carries meaning here and is not decorative:

- **Brand teal** — navigation, primary actions, focus, and the window that is open now.
- **Status green / amber / red** — reserved for compliance state. A stat tile only turns amber
  or red when the number itself is the thing that needs attention.

Type is Figtree: open shapes and a big x-height that read at arm's length on a tablet, plain
zeros for times, and tabular figures so temperature columns line up.

Chart colours are declared per mode in `lib/theme.tsx` and were checked with the data-viz
validator against each mode's own surface; the dark steps are chosen for the dark background
rather than flipped from light. Pass/fail series always ship with a legend and labels, so the
meaning never rests on hue alone.

## Notes for the next person

- **Tables scroll horizontally on small screens rather than reflowing.** Column alignment
  between temperature readings is the point of the daily log sheet, so it is preserved rather
  than stacked. Pages that need a genuinely different mobile shape use a card list instead.
- **Phones get a bottom tab bar, not a drawer.** Today, Tasks, Log, Reports, More. Modals are
  bottom sheets there, and toasts sit at the top so they never cover a sheet's save button.
- **Freezer entry starts negative.** Phone decimal keypads have no minus key, so the reading
  field has a +/− toggle and items with an upper limit at or below 0°C default to negative.
- **Modals are mounted only while open.** That gives each one a fresh form from plain `useState`
  initialisers instead of a reset effect.
- **Nothing is pre-ticked.** Checklists start unanswered and a failed item needs a note before
  it can be signed off — a pre-filled compliance record is worth nothing to an inspector.
- **Corrective actions are mandatory on a failed reading**, for the same reason.
- Demo data is seeded from a fixed PRNG so a regenerated set stays comparable run to run.
  Today is deliberately left partially complete, with a few genuinely missed checks, so the
  dashboard shows real "due" and "overdue" states rather than a perfect green board.
