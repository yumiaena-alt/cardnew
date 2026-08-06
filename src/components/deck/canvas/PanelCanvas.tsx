'use client';

import type Konva from 'konva';
import { useEffect, useRef, useState } from 'react';
import { Image as KonvaImage, Layer, Rect, Stage, Text, Transformer } from 'react-konva';
import { docCanvasSize } from '@/lib/slidedoc/doc';
import type { SlideDoc } from '@/lib/slidedoc/doc';
import type { Rect as MeasuredRect } from '@/lib/slidedoc/geometry';
import { rectToOffset } from '@/lib/slidedoc/geometry';
import type { Layer as DocLayer } from '@/lib/slidedoc/layers';

type PanelCanvasProps = {
  doc: SlideDoc;
  selectedId: string | null;
  /** Width the stage is drawn at. The document keeps its own logical size. */
  displayWidth: number;
  /**
   * Boxes the typesetter measured, in logical canvas pixels.
   *
   * The document mostly leaves height out — a text layer grows to fit its copy,
   * and how tall that is cannot be known without measuring. Drawing from the
   * document alone put layers where the render service does not, so the canvas
   * draws from the same measurement the renderer uses.
   */
  rects: Record<string, MeasuredRect>;
  /** Font sizes autofit settled on, by layer id. */
  fittedSizes: Record<string, number>;
  onSelect: (layerId: string | null) => void;
  onLayerChange: (layerId: string, layout: Partial<DocLayer['layout']>) => void;
};

/**
 * Loads an image for a layer, or nothing while it is still arriving.
 *
 * Konva draws from an HTMLImageElement rather than a URL, so the element has to
 * exist before the node renders. Returning null until then leaves a gap rather
 * than drawing a broken box.
 *
 * @param src - Image URL, empty when the layer has none.
 * @returns The loaded element, or null.
 */
function useLoadedImage(src: string): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (src === '') {
      setImage(null);

      return () => {
        // Nothing was started, so nothing needs unwinding.
      };
    }

    const element = new window.Image();
    const onLoad = () => {
      setImage(element);
    };

    element.addEventListener('load', onLoad);
    element.crossOrigin = 'anonymous';
    element.src = src;

    return () => {
      element.removeEventListener('load', onLoad);
    };
  }, [src]);

  return image;
}

type NodeProps = {
  layer: DocLayer;
  canvas: { width: number; height: number };
  /** The measured box, when the typesetter produced one for this layer. */
  rect: MeasuredRect | undefined;
  fittedSize: number | undefined;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (layout: Partial<DocLayer['layout']>) => void;
};

/**
 * Places a layer on the stage.
 *
 * Prefers the measured rectangle. The document's own box is a fallback for a
 * layer the typesetter did not produce one for, and its height is a guess —
 * which is why it is not the first choice.
 *
 * @param layer - The layer being placed.
 * @param canvas - Logical canvas size in pixels.
 * @param rect - The measured box, when there is one.
 * @returns The pixel box for this layer.
 */
function toPixels(
  layer: DocLayer,
  canvas: { width: number; height: number },
  rect: MeasuredRect | undefined,
) {
  if (rect) {
    return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
  }

  return {
    x: layer.layout.x * canvas.width,
    y: layer.layout.y * canvas.height,
    width: layer.layout.w * canvas.width,
    height: (layer.layout.h ?? 0.2) * canvas.height,
  };
}

/**
 * Reports a move back as an anchor offset.
 *
 * Position only, and put back through the anchor. A drag that also wrote width
 * and height would freeze whatever was measured at that instant into the
 * document, and a text layer measures to nothing until its copy is laid out —
 * dragging a headline collapsed it to a point. Writing the raw pixel into `x`
 * was the other half: the next typeset re-applies the anchor and the layer
 * lands back where it started, so the drag appears to do nothing at all.
 *
 * @param node - The node that moved.
 * @param layer - The layer it belongs to, for its anchor and size.
 * @param canvas - Logical canvas size in pixels.
 * @returns The position patch to store.
 */
function toPosition(node: Konva.Node, layer: DocLayer, canvas: { width: number; height: number }) {
  return rectToOffset({ left: node.x(), top: node.y() }, layer.layout, canvas, node.height());
}

/**
 * Reports a resize back as ratios.
 *
 * Konva hands back a scale factor rather than a new size, so the scale is
 * folded into the box and reset — otherwise the next resize compounds it and
 * the layer runs away.
 *
 * @param node - The node that was resized.
 * @param layer - The layer it belongs to, for its anchor.
 * @param canvas - Logical canvas size in pixels.
 * @returns The layout patch to store.
 */
function toLayout(node: Konva.Node, layer: DocLayer, canvas: { width: number; height: number }) {
  const scaleX = node.scaleX();
  const scaleY = node.scaleY();

  node.scaleX(1);
  node.scaleY(1);

  return {
    ...toPosition(node, layer, canvas),
    w: (node.width() * scaleX) / canvas.width,
    h: (node.height() * scaleY) / canvas.height,
    rotate: node.rotation(),
  };
}

