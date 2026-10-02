import {
  createShapeId,
  type Editor,
  type TLAssetId,
  type TLImageShape,
  type TLShape,
  type TLShapeId,
} from "tldraw";
import { MODEL_URLS } from "./model-shape";
import type { SceneItem } from "./scene-engine";

/**
 * Scene models live as tldraw image shapes carrying `meta.modelUrl`.
 * The 3D engine renders the same state, so every shape <-> scene coordinate
 * conversion must go through this module (the single seam for AI auto-layout).
 */

/** tldraw page units per scene meter. */
const PAGE_UNITS_PER_SCENE_UNIT = 100;
/** Shape width/height in page units when the scene scale is 1. */
export const MODEL_SHAPE_SIZE = 340;
/** Offset applied when adding / duplicating a model, in page units. */
const PLACEMENT_NUDGE = 140;

export function isModelShape(shape: TLShape | undefined): shape is TLImageShape {
  return (
    Boolean(shape) &&
    shape!.type === "image" &&
    typeof shape!.meta.modelUrl === "string" &&
    MODEL_URLS.includes(shape!.meta.modelUrl)
  );
}

export function getModelShapes(editor: Editor): TLImageShape[] {
  return editor.getCurrentPageShapes().filter(isModelShape);
}

export function getModelShape(editor: Editor, id: TLShapeId): TLImageShape | undefined {
  const shape = editor.getShape(id);
  return isModelShape(shape) ? shape : undefined;
}

/** Convert a stored shape into the normalized item the 3D engine consumes. */
export function toSceneItem(shape: TLImageShape): SceneItem {
  return {
    id: shape.id,
    url: String(shape.meta.modelUrl),
    x: shape.x / PAGE_UNITS_PER_SCENE_UNIT,
    y: shape.y / PAGE_UNITS_PER_SCENE_UNIT,
    rotation: shape.rotation,
    scale: shape.props.w / MODEL_SHAPE_SIZE,
    isContainer: shape.meta.container === true,
  };
}

/** Place one more instance of an already-registered GLB asset. */
export function addModel(
  editor: Editor,
  url: string,
  assetId: TLAssetId,
  size: number = MODEL_SHAPE_SIZE,
  container = false,
): TLShapeId {
  const id = createShapeId();
  const placed = getModelShapes(editor).length;
  editor.markHistoryStoppingPoint("Add 3D model");
  editor.createShape({
    id,
    type: "image",
    x: placed * (size * 0.45 + 40),
    y: 0,
    props: { assetId, w: size, h: size },
    meta: { modelUrl: url, container },
  });
  editor.setCurrentTool("select");
  editor.select(id);
  return id;
}

/**
 * Place a model dropped at a concrete scene position (scene meters, the same
 * center convention the ground drag uses).
 */
export function addModelAt(
  editor: Editor,
  url: string,
  assetId: TLAssetId,
  x: number,
  y: number,
  size: number = MODEL_SHAPE_SIZE,
  container = false,
): TLShapeId {
  const id = createShapeId();
  editor.markHistoryStoppingPoint("Drop 3D model into yard");
  editor.createShape({
    id,
    type: "image",
    x: x * PAGE_UNITS_PER_SCENE_UNIT,
    y: y * PAGE_UNITS_PER_SCENE_UNIT,
    props: { assetId, w: size, h: size },
    meta: { modelUrl: url, container },
  });
  editor.setCurrentTool("select");
  editor.select(id);
  return id;
}

/** Duplicate a model (same GLB template, new placement). */
export function duplicateModel(editor: Editor, id: TLShapeId): TLShapeId | null {
  const source = getModelShape(editor, id);
  if (!source) return null;
  const newId = createShapeId();
  editor.markHistoryStoppingPoint("Duplicate 3D model");
  editor.createShape({
    id: newId,
    type: "image",
    x: source.x + PLACEMENT_NUDGE,
    y: source.y + PLACEMENT_NUDGE,
    rotation: source.rotation,
    props: { ...source.props },
    meta: { ...source.meta },
  });
  editor.select(newId);
  return newId;
}

export function deleteModels(editor: Editor, ids: TLShapeId[]) {
  const removable = ids.filter((id) => Boolean(getModelShape(editor, id)));
  if (removable.length === 0) return;
  editor.markHistoryStoppingPoint("Delete 3D model");
  editor.deleteShapes(removable);
}

/** Persist a ground-plane drag from the 3D engine. Coordinates are scene meters. */
export function moveModel(editor: Editor, id: TLShapeId, x: number, y: number) {
  editor.updateShapes([
    {
      id,
      type: "image",
      x: x * PAGE_UNITS_PER_SCENE_UNIT,
      y: y * PAGE_UNITS_PER_SCENE_UNIT,
    },
  ]);
}

export function rotateModel(editor: Editor, id: TLShapeId, delta: number) {
  const shape = getModelShape(editor, id);
  if (!shape) return;
  editor.markHistoryStoppingPoint("Rotate 3D model");
  editor.updateShapes([
    { id, type: "image", rotation: (shape.rotation + delta) % (Math.PI * 2) },
  ]);
}

/** Set absolute yaw (shape convention, radians), e.g. after a right-drag rotate. */
export function setModelRotation(editor: Editor, id: TLShapeId, rotation: number) {
  if (!getModelShape(editor, id)) return;
  const normalized = ((rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  editor.markHistoryStoppingPoint("Rotate 3D model");
  editor.updateShapes([{ id, type: "image", rotation: normalized }]);
}

export function resizeModel(editor: Editor, id: TLShapeId, size: number) {
  editor.updateShapes([{ id, type: "image", props: { w: size, h: size } }]);
}

/** Set absolute uniform scale (1 = default size), e.g. from viewport handles. */
export function setModelScale(editor: Editor, id: TLShapeId, scale: number) {
  if (!getModelShape(editor, id)) return;
  const size = Math.max(1, Math.round(scale * MODEL_SHAPE_SIZE));
  editor.updateShapes([{ id, type: "image", props: { w: size, h: size } }]);
}

/**
 * Programmatic layout entry point — the seam for AI auto-layout.
 * Coordinates use scene meters (same ground plane the user drags on);
 * `rotation` is radians around the Y axis. Omitted fields stay untouched.
 *
 * @example
 * applySceneLayout(editor, [
 *   { id, x: 2, y: -1.5, rotation: Math.PI / 2 },
 * ]);
 */
export type ScenePlacement = {
  id: TLShapeId;
  x?: number;
  y?: number;
  rotation?: number;
  scale?: number;
};

export function applySceneLayout(editor: Editor, placements: ScenePlacement[]) {
  const updates = placements.flatMap((placement) => {
    if (!getModelShape(editor, placement.id)) return [];
    return [
      {
        id: placement.id,
        type: "image" as const,
        x:
          placement.x === undefined
            ? undefined
            : placement.x * PAGE_UNITS_PER_SCENE_UNIT,
        y:
          placement.y === undefined
            ? undefined
            : placement.y * PAGE_UNITS_PER_SCENE_UNIT,
        rotation: placement.rotation === undefined ? undefined : -placement.rotation,
        props:
          placement.scale === undefined
            ? undefined
            : {
                w: placement.scale * MODEL_SHAPE_SIZE,
                h: placement.scale * MODEL_SHAPE_SIZE,
              },
      },
    ];
  });
  if (updates.length === 0) return;
  editor.markHistoryStoppingPoint("Auto layout 3D models");
  editor.updateShapes(updates);
}
