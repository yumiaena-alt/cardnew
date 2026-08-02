'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Textarea } from '@/components/ui/Field';
import {
  ModalClose,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalRoot,
  ModalTitle,
} from '@/components/ui/Modal';
import { updatePanelSlot } from '@/features/deck/actions';
import type { PanelView } from '@/features/deck/service';

type PanelEditorProps = {
  panel: PanelView | null;
  onClose: () => void;
};

/**
 * Edits the copy of one card.
 *
 * Only text is editable. The rendered image is not redrawn on save — that costs
 * a browser round trip per change — so an edited card shows its new wording in
 * the list while the picture still carries the old text until it is
 * regenerated. The editor says so rather than letting the user discover it.
 *
 * @param props - The panel being edited, and the close handler.
 * @returns The editor modal.
 */
export function PanelEditor(props: PanelEditorProps) {
  const t = useTranslations('DeckDetailPage');
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const [headline, setHeadline] = useState(props.panel?.headline ?? '');
  const [body, setBody] = useState(props.panel?.body ?? '');

  // Re-seeds the fields when a different panel is opened. Deriving during
  // render rather than in an effect keeps the modal in step with its prop.
  const [seededId, setSeededId] = useState(props.panel?.id ?? '');

  if (props.panel && props.panel.id !== seededId) {
    setSeededId(props.panel.id);
    setHeadline(props.panel.headline ?? '');
    setBody(props.panel.body ?? '');
    setFailed(false);
  }

  const save = () => {
    const { panel } = props;

    if (!panel) {
      return;
    }

    setFailed(false);

    startTransition(async () => {
      const results = await Promise.all([
        updatePanelSlot({ panelId: panel.id, slotKey: 'headline', value: headline }),
        updatePanelSlot({ panelId: panel.id, slotKey: 'body', value: body }),
      ]);

      if (results.some((result) => !result.ok)) {
        setFailed(true);

        return;
      }

      props.onClose();
    });
  };

  return (
    <ModalRoot
      open={props.panel !== null}
      onOpenChange={(open) => {
        if (!open) {
          props.onClose();
        }
      }}
    >
      <ModalContent aria-busy={isPending}>
        <ModalTitle>{t('edit_title')}</ModalTitle>
        <ModalDescription>{t('edit_description')}</ModalDescription>

        <Field label={t('edit_headline')}>
          <Textarea
            value={headline}
            maxLength={600}
            className="min-h-16"
            onChange={(event) => {
              setHeadline(event.target.value);
            }}
          />
        </Field>

        <Field label={t('edit_body')}>
          <Textarea
            value={body}
            maxLength={600}
            onChange={(event) => {
              setBody(event.target.value);
            }}
          />
        </Field>

        {failed ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {t('edit_failed')}
          </p>
        ) : null}

        <ModalFooter>
          <ModalClose
            render={
              <Button variant="ghost" size="lg">
                {t('edit_cancel')}
              </Button>
            }
          />
          <Button size="lg" disabled={isPending} onClick={save}>
            {isPending ? t('edit_saving') : t('edit_save')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </ModalRoot>
  );
}