/**
 * The part of an image that fills a box, given where its focus sits.
 *
 * This is `object-fit: cover` with `object-position` written out: scale so the
 * shorter side covers, then slide the visible window across the overflow by the
 * focus ratio. `contain` shows the whole image, so it crops nothing.
 *
 * @param image - The loaded element, for its natural size.
 * @param box - The box being filled, in canvas pixels.
 * @param focus - Where the interesting part is, 0.5/0.5 being the middle.
 * @param fit - Whether the image covers the box or fits inside it.
 * @returns The source rectangle to draw from.
 */
function coverCrop(
  image: HTMLImageElement,
  box: { width: number; height: number },
  focus: { x: number; y: number },
  fit: 'contain' | 'cover',
) {
  const full = { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight };

  if (fit === 'contain' || box.width === 0 || box.height === 0) {
    return full;
  }

  const scale = Math.max(box.width / image.naturalWidth, box.height / image.naturalHeight);
  const visible = { width: box.width / scale, height: box.height / scale };

  return {
    x: (image.naturalWidth - visible.width) * focus.x,
    y: (image.naturalHeight - visible.height) * focus.y,
    width: visible.width,
    height: visible.height,
  };
}

/**
 * One layer as a canvas node.
 *
 * @param props - The layer, canvas size, and selection callbacks.
 * @returns The node, or nothing for a hidden layer.
 */
function LayerNode(props: NodeProps) {
  const box = toPixels(props.layer, props.canvas, props.rect);
  const image = useLoadedImage(props.layer.type === 'image' ? props.layer.src : '');

  const shared = {
    ...box,
    id: props.layer.id,
    rotation: props.layer.layout.rotate,
    opacity: props.layer.opacity,
    draggable: !props.layer.locked,
    onClick: props.onSelect,
    onTap: props.onSelect,
    onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => {
      props.onChange(toPosition(event.target, props.layer, props.canvas));
    },
    onTransformEnd: (event: Konva.KonvaEventObject<Event>) => {
      props.onChange(toLayout(event.target, props.layer, props.canvas));
    },
  };

  if (props.layer.hidden) {
    return null;
  }

  if (props.layer.type === 'text') {
    return (
      <Text
        {...shared}
        fill={props.layer.style.color}
        fontSize={props.fittedSize ?? props.layer.style.size ?? 48}
        fontStyle={props.layer.style.italic ? 'italic' : 'normal'}
        lineHeight={props.layer.style.lineHeight}
        text={props.layer.text}
      />
    );
  }

  if (props.layer.type === 'image') {
    if (!image) {
      return null;
    }

    return (
      <KonvaImage
        {...shared}
        // Cropped rather than stretched. The renderer draws these with CSS
        // `object-fit: cover` and `object-position`, and a canvas that squashed
        // the photo to the box instead would show a different picture than the
        // one that gets published.
        crop={coverCrop(image, box, props.layer.focus, props.layer.fit)}
        image={image}
      />
    );
  }

  return <Rect {...shared} fill="rgba(0,0,0,0.15)" />;
}

/**
 * The editable card.
 *
 * Draws the slide document straight from its layers rather than from a separate
 * canvas model. There is no second representation to keep in sync: what is
 * dragged here is the same document the render service is given, so what the
 * editor shows and what gets published cannot drift apart.
 *
 * @param props - The document, selection, and change callbacks.
 * @returns The canvas stage.
 */
export function PanelCanvas(props: PanelCanvasProps) {
  const canvas = docCanvasSize(props.doc);
  const scale = props.displayWidth / canvas.width;
  const transformer = useRef<Konva.Transformer>(null);
  const stage = useRef<Konva.Stage>(null);

  useEffect(() => {
    const node = props.selectedId ? (stage.current?.findOne(`#${props.selectedId}`) ?? null) : null;

    transformer.current?.nodes(node ? [node] : []);
    transformer.current?.getLayer()?.batchDraw();
  }, [props.selectedId]);

  return (
    <Stage
      className="rounded-lg border border-border bg-card"
      height={canvas.height * scale}
      onMouseDown={(event) => {
        // A click that lands on the stage itself is a click on nothing.
        if (event.target === event.target.getStage()) {
          props.onSelect(null);
        }
      }}
      ref={stage}
      scaleX={scale}
      scaleY={scale}
      width={props.displayWidth}
    >
      <Layer>
        <Rect
          fill={props.doc.canvas.bg.kind === 'solid' ? props.doc.canvas.bg.color : '#FFFFFF'}
          height={canvas.height}
          width={canvas.width}
          x={0}
          y={0}
        />

        {props.doc.layers.map((layer) => (
          <LayerNode
            canvas={canvas}
            fittedSize={props.fittedSizes[layer.id]}
            isSelected={layer.id === props.selectedId}
            key={layer.id}
            layer={layer}
            rect={props.rects[layer.id]}
            onChange={(layout) => {
              props.onLayerChange(layer.id, layout);
            }}
            onSelect={() => {
              props.onSelect(layer.id);
            }}
          />
        ))}

        <Transformer
          // Below this a handle is bigger than the thing it resizes.
          boundBoxFunc={(oldBox, newBox) => (newBox.width < 20 ? oldBox : newBox)}
          ref={transformer}
        />
      </Layer>
    </Stage>
  );
}
