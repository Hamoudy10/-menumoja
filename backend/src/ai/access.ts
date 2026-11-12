/**
 * AI Command access policy.
 *
 * The advanced AI operations are currently **admin-only**. Staff dashboards
 * (cashier, waiter, kitchen, manager) stay on the manual side of the product.
 *
 * Default allow-list: the restaurant owner (the dashboard "admin") and the
 * platform super-admin (when a restaurant context is supplied). This is
 * deliberately easy to widen later without touching call sites:
 *
 *   AI_COMMAND_ALLOWED_ROLES=owner,manager
 *
 * Note: widening this list does not by itself grant tool access — each tool
 * has its own role allow-list and is re-checked server-side.
 */

const DEFAULT_ALLOWED_ROLES = ['owner', 'super_admin'];

export function normalizeRole(role: unknown): string {
  return String(role ?? '').trim().toLowerCase();
}

export function getAllowedCommandRoles(): string[] {
  const raw = process.env.AI_COMMAND_ALLOWED_ROLES;
  const source = raw && raw.trim() ? raw.split(',') : DEFAULT_ALLOWED_ROLES;
  return Array.from(new Set(source.map((r) => normalizeRole(r)).filter(Boolean)));
}

export function isCommandRoleAllowed(role: unknown): boolean {
  return getAllowedCommandRoles().includes(normalizeRole(role));
}
