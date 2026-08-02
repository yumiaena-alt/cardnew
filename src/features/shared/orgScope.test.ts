import type { SQL } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { notifications } from '@/models/System';
import { orgScoped } from './orgScope';
import type { Scope } from './scope';

const dialect = new PgDialect();

const SCOPE: Scope = {
  orgId: '0f2c9c1e-6f2a-4c2f-9f2e-8d1a4b6c7e01',
  userId: '3a7b5d90-1c44-4b6e-9a02-77d5c3f1b208',
  clerkOrgId: 'org_2abc',
  clerkUserId: 'user_2xyz',
  role: 'owner',
  planKey: 'free',
};

const OTHER_ORG_ID = 'c5d4e3f2-1a09-4b8c-9d7e-6f5a4b3c2d10';

function compile(condition: SQL | undefined) {
  if (!condition) {
    throw new Error('orgScoped produced no condition');
  }

  return dialect.sqlToQuery(condition);
}

describe(orgScoped, () => {
  it('filters on the org id when no other condition is given', () => {
    const { sql, params } = compile(orgScoped(SCOPE, notifications));

    expect(sql).toContain('"org_id" = $1');
    expect(params).toStrictEqual([SCOPE.orgId]);
  });

  it('keeps the org id filter when extra conditions are added', () => {
    const { sql, params } = compile(
      orgScoped(SCOPE, notifications, eq(notifications.kind, 'run_done')),
    );

    expect(sql).toContain('"org_id" = $1');
    expect(params).toStrictEqual([SCOPE.orgId, 'run_done']);
  });

  it('drops absent conditions without losing the org id filter', () => {
    // Callers inline optional filters, so an unset one arrives as undefined.
    const optionalFilter: SQL | undefined = undefined;
    const { sql, params } = compile(orgScoped(SCOPE, notifications, optionalFilter));

    expect(sql).toContain('"org_id" = $1');
    expect(params).toStrictEqual([SCOPE.orgId]);
  });

  it('binds the caller scope first when a second org id is supplied', () => {
    const { params } = compile(
      orgScoped(SCOPE, notifications, eq(notifications.orgId, OTHER_ORG_ID)),
    );

    // Both predicates survive, so a caller-supplied org id can only narrow the
    // result to nothing — never widen it past the scope.
    expect(params).toStrictEqual([SCOPE.orgId, OTHER_ORG_ID]);
  });
});
