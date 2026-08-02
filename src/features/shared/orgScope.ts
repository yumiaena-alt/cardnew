import type { SQL } from 'drizzle-orm';
import { and, eq } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type { OrgScope } from './scope';

/** Any tenant table. Every one of them carries `orgId` directly, without a join. */
type OrgOwnedTable = { orgId: PgColumn };

/**
 * Builds the `WHERE` clause for a tenant table with the isolation filter
 * already applied.
 *
 * Repository queries against org-owned tables compose their conditions through
 * this helper instead of calling `and(...)` directly, so the `orgId` predicate
 * cannot be left out by accident — the isolation filter is part of the shape of
 * the call rather than something the author has to remember.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param table - The org-owned table being queried.
 * @param conditions - Extra predicates. `undefined` entries are dropped, which
 * lets callers inline optional filters.
 * @returns The combined condition, always including `orgId`.
 */
export function orgScoped(
  scope: OrgScope,
  table: OrgOwnedTable,
  ...conditions: (SQL | undefined)[]
) {
  return and(eq(table.orgId, scope.orgId), ...conditions);
}
