import type { StaffMember, StaffRole } from './types'

/** The roles offered in lists, in the order they're shown. Anything else is `other`, in the person's own words. */
export const STAFF_ROLES: Exclude<StaffRole, 'other'>[] = [
  'manager',
  'head_chef',
  'chef',
  'supervisor',
  'front_of_house',
  'kp',
]

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  manager: 'Manager',
  head_chef: 'Head chef',
  chef: 'Chef',
  supervisor: 'Supervisor',
  front_of_house: 'Front of house',
  kp: 'Kitchen porter',
  other: 'Other',
}

export function staffRoleLabel(member: Pick<StaffMember, 'role' | 'customRole'>): string {
  return (member.role === 'other' && member.customRole?.trim()) || STAFF_ROLE_LABELS[member.role]
}

/**
 * A role as it's kept on a team account: one of the listed roles' keys, or
 * whatever the person wrote under Other. Writing a listed role's name counts
 * as that role.
 */
export function staffRoleFromText(text: string | null | undefined): Pick<StaffMember, 'role' | 'customRole'> {
  const value = text?.trim() ?? ''
  const key = value.toLowerCase()
  const listed = STAFF_ROLES.find((role) => role === key || STAFF_ROLE_LABELS[role].toLowerCase() === key)
  if (listed) return { role: listed }
  return value ? { role: 'other', customRole: value } : { role: 'chef' }
}

/** How a team account's role reads, e.g. on a request to join. */
export function jobRoleLabel(text: string | null | undefined): string {
  return text?.trim() ? staffRoleLabel(staffRoleFromText(text)) : ''
}
