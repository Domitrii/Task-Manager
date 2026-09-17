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

The app ships with roughly two weeks of generated demo data so every screen has something
real to render. It is rebuilt from **Settings → Data → Reset demo data**.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · React Router · Recharts · date-fns · lucide-react

## How it is put together

```
src/
  data/          domain model, demo data, persistence and the app store
  lib/           compliance rules, formatting, CSV export, theme + chart tokens
  components/
    ui/          design-system primitives (Button, Card, Badge, Field, Table, Modal…)
    shared/      composed pieces used across features (StatCard, PageHeader, charts…)
    layout/      app shell, sidebar, topbar, command palette
  features/      one folder per section of the app
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

`data/selectors.ts` holds derived views. The dashboard, the sidebar counters and the reports
all read from the same selectors, so they can never disagree about what "overdue today" means.

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

- **Brand teal** — navigation, primary actions, focus.
- **Status green / amber / red** — reserved for compliance state. A stat tile only turns amber
  or red when the number itself is the thing that needs attention.

Chart colours are declared per mode in `lib/theme.tsx` and were checked with the data-viz
validator against each mode's own surface; the dark steps are chosen for the dark background
rather than flipped from light. Pass/fail series always ship with a legend and labels, so the
meaning never rests on hue alone.

## Notes for the next person

- **Tables scroll horizontally on small screens rather than reflowing.** Column alignment
  between temperature readings is the point of the daily log sheet, so it is preserved rather
  than stacked. Pages that need a genuinely different mobile shape use a card list instead.
- **Modals are mounted only while open.** That gives each one a fresh form from plain `useState`
  initialisers instead of a reset effect.
- **Nothing is pre-ticked.** Checklists start unanswered and a failed item needs a note before
  it can be signed off — a pre-filled compliance record is worth nothing to an inspector.
- **Corrective actions are mandatory on a failed reading**, for the same reason.
- Demo data is seeded from a fixed PRNG so a regenerated set stays comparable run to run.
  Today is deliberately left partially complete, with a few genuinely missed checks, so the
  dashboard shows real "due" and "overdue" states rather than a perfect green board.
