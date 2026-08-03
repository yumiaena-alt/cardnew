'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { startStandardCheckout } from '@/features/billing/actions';

/**
 * Starts the Standard subscription checkout.
 *
 * The redirect target comes from the server, never assembled here: the browser
 * only follows the URL Stripe issued.
 *
 * @returns The upgrade button.
 */
export function UpgradeButton() {
  const t = useTranslations('PlanPage');
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const upgrade = () => {
    setFailed(false);

    startTransition(async () => {
      const result = await startStandardCheckout();

      if (!result.ok) {
        setFailed(true);

        return;
      }

      window.location.href = result.url;
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <Button size="lg" disabled={isPending} onClick={upgrade}>
        {isPending ? t('starting') : t('upgrade_action')}
      </Button>

      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          {t('upgrade_failed')}
        </p>
      ) : null}
    </div>
  );
}
