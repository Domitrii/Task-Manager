import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * Tables scroll horizontally on small screens rather than reflowing, so column
 * alignment between temperature readings is never lost. Pages that need a
 * genuinely different mobile shape render a card list instead.
 */
export function TableWrap({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  )
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
