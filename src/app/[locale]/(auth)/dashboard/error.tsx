'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { ErrorPanel } from '@/components/dashboard/ErrorPanel';

type DashboardErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Boundary for dashboard pages.
 *
 * Redundant with the `(auth)` boundary for catching, but not for what survives:
 * this one sits inside the shell, so a page that fails leaves the sidebar,
 * topbar and account menu working. Without it a single broken screen would take
 * the whole chrome down and strip the user of the way out.
 *
 * @param props - The thrown error and the boundary's re-render callback.
 * @returns The error panel.
 */
export default function DashboardError(props: DashboardErrorProps) {
  useEffect(() => {
    Sentry.captureException(props.error);
  }, [props.error]);

  return <ErrorPanel digest={props.error.digest} onRetry={props.reset} />;
}
