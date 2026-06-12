import type { OrderStatus, UserRole } from '@/types'

export const ALLOWED_TRANSITIONS: Record<UserRole, Record<string, OrderStatus[]>> = {
  master: {
    pending: ['accepted', 'cancelled'],
    accepted: ['in_progress', 'cancelled'],
    in_progress: ['completed'],
  },
  client: {
    pending: ['cancelled'],
    accepted: ['cancelled'],
    completed: ['confirmed', 'disputed'],
  },
  city_admin: {
    '*': ['pending', 'accepted', 'in_progress', 'completed', 'confirmed', 'cancelled', 'disputed'],
  },
  superadmin: {
    '*': ['pending', 'accepted', 'in_progress', 'completed', 'confirmed', 'cancelled', 'disputed'],
  },
}

export function isTransitionAllowed(role: UserRole, from: OrderStatus, to: OrderStatus): boolean {
  const roleRules = ALLOWED_TRANSITIONS[role]
  if (!roleRules) return false
  if (roleRules['*']) return roleRules['*'].includes(to)
  return roleRules[from]?.includes(to) ?? false
}

export const NOTIFY_EVENT_BY_STATUS: Record<OrderStatus, string | null> = {
  pending: 'order_new',
  accepted: 'order_accepted',
  in_progress: 'order_in_progress',
  completed: 'order_completed',
  confirmed: 'order_confirmed',
  cancelled: 'order_cancelled',
  disputed: null,
}
