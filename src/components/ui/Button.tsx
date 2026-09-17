import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANTS: Record<ButtonVariant, string> = {
  // Disabled primaries drop to the neutral surface rather than a tinted or
  // alpha-blended teal, which left the white label close to illegible.
  primary:
    'bg-brand-600 text-white shadow-xs hover:bg-brand-700 active:bg-brand-800 disabled:bg-surface-muted disabled:text-ink-subtle disabled:shadow-none',
  secondary:
    'bg-surface text-ink border border-line-default shadow-xs hover:bg-surface-muted active:bg-surface-muted disabled:text-ink-subtle',
  ghost: 'text-ink-muted hover:bg-surface-muted hover:text-ink disabled:text-ink-subtle',
  danger: 'bg-fail-600 text-white shadow-xs hover:bg-fail-700 active:bg-fail-700 disabled:bg-surface-muted disabled:text-ink-subtle disabled:shadow-none',
  subtle: 'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-950 dark:text-brand-200 dark:hover:bg-brand-900',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-xl',
}

const BASE =
  'inline-flex items-center justify-center font-medium whitespace-nowrap transition-colors select-none disabled:cursor-not-allowed'

interface CommonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  children?: ReactNode
  /** Stretches the button to fill its container — used on mobile action bars. */
  block?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  block,
  className,
  ...props
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(BASE, VARIANTS[variant], SIZES[size], block && 'w-full', className)}
      {...props}
    />
  )
}

export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  block,
  className,
  to,
  children,
}: CommonProps & { to: string }) {
  return (
    <Link
      to={to}
      className={cn(BASE, VARIANTS[variant], SIZES[size], block && 'w-full', className)}
    >
      {children}
    </Link>
  )
}

/** Square icon-only button. `label` is required — it becomes the accessible name. */
export function IconButton({
  label,
  variant = 'ghost',
  size = 'md',
  className,
  children,
  ...props
}: Omit<CommonProps, 'block'> & { label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const square = size === 'sm' ? 'size-8 rounded-lg' : size === 'lg' ? 'size-12 rounded-xl' : 'size-10 rounded-lg'
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(BASE, VARIANTS[variant], square, className)}
      {...props}
    >
      {children}
    </button>
  )
}
