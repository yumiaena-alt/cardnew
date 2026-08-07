'use client';

import { Check, Pencil, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { StatusChip } from '@/components/ui/StatusChip';
import { deleteLearnedTemplate, renameLearnedTemplate } from '@/features/template/actions';

type TemplateCardProps = {
  id: string;
  name: string;
  ratio: string;
  roles: string;
  colors: string[];
};

/**
 * One learned style, with the two things anyone does to a saved thing.
 *
 * Deleting asks first. A learned template took ten credits and a set of
 * references that were not kept, so it cannot be made again by pressing the
 * same button — that is a different bar than deleting a draft.
 *
 * @param props - The template and how it looks.
 * @returns The card.
 */
export function TemplateCard(props: TemplateCardProps) {
  const t = useTranslations('TemplateGalleryPage');
  const [name, setName] = useState(props.name);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  const rename = () => {
    startTransition(async () => {
      await renameLearnedTemplate({ templateId: props.id, name: name.trim() });
      setIsRenaming(false);
    });
  };

  const remove = () => {
    startTransition(async () => {
      await deleteLearnedTemplate({ templateId: props.id });
      setIsConfirming(false);
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        {isRenaming ? (
          <div className="flex flex-1 items-center gap-1">
            <Input
              autoFocus
              maxLength={60}
              onChange={(event) => {
                setName(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && name.trim() !== '') {
                  rename();
                }
              }}
              value={name}
            />

            <Button disabled={name.trim() === '' || isPending} onClick={rename} size="xs">
              <Check className="size-3.5" aria-hidden="true" />
            </Button>

            <Button
              onClick={() => {
                setName(props.name);
                setIsRenaming(false);
              }}
              size="xs"
              variant="ghost"
            >
              <X className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <>
            <h2 className="text-sm font-medium text-foreground">{props.name}</h2>
            <StatusChip tone="done">{props.ratio}</StatusChip>
          </>
        )}
      </div>

      {/* The palette it learned, shown as the colours themselves. A hex string
          tells nobody whether the design was read correctly. */}
      <div className="flex gap-1.5">
        {props.colors.map((color) => (
          <span
            className="size-6 rounded-full border border-border"
            key={color}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>

      <p className="text-xs text-muted-foreground">{props.roles}</p>

      {isConfirming ? (
        <div className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{t('delete_confirm')}</p>

          <div className="flex gap-2">
            <Button disabled={isPending} onClick={remove} size="xs" variant="destructive">
              {t('delete_yes')}
            </Button>

            <Button
              onClick={() => {
                setIsConfirming(false);
              }}
              size="xs"
              variant="ghost"
            >
              {t('delete_no')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-1">
          <Button
            onClick={() => {
              setIsRenaming(true);
            }}
            size="xs"
            variant="ghost"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            {t('rename')}
          </Button>

          <Button
            onClick={() => {
              setIsConfirming(true);
            }}
            size="xs"
            variant="ghost"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            {t('delete')}
          </Button>
        </div>
      )}
    </div>
  );
}
