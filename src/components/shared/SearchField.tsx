import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TextInput } from '@/components/ui/Field'

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <Search className="text-ink-muted pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2" />
      <TextInput
        value={value}
        aria-label={placeholder}
        placeholder={placeholder}
        className={cn('pl-9.5', value && 'border-brand-500 pr-9')}
        onChange={(event) => onChange(event.target.value)}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="text-ink-muted absolute top-1/2 right-2.5 -translate-y-1/2 p-1"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  )
}
