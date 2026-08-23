'use client';

import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import type { ToonEditResult } from '@/features/toon/actions';
import { deleteToonCharacter, deleteToonFormula } from '@/features/toon/actions';

/**
 * Removing a character or a formula.
 *
 * One component for both because the two deletions are the same act with the
 * same consequence: the toons already drawn keep their panels, and what goes
 * away is the ability to draw more like them.
 *
 * Deleting takes two clicks. A cast member is what every future cut is drawn
 * against, and losing one to a stray click means the next toon quietly stars
 * somebody else.
 */

type ToonDeleteButtonProps = {
  kind: 'character' | 'formula';
  id: string;
  /** Accessible name, already naming the thing being deleted. */
  label: string;
  confirmLabel: string;
};

/**
 * Deletes one character or formula, after a confirming second click.
 *
 * @param props - What to delete, and the labels for both states.
 * @returns The delete control.
 */
export function ToonDeleteButton(props: ToonDeleteButtonProps) {
  const t = useTranslations('ToonTabs');
  const [isArmed, setIsArmed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const remove = () => {
    if (!isArmed) {
      setIsArmed(true);

      return;
    }

    startTransition(async () => {
      const result: ToonEditResult =
        props.kind === 'character'
          ? await deleteToonCharacter({ characterId: props.id })
          : await deleteToonFormula({ formulaId: props.id });

      // A failed delete disarms rather than reporting. The row is still on
      // screen, and the next click is the retry.
      if (!result.ok) {
        setIsArmed(false);
      }
    });
  };

  return (
    <Button
      aria-label={isArmed ? props.confirmLabel : props.label}
      disabled={isPending}
      onClick={remove}
      size="sm"
      variant={isArmed ? 'destructive' : 'ghost'}
    >
      <Trash2 data-icon="inline-start" />
      {isArmed ? t('delete_confirm') : t('delete')}
    </Button>
  );
}
