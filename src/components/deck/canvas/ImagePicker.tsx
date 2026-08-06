'use client';

import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import type { StockImage } from '@/features/deck/actions';
import { chooseStockImage, searchStockImages } from '@/features/deck/actions';

type ImagePickerProps = {
  panelId: string;
  /** Slot the photo belongs to, so its credit is rewritten with it. */
  slotKey: string;
  /** Asked for in the shape the layer will show it in. */
  orientation: 'landscape' | 'portrait' | 'squarish';
  onPick: (image: StockImage) => void;
};

/**
 * Replaces the photo on a card.
 *
 * Picking runs a server action before the document changes. Two things have to
 * happen that the canvas cannot do: the provider is told the photo is in use,
 * which its terms require, and the credit line under the card is rewritten —
 * that is read from the panel, not the document, so a swap that only touched
 * the document would keep crediting a photographer whose work is gone.
 *
 * @param props - The panel, the slot, and what to do with the chosen photo.
 * @returns The picker.
 */
export function ImagePicker(props: ImagePickerProps) {
  const t = useTranslations('PanelEditorPage');
  const [query, setQuery] = useState('');
  const [images, setImages] = useState<StockImage[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const search = () => {
    setFailure(null);

    startTransition(async () => {
      const result = await searchStockImages({
        query: query.trim(),
        orientation: props.orientation,
      });

      if (result.ok) {
        setImages(result.images);
      } else {
        setFailure(result.code);
      }
    });
  };

  const pick = (image: StockImage) => {
    setFailure(null);

    startTransition(async () => {
      const result = await chooseStockImage({
        panelId: props.panelId,
        slotKey: props.slotKey,
        sourceId: image.sourceId,
        query: query.trim(),
        orientation: props.orientation,
      });

      if (result.ok) {
        props.onPick(image);
      } else {
        setFailure(result.code);
      }
    });
  };

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      <Field hint={t('image_search_hint')} htmlFor="image-query" label={t('image_search_label')}>
        <div className="flex gap-2">
          <Input
            id="image-query"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && query.trim() !== '') {
                search();
              }
            }}
            placeholder={t('image_search_placeholder')}
            value={query}
          />

          <Button disabled={query.trim() === '' || isPending} onClick={search} size="sm">
            <Search className="size-4" aria-hidden="true" />
            {isPending ? t('image_searching') : t('image_search')}
          </Button>
        </div>
      </Field>

      {failure ? (
        <p className="text-sm text-destructive" role="alert">
          {t('image_failed')}
        </p>
      ) : null}

      {images.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2">
          {images.map((image) => (
            <li key={image.sourceId}>
              <button
                className="w-full overflow-hidden rounded-md border border-border transition-colors hover:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                disabled={isPending}
                onClick={() => {
                  pick(image);
                }}
                type="button"
              >
                {/* Not next/image: these are provider URLs chosen at runtime, and
                    the optimizer would need every provider host allow-listed. */}
                {/** biome-ignore lint/performance/noImgElement: runtime provider URLs */}
                <img
                  alt={image.authorName ?? ''}
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                  src={image.thumbnailUrl}
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
