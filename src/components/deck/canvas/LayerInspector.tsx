'use client';

import { Copy, Eye, EyeOff, Lock, LockOpen, MoveDown, MoveUp, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import type { ImageLayer, Layer as DocLayer, ShapeLayer, TextLayer } from '@/lib/slidedoc/layers';
import { ImagePicker } from './ImagePicker';

type LayerInspectorProps = {
  layer: DocLayer;
  panelId: string;
  /** False for the layer already at the back, so it cannot be sent further. */
  canMoveDown: boolean;
  canMoveUp: boolean;
  /** Fields every layer has, so a patch of them narrows on any of them. */
  onToggle: (patch: { hidden?: boolean; locked?: boolean }) => void;
  /** The whole layer, already narrowed by whichever field set built it. */
  onReplace: (next: DocLayer) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onReorder: (direction: 'up' | 'down') => void;
};

/** Below this a headline is smaller than the body it sits above. */
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 400;

/** Focus is a ratio, and a hundred steps is finer than anyone needs. */
const FOCUS_STEP = 0.01;

/** Past this a rectangle is a pill, and the number stops meaning anything. */
const MAX_RADIUS = 200;

/** Cards are taller than they are wide on every channel we publish to. */
const ORIENTATION_FOR_LAYER = 'portrait' as const;

/**
 * A colour, picked or typed.
 *
 * Both, because they fail in different places: the swatch is faster but cannot
 * be told an exact brand hex, and the field can but is tedious for "a bit
 * darker". Neither alone covers the two reasons someone opens this.
 *
 * @param props - Label, current value, and what to do with a new one.
 * @returns The colour control.
 */
function ColorField(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-20 text-muted-foreground">{props.label}</span>

      <input
        className="size-8 shrink-0 cursor-pointer rounded-md border border-border bg-transparent"
        onChange={(event) => {
          props.onChange(event.target.value);
        }}
        type="color"
        value={props.value}
      />

      <Input
        className="font-mono"
        maxLength={9}
        onChange={(event) => {
          props.onChange(event.target.value);
        }}
        value={props.value}
      />
    </label>
  );
}

/**
 * Copy and size for a text layer.
 *
 * Its own component so the layer arrives already narrowed: reading
 * `props.layer.style` inside a callback on the union loses the refinement, and
 * the fix for that is a cast.
 *
 * @param props - The text layer and how to patch it.
 * @returns The text fields.
 */
function TextFields(props: { layer: TextLayer; onChange: (next: TextLayer) => void }) {
  const t = useTranslations('PanelEditorPage');
  const { layer } = props;
  const alignLabels = { left: t('align_left'), center: t('align_center'), right: t('align_right') };

  return (
    <>
      <Field htmlFor="layer-text" label={t('text_label')}>
        <Textarea
          id="layer-text"
          onChange={(event) => {
            props.onChange({ ...layer, text: event.target.value });
          }}
          rows={3}
          value={layer.text}
        />
      </Field>

      <Field hint={t('size_hint')} htmlFor="layer-size" label={t('size_label')}>
        <Input
          id="layer-size"
          max={MAX_FONT_SIZE}
          min={MIN_FONT_SIZE}
          onChange={(event) => {
            // Setting a size by hand is a decision, so autofit stops overriding
            // it — otherwise the number would spring back on the next measure.
            props.onChange({
              ...layer,
              style: {
                ...layer.style,
                size: Number(event.target.value),
                autoFit: { ...layer.style.autoFit, enabled: false },
              },
            });
          }}
          type="number"
          value={layer.style.size}
        />
      </Field>

      <ColorField
        label={t('color_label')}
        onChange={(color) => {
          props.onChange({ ...layer, style: { ...layer.style, color } });
        }}
        value={layer.style.color}
      />

      <div className="flex items-center gap-3 text-sm">
        <span className="w-20 text-muted-foreground">{t('align_label')}</span>

        <div className="flex gap-1">
          {(['left', 'center', 'right'] as const).map((align) => (
            <Button
              key={align}
              onClick={() => {
                props.onChange({ ...layer, style: { ...layer.style, align } });
              }}
              size="xs"
              variant={layer.style.align === align ? 'default' : 'outline'}
            >
              {alignLabels[align]}
            </Button>
          ))}
        </div>
      </div>
    </>
  );
}

/**
 * Fill and corner for a shape layer.
 *
 * @param props - The shape layer and how to patch it.
 * @returns The shape fields.
 */
