'use client';

import { Eye, EyeOff, Lock, Redo2, Undo2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { savePanelDoc } from '@/features/deck/actions';
import { typesetSlide } from '@/lib/renderer/typeset';
import type { SlideDoc } from '@/lib/slidedoc/doc';
import type { Layer as DocLayer } from '@/lib/slidedoc/layers';
import { cn } from '@/lib/utils';

// Canvas only in the browser, and only on this screen: konva touches `window`
// on import, and no other page should carry 93KB it never draws with.
const PanelCanvas = dynamic(
  async () => {
    const canvasModule = await import('./PanelCanvas');

    return canvasModule.PanelCanvas;
  },
  { ssr: false },
);

type PanelEditorShellProps = {
  panelId: string;
  initialDoc: SlideDoc;
};

/**
 * Measures the document the way the renderer will.
 *
 * Run on every change rather than once on entry: moving a layer changes what
 * fits beside it, and a canvas that kept the first measurement would drift
 * further from the rendered card with each edit — which is the one thing this
 * editor exists to prevent.
 *
 * @param doc - The document as it stands.
 * @returns Measured boxes and settled font sizes.
 */
function measure(doc: SlideDoc) {
  const result = typesetSlide(doc);

  return { rects: result.rects, fittedSizes: result.fittedSizes };
}

/** Wide enough to work in, narrow enough to leave room for the layer list. */
const STAGE_WIDTH = 420;

/** Far enough back to undo a bad idea, not so far it becomes a version history. */
const HISTORY_LIMIT = 50;

/**
 * The editing surface: canvas on one side, the layers of the card on the other.
 *
 * History is kept as whole documents rather than as a list of operations. A
 * card has at most a dozen layers, so a snapshot costs nothing to hold, and
 * undo that restores a known-good document cannot half-apply the way an
 * inverted operation can.
 *
 * @param props - The panel being edited and the document it renders from.
 * @returns The editor.
 */
export function PanelEditorShell(props: PanelEditorShellProps) {
  const t = useTranslations('PanelEditorPage');

  // Named one by one so the i18n checker can see them; a dynamic `t(key)` reads
  // as an unused key, the same way the sidebar labels do.
  const layerNames: Record<DocLayer['type'], string> = {
    text: t('layer_text'),
    image: t('layer_image'),
    shape: t('layer_shape'),
    video: t('layer_video'),
    logo: t('layer_logo'),
  };
  const [past, setPast] = useState<SlideDoc[]>([]);
  const [doc, setDoc] = useState(props.initialDoc);
  const [future, setFuture] = useState<SlideDoc[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const typeset = measure(doc);

  const commit = (next: SlideDoc) => {
    setPast((previous) => [...previous, doc].slice(-HISTORY_LIMIT));
    setFuture([]);
    setDoc(next);
    setSaved(false);
  };

  // Only the box moves. Narrowed to layout rather than a partial layer so the
  // union stays intact — a spread of "some layer fields" onto a discriminated
  // union is exactly the edit that needs a cast to compile and should not.
  const moveLayer = (layerId: string, layout: DocLayer['layout']) => {
    commit({
      ...doc,
      layers: doc.layers.map((layer) => (layer.id === layerId ? { ...layer, layout } : layer)),
    });
  };

  const undo = () => {
    const previous = past.at(-1);

    if (previous) {
      setPast((entries) => entries.slice(0, -1));
      setFuture((entries) => [doc, ...entries]);
      setDoc(previous);
    }
  };

  const redo = () => {
    const [next, ...rest] = future;

    if (next) {
      setPast((entries) => [...entries, doc]);
      setFuture(rest);
      setDoc(next);
    }
  };

  const save = () => {
    setFailed(false);

    startTransition(async () => {
      const result = await savePanelDoc({ panelId: props.panelId, doc });

      setSaved(result.ok);
      setFailed(!result.ok);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button disabled={past.length === 0} onClick={undo} size="sm" variant="ghost">
            <Undo2 className="size-4" aria-hidden="true" />
            {t('undo')}
          </Button>

          <Button disabled={future.length === 0} onClick={redo} size="sm" variant="ghost">
            <Redo2 className="size-4" aria-hidden="true" />
            {t('redo')}
          </Button>
        </div>

        <div className="flex items-center gap-3">
          {saved ? <span className="text-sm text-muted-foreground">{t('saved')}</span> : null}
          {failed ? <span className="text-sm text-destructive">{t('save_failed')}</span> : null}

          <Button disabled={isPending} onClick={save} size="lg">
            {isPending ? t('saving') : t('save')}
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap gap-6">
        <PanelCanvas
          displayWidth={STAGE_WIDTH}
          doc={doc}
          fittedSizes={typeset.fittedSizes}
          onLayerChange={(layerId, layout) => {
            const target = doc.layers.find((layer) => layer.id === layerId);

            if (target) {
              moveLayer(layerId, { ...target.layout, ...layout });
            }
          }}
          onSelect={setSelectedId}
          rects={typeset.rects}
          selectedId={selectedId}
        />

        <section className="min-w-64 flex-1">
          <h2 className="mb-2 text-sm font-medium text-foreground">
            {t('layers', { count: doc.layers.length })}
          </h2>

          <ul className="flex flex-col gap-1">
            {/* Reversed so the list reads front to back, the way the card looks. */}
            {[...doc.layers].toReversed().map((layer) => (
              <li key={layer.id}>
                <button
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                    layer.id === selectedId
                      ? 'border-ring bg-accent text-foreground'
                      : 'border-border bg-card text-muted-foreground hover:bg-accent',
                  )}
                  onClick={() => {
                    setSelectedId(layer.id);
                  }}
                  type="button"
                >
                  <span className="truncate">
                    {layer.type === 'text' && layer.text.trim() !== ''
                      ? layer.text
                      : layerNames[layer.type]}
                  </span>

                  <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                    {layer.locked ? <Lock className="size-3.5" aria-hidden="true" /> : null}
                    {layer.hidden ? (
                      <EyeOff className="size-3.5" aria-hidden="true" />
                    ) : (
                      <Eye className="size-3.5" aria-hidden="true" />
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
