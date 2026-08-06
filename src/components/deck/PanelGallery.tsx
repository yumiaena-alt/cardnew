'use client';

import { ImageOff, LayoutTemplate, Pencil, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import type { PanelView } from '@/features/deck/service';
import { Link } from '@/libs/I18nNavigation';
import type { RunItemInput } from '@/validations/RunValidation';
import { PanelEditor } from './PanelEditor';
import { PanelRepaint } from './PanelRepaint';

type PanelGalleryProps = {
  panels: PanelView[];
  ratio: string;
  deckId: string;
  deckTopic: string;
  deckChannel: RunItemInput['targets'][number]['channel'];
  deckRatio: RunItemInput['targets'][number]['ratio'];
  creditBalance: number;
};

const RATIO_CLASS: Record<string, string> = {
  '1:1': 'aspect-square',
  '4:5': 'aspect-[4/5]',
  '9:16': 'aspect-[9/16]',
  '16:9': 'aspect-video',
  '3:4': 'aspect-[3/4]',
};

/**
 * The rendered cards of one deck, in order.
 *
 * A panel with no image still renders its headline. Generation can leave a card
 * without a picture — sourcing is allowed to fail without failing the run — and
 * showing the copy is more useful than showing a gap.
 *
 * @param props - Panels to display and the deck's aspect ratio.
 * @returns The panel gallery.
 */
export function PanelGallery(props: PanelGalleryProps) {
  const t = useTranslations('DeckDetailPage');
  const aspect = RATIO_CLASS[props.ratio] ?? 'aspect-[4/5]';
  const [editing, setEditing] = useState<PanelView | null>(null);
  const [repainting, setRepainting] = useState<PanelView | null>(null);

  return (
    <>
      <ol className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {props.panels.map((panel) => (
          <li key={panel.id} className="flex flex-col gap-2">
            <figure className="flex flex-col gap-2">
              {panel.imageUrl ? (
                // Signed storage URLs are single-use and time-limited, so the
                // image optimizer cannot cache them; a plain img is correct here.
                // biome-ignore lint/performance/noImgElement: signed URLs expire
                <img
                  src={panel.imageUrl}
                  alt={panel.headline ?? t('panel_alt', { index: panel.index + 1 })}
                  className={`w-full rounded-lg border border-border object-cover ${aspect}`}
                  loading="lazy"
                />
              ) : (
                <div
                  className={`grid w-full place-items-center rounded-lg border border-border bg-muted text-muted-foreground ${aspect}`}
                >
                  <ImageOff className="size-6" aria-hidden="true" />
                </div>
              )}

              <figcaption className="flex flex-col gap-1.5">
                <span className="line-clamp-2 text-sm text-foreground">
                  {panel.headline ?? t('panel_alt', { index: panel.index + 1 })}
                </span>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => {
                      setEditing(panel);
                    }}
                  >
                    <Pencil data-icon="inline-start" />
                    {t('edit_action')}
                  </Button>

                  {/* Copy edits happen in the drawer above; this opens the card
                      itself, where a layer can be moved rather than reworded. */}
                  <Button
                    render={
                      <Link href={`/dashboard/deck/${props.deckId}/edit/${panel.index}`}>
                        <LayoutTemplate data-icon="inline-start" />
                        {t('layout_action')}
                      </Link>
                    }
                    size="xs"
                    variant="outline"
                  />

                  {panel.canRepaint ? (
                    <Button
                      variant="signal"
                      size="xs"
                      onClick={() => {
                        setRepainting(panel);
                      }}
                    >
                      <RefreshCw data-icon="inline-start" />
                      {t('repaint_action')}
                    </Button>
                  ) : null}

                  {panel.isEdited ? <StatusChip tone="wait">{t('edited_badge')}</StatusChip> : null}
                </div>

                {panel.credit ? (
                  <span className="text-xs text-muted-foreground">
                    {t('photo_credit', { author: panel.credit.authorName ?? t('unknown_author') })}
                  </span>
                ) : null}
              </figcaption>
            </figure>
          </li>
        ))}
      </ol>

      <PanelEditor
        panel={editing}
        onClose={() => {
          setEditing(null);
        }}
      />

      <PanelRepaint
        panel={repainting}
        deckId={props.deckId}
        deckTopic={props.deckTopic}
        deckChannel={props.deckChannel}
        deckRatio={props.deckRatio}
        creditBalance={props.creditBalance}
        onClose={() => {
          setRepainting(null);
        }}
      />
    </>
  );
}
