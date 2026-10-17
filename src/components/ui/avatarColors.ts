/**
 * The palette behind each person's colour (see `data/staffColors.ts`): a light
 * tint for their avatar and the same hue, solid, for their share of a bar.
 */
import { useStore } from '@/data/store'
import { preferredColors } from '@/data/staffColors'

/** Avatar tints, light behind initials. */
const TINTS = [
  'bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-200',
  'bg-info-100 text-info-700 dark:bg-info-500/15 dark:text-info-500',
  'bg-warn-100 text-warn-700 dark:bg-warn-500/15 dark:text-warn-500',
  'bg-pass-100 text-pass-700 dark:bg-pass-500/15 dark:text-pass-500',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
  'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400',
  'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-400',
]

/** The same hues, solid, in the same order. */
const FILLS = [
  'bg-brand-500',
  'bg-info-500',
  'bg-warn-500',
  'bg-pass-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-orange-500',
  'bg-fuchsia-500',
]

export function avatarTint(color: number): string {
  return TINTS[color] ?? TINTS[0]
}

/** A colour as a solid fill; grey when it isn't known who. */
export function avatarFill(color: number | undefined): string {
  return color === undefined ? 'bg-ink-subtle' : (FILLS[color] ?? FILLS[0])
}

/** Someone's colour: their team's choice for them, or for anyone not on the staff list, their first preference. */
export function useStaffColor(id: string | undefined): number | undefined {
  const { staffColors } = useStore()
  if (!id) return undefined
  return staffColors.get(id) ?? preferredColors(id)[0]
}
