/**
 * Each person's colour, shown on their avatar and as their share of the day's
 * progress bar. Colours are handed out per team so people can be told apart:
 * a team of up to `STAFF_COLOR_COUNT` never shares one.
 */
import type { ID, StaffMember } from './types'

/** How many colours there are. Matches the palette in `components/ui/avatarColors.ts`. */
export const STAFF_COLOR_COUNT = 8

/** Each person's own order of colours to try, so two people rarely want the same one first. */
export function preferredColors(id: string): number[] {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) | 0
  const start = Math.abs(hash) % STAFF_COLOR_COUNT
  return Array.from({ length: STAFF_COLOR_COUNT }, (_, step) => (start + step) % STAFF_COLOR_COUNT)
}

function leastUsed(id: string, usage: number[]): number {
  const fewest = Math.min(...usage)
  return preferredColors(id).find((color) => usage[color] === fewest) ?? 0
}

function isColor(value: number | undefined): value is number {
  return value !== undefined && Number.isInteger(value) && value >= 0 && value < STAFF_COLOR_COUNT
}

/**
 * Everyone's colour. A colour someone was given stays theirs; anyone without
 * one (people from before colours were kept) gets whichever is least used so
 * far, taken in id order so every device works out the same.
 */
export function staffColors(staff: Array<Pick<StaffMember, 'id' | 'color'>>): Map<ID, number> {
  const usage: number[] = Array.from({ length: STAFF_COLOR_COUNT }, () => 0)
  const colors = new Map<ID, number>()
  for (const member of staff) {
    if (!isColor(member.color)) continue
    colors.set(member.id, member.color)
    usage[member.color] += 1
  }
  const rest = staff.filter((member) => !isColor(member.color)).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  for (const member of rest) {
    const color = leastUsed(member.id, usage)
    colors.set(member.id, color)
    usage[color] += 1
  }
  return colors
}

/**
 * The colour someone new to the team keeps for good: whichever the team uses
 * least. Keeping it means nobody else's colour moves when someone joins.
 */
export function colorForNewcomer(staff: Array<Pick<StaffMember, 'id' | 'color'>>, id: ID): number {
  const usage: number[] = Array.from({ length: STAFF_COLOR_COUNT }, () => 0)
  for (const color of staffColors(staff).values()) usage[color] += 1
  return leastUsed(id, usage)
}