function ShapeFields(props: { layer: ShapeLayer; onChange: (next: ShapeLayer) => void }) {
  const t = useTranslations('PanelEditorPage');
  const { layer } = props;

  return (
    <div className="flex flex-col gap-3">
      <ColorField
        label={t('fill_label')}
        onChange={(color) => {
          props.onChange({ ...layer, fill: { kind: 'solid', color } });
        }}
        value={layer.fill.kind === 'solid' ? layer.fill.color : '#000000'}
      />

      <Field htmlFor="layer-radius" label={t('radius_label')}>
        <Input
          id="layer-radius"
          max={MAX_RADIUS}
          min={0}
          onChange={(event) => {
            props.onChange({ ...layer, radius: Number(event.target.value) });
          }}
          type="number"
          value={layer.radius}
        />
      </Field>
    </div>
  );
}

/**
 * Which part of a photo shows.
 *
 * @param props - The image layer and how to patch it.
 * @returns The focus controls.
 */
function ImageFields(props: {
  layer: ImageLayer;
  panelId: string;
  onChange: (next: ImageLayer) => void;
}) {
  const t = useTranslations('PanelEditorPage');
  const { layer } = props;
  const axisLabels = { x: t('focus_x'), y: t('focus_y') };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t('focus_hint')}</p>

      {(['x', 'y'] as const).map((axis) => (
        <label className="flex items-center gap-3 text-sm" htmlFor={`focus-${axis}`} key={axis}>
          <span className="w-16 text-muted-foreground">{axisLabels[axis]}</span>

          <input
            className="flex-1 accent-signal"
            id={`focus-${axis}`}
            max={1}
            min={0}
            onChange={(event) => {
              props.onChange({
                ...layer,
                focus: { ...layer.focus, [axis]: Number(event.target.value) },
              });
            }}
            step={FOCUS_STEP}
            type="range"
            value={layer.focus[axis]}
          />

          <span className="w-10 text-right text-muted-foreground tabular-nums">
            {Math.round(layer.focus[axis] * 100)}
          </span>
        </label>
      ))}

      <ImagePicker
        onPick={(image) => {
          // The asset id is dropped: it pointed at the record for the photo that
          // was here, and this one has no record of its own until it is stored.
          props.onChange({ ...layer, src: image.url, assetId: null });
        }}
        orientation={ORIENTATION_FOR_LAYER}
        panelId={props.panelId}
        slotKey={layer.id}
      />
    </div>
  );
}

/**
 * What can be changed about the selected layer.
 *
 * Text content lives here rather than on the canvas: editing copy in place
 * means fighting the same autofit that decides how big it renders, and a
 * headline that resizes under the cursor while being typed is hard to aim.
 *
 * @param props - The layer and the operations available to it.
 * @returns The inspector.
 */
export function LayerInspector(props: LayerInspectorProps) {
  const t = useTranslations('PanelEditorPage');

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-1">
        <Button
          onClick={() => {
            props.onToggle({ hidden: !props.layer.hidden });
          }}
          size="xs"
          variant="ghost"
        >
          {props.layer.hidden ? (
            <EyeOff className="size-3.5" aria-hidden="true" />
          ) : (
            <Eye className="size-3.5" aria-hidden="true" />
          )}
          {props.layer.hidden ? t('show') : t('hide')}
        </Button>

        <Button
          onClick={() => {
            props.onToggle({ locked: !props.layer.locked });
          }}
          size="xs"
          variant="ghost"
        >
          {props.layer.locked ? (
            <Lock className="size-3.5" aria-hidden="true" />
          ) : (
            <LockOpen className="size-3.5" aria-hidden="true" />
          )}
          {props.layer.locked ? t('unlock') : t('lock')}
        </Button>

        <Button
          disabled={!props.canMoveUp}
          onClick={() => {
            props.onReorder('up');
          }}
          size="xs"
          variant="ghost"
        >
          <MoveUp className="size-3.5" aria-hidden="true" />
          {t('bring_forward')}
        </Button>

        <Button
          disabled={!props.canMoveDown}
          onClick={() => {
            props.onReorder('down');
          }}
          size="xs"
          variant="ghost"
        >
          <MoveDown className="size-3.5" aria-hidden="true" />
          {t('send_backward')}
        </Button>

        <Button onClick={props.onDuplicate} size="xs" variant="ghost">
          <Copy className="size-3.5" aria-hidden="true" />
          {t('duplicate')}
        </Button>

        <Button onClick={props.onRemove} size="xs" variant="ghost">
          <Trash2 className="size-3.5" aria-hidden="true" />
          {t('remove')}
        </Button>
      </div>

      {props.layer.type === 'text' ? (
        <TextFields layer={props.layer} onChange={props.onReplace} />
      ) : null}

      {props.layer.type === 'image' ? (
        <ImageFields layer={props.layer} onChange={props.onReplace} panelId={props.panelId} />
      ) : null}

      {props.layer.type === 'shape' ? (
        <ShapeFields layer={props.layer} onChange={props.onReplace} />
      ) : null}
    </section>
  );
}
