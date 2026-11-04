import { CircleAlert, History, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Menu } from '@/components/ui/Menu'

export type SortOrder = 'recent' | 'priority'

const OPTIONS: Array<{ value: SortOrder; label: string; icon: LucideIcon }> = [
  { value: 'recent', label: 'Recent', icon: History },
  { value: 'priority', label: 'Priority', icon: CircleAlert },
]

export function SortMenu({
  value,
  onChange,
  showValue = false,
  align = 'right',
  className,
}: {
  value: SortOrder
  onChange: (value: SortOrder) => void
  /** Says what it's sorted by on the button. */
  showValue?: boolean
  align?: 'left' | 'right'
  className?: string
}) {
  const current = OPTIONS.find((option) => option.value === value)
  return (
    <Menu
      width="w-44"
      align={align}
      className={className}
      trigger={({ toggle }) => (
        <Button onClick={toggle} block={showValue} className="shrink-0">
          {showValue ? `Sort by: ${current?.label}` : 'Sort by'}
        </Button>
      )}
    >
      {({ close }) => (
        <div className="space-y-1 px-1">
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={value === option.value}
              onClick={() => {
                onChange(option.value)
                close()
              }}
              className={cn(
                'flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors',
                value === option.value ? 'bg-brand-600 text-white' : 'text-ink hover:bg-surface-muted',
              )}
            >
              <option.icon className="size-4" />
              {option.label}
            </button>
          ))}
        </div>
      )}
    </Menu>
  )
}
