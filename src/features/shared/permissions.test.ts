import { describe, expect, it } from 'vitest';
import { hasPermission, mapClerkRole, PERMISSION_KEYS } from './permissions';

describe(hasPermission, () => {
  it('grants every permission to owner', () => {
    const denied = PERMISSION_KEYS.filter((permission) => !hasPermission('owner', permission));

    expect(denied).toStrictEqual([]);
  });

  it('expands a namespace wildcard to the permissions under it', () => {
    expect(hasPermission('admin', 'deck:delete')).toBeTruthy();
    expect(hasPermission('admin', 'template:create')).toBeTruthy();
  });

  it('keeps a namespace wildcard from leaking into another namespace', () => {
    expect(hasPermission('admin', 'billing:manage')).toBeFalsy();
    expect(hasPermission('admin', 'run:execute')).toBeFalsy();
  });

  it('matches an exact grant', () => {
    expect(hasPermission('editor', 'run:execute')).toBeTruthy();
  });

  it('denies a permission the role was not granted', () => {
    expect(hasPermission('editor', 'member:manage')).toBeFalsy();
    expect(hasPermission('viewer', 'deck:update')).toBeFalsy();
    expect(hasPermission('reviewer', 'run:execute')).toBeFalsy();
  });

  it('limits viewer to reading', () => {
    const granted = PERMISSION_KEYS.filter((permission) => hasPermission('viewer', permission));

    expect(granted).toStrictEqual(['deck:read', 'analytics:read']);
  });
});

describe(mapClerkRole, () => {
  it('maps the Clerk instance admin to owner', () => {
    expect(mapClerkRole('org:admin')).toBe('owner');
  });

  it('maps the Clerk instance member to editor', () => {
    expect(mapClerkRole('org:member')).toBe('editor');
  });

  it('falls back to viewer for an unknown role', () => {
    expect(mapClerkRole('org:something_new')).toBe('viewer');
  });

  it('falls back to viewer for a missing role', () => {
    // A session without an active organization reports no role at all.
    const absentRole: string | null | undefined = undefined;

    expect(mapClerkRole(null)).toBe('viewer');
    expect(mapClerkRole(absentRole)).toBe('viewer');
    expect(mapClerkRole('')).toBe('viewer');
  });
});
