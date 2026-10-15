import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type ListBreakpoint = 'md' | 'lg'

const LIST_BREAKPOINTS: Record<ListBreakpoint, { list: string; table: string }> = {
  md: { list: 'md:hidden', table: 'hidden md:block' },
  lg: { list: 'lg:hidden', table: 'hidden lg:block' },
}

/**
 * Tables scroll horizontally on small screens rather than reflowing, so column
 * alignment is never lost. That's fine for read-only figures; a table with
 * buttons in it pairs with a `CardList` instead, so phones get stacked rows.
 */
export function TableWrap({
  className,
  hideBelow,
  children,
}: {
  className?: string
  /** Where a `CardList` with the same `showBelow` takes over. */
  hideBelow?: ListBreakpoint
  children: ReactNode
}) {
  return (
    // Relative, so screen-reader-only header labels (absolutely positioned) are
    // clipped by this scroller instead of widening the whole page.
    <div className={cn('relative w-full overflow-x-auto', hideBelow && LIST_BREAKPOINTS[hideBelow].table, className)}>
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  )
}

/**
 * The phone shape of a table: one stacked row per record, so nothing the
 * person needs (an Edit button, the status) sits off to the side. Shown below
 * `showBelow`; the table it replaces gets the same width as `hideBelow`.
 */
export function CardList({
  showBelow,
  className,
  children,
}: {
  showBelow: ListBreakpoint
  className?: string
  children: ReactNode
}) {
  return <ul className={cn('divide-line divide-y', LIST_BREAKPOINTS[showBelow].list, className)}>{children}</ul>
}

export function Th({
  className,
  numeric,
  children,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        'border-line text-ink-muted border-b px-4 py-2.5 text-left text-xs font-semibold tracking-wide uppercase',
        numeric && 'text-right',
        className,
      )}
      {...props}
    >
      {children}
    </th>
  )
}

export function Td({
  className,
  numeric,
  children,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        'border-line text-ink border-b px-4 py-3 align-middle',
        numeric && 'tabular text-right',
        className,
      )}
      {...props}
    >
      {children}
    </td>
  )
}

export function Tr({
  className,
  children,
  onClick,
}: {
  className?: string
  children: ReactNode
  onClick?: () => void
}) {
  return (
    <tr
      className={cn(
        'last:[&>td]:border-b-0',
        onClick && 'hover:bg-surface-muted/70 cursor-pointer transition-colors',
        className,
      )}
      onClick={onClick}
    >
      {children}
    </tr>
  )
}
