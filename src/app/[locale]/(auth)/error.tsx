'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { ErrorPanel } from '@/components/dashboard/ErrorPanel';

type AuthErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Boundary for everything behind auth, sited one segment above the dashboard.
 *
 * The depth is the point. A route's own `error.tsx` never catches that route's
 * `layout.tsx` — the layout renders outside the boundary it declares. The
 * dashboard layout is exactly where the shell resolves the tenant scope and
 * credit balance, so an unreachable database throws there and a boundary
 * inside `dashboard/` cannot see it. It fell through to `app/global-error.tsx`
 * instead, which printed Next's "a client-side exception has occurred" and
 * pointed at a browser console that had nothing in it.
 *
 * @param props - The thrown error and the boundary's re-render callback.
 * @returns The error panel.
 */
export default function AuthError(props: AuthErrorProps) {
  useEffect(() => {
    Sentry.captureException(props.error);
  }, [props.error]);

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <ErrorPanel digest={props.error.digest} onRetry={props.reset} />
    </div>
  );
}
