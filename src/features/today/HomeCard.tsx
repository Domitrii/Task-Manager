import { useState } from 'react'
import { ChevronDown, FileText, Flame, Plus, Thermometer, type LucideIcon } from 'lucide-react'
import type { AttentionTone, EntryAction, HomeCard, HomeEntry } from '@/data/attention'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

const ICONS: Record<HomeCard['key'], LucideIcon> = {
  tasks: FileText,
  temperatures: Thermometer,
  probe: Flame,
}

const TILES: Record<AttentionTone, string> = {
  fail: 'bg-fail-50 dark:bg-fail-500/15',
  warn: 'bg-warn-50 dark:bg-warn-500/12',
  pass: 'bg-pass-50 dark:bg-pass-500/12',
  neutral: 'bg-surface-muted',
}

const STATUS: Record<AttentionTone, string> = {
  fail: 'text-fail-700 dark:text-fail-500',
  warn: 'text-warn-700 dark:text-warn-500',
  pass: 'text-pass-700 dark:text-pass-500',
  neutral: 'text-ink-muted',
}

/** "✓ Done", "! Overdue": the mark says it for anyone who can't tell the colours apart. */
export function statusText(tone: AttentionTone, status: string): string {
  if (tone === 'pass') return `✓ ${status}`
  return tone === 'neutral' ? status : `! ${status}`
}

export function HomeCardView({
  card,
  onOpen,
  onLogProbe,
}: {
  card: HomeCard
  onOpen: (action: EntryAction) => void
  onLogProbe?: () => void
}) {
  const [open, setOpen] = useState(false)
  const Icon = ICONS[card.key]

  return (
    <article className="bg-surface shadow-card rounded-card relative overflow-hidden">
      {/* A stripe down the side, so trouble stands out with every card folded. */}
      {card.tone === 'fail' ? <span className="bg-fail-600 absolute inset-y-0 left-0 w-1" aria-hidden /> : null}
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span className="bg-app text-ink flex size-10 shrink-0 items-center justify-center rounded-lg">
          <Icon className="size-5" strokeWidth={1.8} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-ink block text-[17px] leading-snug font-semibold">{card.title}</span>
          <span className="text-ink-muted block text-sm">{card.summary}</span>
          {card.status ? (
            <Badge tone={card.tone} className="mt-1">
              {statusText(card.tone, card.status)}
            </Badge>
          ) : null}
          {card.lastCheck ? <span className="text-ink-subtle mt-1 block text-xs">Last check {card.lastCheck}</span> : null}
        </span>
        <ChevronDown className={cn('text-ink-muted size-5 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <div className="px-4 pb-4">
          <div className="border-line space-y-2.5 border-t pt-3">
            {card.entries.length === 0 ? (
              <p className="text-ink-muted text-sm">Nothing here yet today.</p>
            ) : (
              card.entries.map((entry) => <Entry key={entry.key} entry={entry} onOpen={onOpen} />)
            )}
            {onLogProbe ? (
              <Button block onClick={onLogProbe} className="gap-1.5">
                <Plus className="size-4" />
                Log a probe reading
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  )
}

function Entry({ entry, onOpen }: { entry: HomeEntry; onOpen: (action: EntryAction) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(entry.action)}
      className={cn('block w-full rounded-xl p-3 text-left transition-opacity hover:opacity-85', TILES[entry.tone])}
    >
      <span className="text-ink block text-[15px] font-semibold">{entry.title}</span>
      <span className="text-ink-muted block text-sm">{entry.detail}</span>
      <span className={cn('mt-1 block text-center text-xs font-semibold', STATUS[entry.tone])}>
        {statusText(entry.tone, entry.status)}
      </span>
    </button>
  )
}
