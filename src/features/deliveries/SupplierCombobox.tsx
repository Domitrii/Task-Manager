import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Check, Plus } from 'lucide-react'
import type { Supplier } from '@/data/types'
import { cn } from '@/lib/utils'
import { TextInput } from '@/components/ui/Field'
import { matchSupplier, normaliseSupplierName as normalise } from './suppliers'

type Option = { kind: 'supplier'; supplier: Supplier } | { kind: 'new'; name: string }

/**
 * A text input that suggests the team's suppliers as you type. Picking one
 * fills in its name; a name that isn't on the list is a new supplier, so a
 * driver from someone new doesn't send staff off to Settings first.
 */
export function SupplierCombobox({
  id,
  suppliers,
  value,
  onChange,
  invalid,
}: {
  id?: string
  suppliers: Supplier[]
  /** The supplier's name as typed. */
  value: string
  onChange: (name: string) => void
  invalid?: boolean
}) {
  const listId = useId()
  const listRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  // Focusing a filled-in field shows every supplier; typing narrows the list.
  const [filtering, setFiltering] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  // Set on focus, so the mouseup of the click that focused doesn't undo select().
  const keepSelection = useRef(false)

  const query = normalise(value)
  const active = suppliers.filter((supplier) => supplier.active)
  const options: Option[] = (filtering ? active.filter((supplier) => normalise(supplier.name).includes(query)) : active).map(
    (supplier) => ({ kind: 'supplier', supplier }),
  )
  if (query && !matchSupplier(suppliers, value)) options.push({ kind: 'new', name: value.trim() })

  useEffect(() => {
    if (!open) return
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  function show(nextFiltering: boolean) {
    setFiltering(nextFiltering)
    setActiveIndex(0)
    setOpen(true)
  }

  function choose(option: Option) {
    onChange(option.kind === 'supplier' ? option.supplier.name : option.name)
    setOpen(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    keepSelection.current = false
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        show(false)
        return
      }
      if (options.length === 0) return
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((current) => (current + step + options.length) % options.length)
    } else if (event.key === 'Enter' && open && options[activeIndex]) {
      event.preventDefault()
      choose(options[activeIndex])
    } else if (event.key === 'Escape' && open) {
      // Closes the list, not the dialog it sits in.
      event.stopPropagation()
      setOpen(false)
    }
  }

  function handleBlur() {
    keepSelection.current = false
    setOpen(false)
    // Typed in a different case: use the name as it's saved.
    const match = matchSupplier(suppliers, value)
    if (match && match.name !== value) onChange(match.name)
    else if (value !== value.trim()) onChange(value.trim())
  }

  const showList = open && (options.length > 0 || active.length === 0)

  return (
    <div className="relative">
      <TextInput
        id={id}
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && options[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        value={value}
        placeholder="Search or add a supplier…"
        invalid={invalid}
        onFocus={(event) => {
          // Selected, so typing replaces the name rather than adding to it.
          event.target.select()
          keepSelection.current = true
          show(false)
        }}
        onMouseUp={(event) => {
          if (keepSelection.current) event.preventDefault()
          keepSelection.current = false
        }}
        onClick={() => {
          if (!open) show(false)
        }}
        onChange={(event) => {
          onChange(event.target.value)
          show(true)
        }}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />

      {showList ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="bg-surface border-line shadow-overlay absolute top-[calc(100%+6px)] right-0 left-0 z-10 max-h-60 overflow-y-auto rounded-xl border py-1"
          // Keeps focus in the input, so choosing doesn't blur it first.
          onMouseDown={(event) => event.preventDefault()}
        >
          {options.length === 0 ? (
            <li className="text-ink-muted px-3 py-2 text-sm">Type a name to add your first supplier.</li>
          ) : null}
          {options.map((option, index) => {
            const selected = option.kind === 'supplier' && normalise(option.supplier.name) === query
            return (
              <li
                key={option.kind === 'supplier' ? option.supplier.id : 'new'}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(option)}
                className={cn(
                  'text-ink flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm',
                  index === activeIndex && 'bg-surface-muted',
                  option.kind === 'new' && options.length > 1 && 'border-line border-t',
                )}
              >
                {option.kind === 'supplier' ? (
                  <>
                    <span className="min-w-0 flex-1 truncate">{option.supplier.name}</span>
                    {selected ? <Check className="text-brand-600 size-4 shrink-0" /> : null}
                  </>
                ) : (
                  <>
                    <Plus className="text-ink-subtle size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">
                      Add <span className="font-medium">“{option.name}”</span> as a new supplier
                    </span>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
