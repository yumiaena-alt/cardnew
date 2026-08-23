'use client';

import * as Sentry from '@sentry/nextjs';
import NextError from 'next/error';
import { useEffect } from 'react';
import { routing } from '@/libs/I18nRouting';

export default function GlobalError(props: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(props.error);
  }, [props.error]);

  return (
    <html lang={routing.defaultLocale}>
      <body>
        {/* `NextError` is the default Next.js error page component. Passing 0 —
        the App Router exposes no status code — makes it print "a client-side
        exception has occurred", which is wrong for the errors that actually
        reach here: a server component that cannot reach the database renders
        that text and sends whoever is debugging to an empty browser console.
        500 is what the response carries, and it names the right layer.

        The copy stays untranslated because this boundary replaces the root
        layout, so `NextIntlClientProvider` is gone by the time it renders.
        Route-level `error.tsx` boundaries are where localized copy belongs. */}
        <NextError statusCode={500} />

        {/* Data, not copy: the one value that ties this page to the server log
        entry naming the cause. Without it the two cannot be matched up. */}
        {props.error.digest && (
          <p style={{ fontFamily: 'monospace', fontSize: 12, textAlign: 'center' }}>
            {props.error.digest}
          </p>
        )}
      </body>
    </html>
  );
}
