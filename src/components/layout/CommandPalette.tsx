import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { CornerDownLeft, Flame, ListChecks, Package, Search, ShieldAlert, Thermometer } from 'lucide-react'
import { ALL_NAV_ITEMS } from '@/config/navigation'
import { useStore } from '@/data/store'
import { cn } from '@/lib/utils'
import type { QuickEntryApi } from './quickEntry'

interface Command {
  id: string
  label: string
  group: string
  hint?: string
  icon: React.ReactNode
  run: () => void
}

/** ⌘K launcher — every way to log something, plus navigation and equipment. */
export function CommandPalette({ onClose, api }: { onClose: () => void; api: QuickEntryApi }) {
  const navigate = useNavigate()
  const { data } = useStore()
  // Mounted only while open, so it always starts from an empty query.
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)

  const commands = useMemo<Command[]>(() => {
    // Each action replaces the palette with its own sheet, so no explicit close.
    const actions: Command[] = [
      {
        id: 'action-temp',
        label: 'Log a temperature',
        group: 'Log',
        icon: <Thermometer className="size-4" />,
        run: () => api.recordTemperature(),
      },
      {
        id: 'action-probe',
        label: 'Log a food probe',
        group: 'Log',
        icon: <Flame className="size-4" />,
        run: () => api.recordTemperature({ restrictTo: ['cooking', 'cooling'] }),
      },
      {
        id: 'action-delivery',
        label: 'Log a delivery',
        group: 'Log',
        icon: <Package className="size-4" />,
        run: api.recordDelivery,
      },
      {
        id: 'action-issue',
        label: 'Report an issue',
        group: 'Log',
        icon: <ShieldAlert className="size-4" />,
        run: api.raiseIssue,
      },
      {
        id: 'action-task',
        label: 'Add a task',
        group: 'Log',
        icon: <ListChecks className="size-4" />,
        run: api.addTask,
      },
    ]

    const pages: Command[] = ALL_NAV_ITEMS.map((item) => ({
      id: `page-${item.to}`,
      label: item.label,
      group: 'Go to',
      icon: <item.icon className="size-4" />,
      run: () => {
        onClose()
        navigate(item.to)
      },
    }))

    const equipment: Command[] = data.items
      .filter((item) => item.active)
      .map((item) => ({
        id: `item-${item.id}`,
        label: item.name,
        group: 'Log a reading for',
        hint: item.location,
        icon: <Thermometer className="size-4" />,
        run: () => api.recordTemperature({ itemId: item.id }),
      }))

    return [...actions, ...pages, ...equipment]
  }, [api, data.items, navigate, onClose])

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matched = needle
      ? commands.filter((command) =>
          `${command.label} ${command.hint ?? ''} ${command.group}`.toLowerCase().includes(needle),
        )
      : commands.slice(0, 12)
    return matched.slice(0, 20)
  }, [commands, query])

  const grouped = results.reduce<Record<string, Command[]>>((acc, command) => {
    ;(acc[command.group] ??= []).push(command)
    return acc
  }, {})

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="bg-surface border-line shadow-overlay relative flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border"
      >
        <div className="border-line flex items-center gap-2.5 border-b px-4">
          <Search className="text-ink-subtle size-4 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setCursor(0)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setCursor((current) => Math.min(current + 1, results.length - 1))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setCursor((current) => Math.max(current - 1, 0))
              } else if (event.key === 'Enter') {
                event.preventDefault()
                results[cursor]?.run()
              } else if (event.key === 'Escape') {
                onClose()
              }
            }}
            placeholder="Search pages, equipment or actions…"
            className="text-ink placeholder:text-ink-subtle h-12 flex-1 bg-transparent text-sm outline-none"
          />
          <kbd className="border-line-default text-ink-subtle rounded border px-1.5 py-0.5 text-[10px] font-medium">
            ESC
          </kbd>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {results.length === 0 ? (
            <p className="text-ink-muted px-4 py-8 text-center text-sm">No matches.</p>
          ) : (
            Object.entries(grouped).map(([group, entries]) => (
              <div key={group} className="mb-1">
                <p className="text-ink-muted px-4 pt-2 pb-1 text-xs font-medium">
                  {group}
                </p>
                {entries.map((command) => {
                  const index = results.indexOf(command)
                  return (
                    <button
                      key={command.id}
                      type="button"
                      onMouseEnter={() => setCursor(index)}
                      onClick={command.run}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2 text-left text-sm',
                        index === cursor ? 'bg-brand-50 dark:bg-brand-500/10' : '',
                      )}
                    >
                      <span className="text-ink-subtle shrink-0">{command.icon}</span>
                      <span className="text-ink min-w-0 flex-1 truncate">{command.label}</span>
                      {command.hint ? (
                        <span className="text-ink-subtle shrink-0 text-xs">{command.hint}</span>
                      ) : null}
                      {index === cursor ? (
                        <CornerDownLeft className="text-ink-subtle size-3.5 shrink-0" />
                      ) : null}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
