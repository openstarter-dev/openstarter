import { useEffect, useRef, useState } from "react";
import { useValue, type Editor, type TLShapeId } from "tldraw";
import { Expand, Maximize, RotateCw, Trash2 } from "lucide-react";
import type { createScene } from "./scene-engine";
import { createModelAsset, MODEL_CATALOG } from "./asset-library";
import {
  addModelAt,
  deleteModels,
  duplicateModel,
  getModelShape,
  getModelShapes,
  moveModel,
  MODEL_SHAPE_SIZE,
  resizeModel,
  rotateModel,
  setModelRotation,
  setModelScale,
  toSceneItem,
} from "./scene-store";

export function SceneWorkspace({ editor }: { editor: Editor }) {
  const [sceneMode, setSceneMode] = useState(true);
  return (
    <>
      <button className="scene-mode-toggle" onClick={() => setSceneMode(!sceneMode)}>
        {sceneMode ? "切换到参考图 / 便签画板" : "返回模型场景"}
      </button>
      {sceneMode && <SceneSurface editor={editor} />}
    </>
  );
}
function SceneSurface({ editor }: { editor: Editor }) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<ReturnType<typeof createScene> | null>(null);
  const [status, setStatus] = useState("");
  const [hint, setHint] = useState("");
  const hintTimer = useRef<number | undefined>(undefined);
  const showHint = (message: string, options?: { persist?: boolean }) => {
    setHint(message);
    window.clearTimeout(hintTimer.current);
    if (message && !options?.persist)
      hintTimer.current = window.setTimeout(() => setHint(""), 3200);
  };
  const models = useValue("scene models", () => getModelShapes(editor), [editor]);
  const selected = useValue("scene selection", () => editor.getOnlySelectedShapeId(), [editor]);
  const selectedModel = selected ? models.find((m) => m.id === selected) : undefined;
  const sync = () => engine.current?.sync(models.map(toSceneItem), selected ?? null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    const element = host.current;
    if (!element) return;
    void import("./scene-engine")
      .then(({ createScene }) => {
        if (!alive) return;
        engine.current = createScene(element, {
          select: (id) => {
            if (id) editor.select(id as TLShapeId);
            else editor.selectNone();
          },
          dragStart: () => editor.markHistoryStoppingPoint("Move model"),
          move: (id, x, y) => moveModel(editor, id as TLShapeId, x, y),
          rotate: (id, rotation) => setModelRotation(editor, id as TLShapeId, rotation),
          scale: (id, scaleValue) => setModelScale(editor, id as TLShapeId, scaleValue),
          place: (url, x, y) => {
            const entry = MODEL_CATALOG.find((item) => item.url === url);
            if (!entry) return;
            const assetId = createModelAsset(editor, entry);
            addModelAt(editor, url, assetId, x, y, entry.size, entry.container);
          },
          status: (message) => {
            if (alive) setStatus(message);
          },
          hint: (message, options) => {
            if (alive) showHint(message, options);
          },
        });
        setReady(true);
      })
      .catch(() => {
        if (alive) setStatus("无法初始化场景，请确认浏览器支持 WebGL 后刷新。");
      });
    return () => {
      alive = false;
      window.clearTimeout(hintTimer.current);
      engine.current?.dispose();
      engine.current = null;
    };
  }, [editor]);
  useEffect(() => {
    sync();
  }, [models, selected, ready]);
  // Delete removes the selected model; Ctrl/Cmd+D duplicates it. Captured on
  // window so they also fire while the pointer focus is on the WebGL canvas.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.isComposing ||
        event.defaultPrevented ||
        target?.isContentEditable ||
        (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      )
        return;
      const { key } = event;
      if (key === "Delete" || key === "Backspace") {
        const ids = editor.getSelectedShapeIds().filter((id) => getModelShape(editor, id));
        if (ids.length === 0) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        deleteModels(editor, ids);
      } else if ((event.ctrlKey || event.metaKey) && !event.altKey && key.toLowerCase() === "d") {
        const id = editor.getOnlySelectedShapeId();
        if (!id || !getModelShape(editor, id)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        duplicateModel(editor, id);
      } else if (!event.ctrlKey && !event.metaKey && !event.altKey && key.toLowerCase() === "f") {
        const id = editor.getOnlySelectedShapeId();
        if (!id || !getModelShape(editor, id)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        engine.current?.beginFillMode();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [editor]);
  const rotate = () => {
    if (selectedModel) rotateModel(editor, selectedModel.id, Math.PI / 4);
  };
  return (
    <section className="unified-scene" aria-label="统一模型场景">
      <div className="unified-scene-webgl" ref={host} />
      {!models.length && (
        <div className="scene-empty">
          先从左侧拖入「庭院双拼别墅」作为院子，再把植物 / 家具直接拖进院墙范围
        </div>
      )}
      {status && (
        <button className="scene-status" onClick={() => engine.current?.retry()}>
          {status}
        </button>
      )}
      {hint && <div className="scene-hint" role="status">{hint}</div>}
      <div className="scene-tools" role="toolbar" aria-label="Scene controls">
        <span>
          从素材库拖植物/家具进院子（自动吸附院墙）· 左键移动物体 · 右键转向 · 右键空白旋转视角 ·
          滚轮缩放 · 拖角点缩放 · F 填满空间 · Delete 删除 · Ctrl/Cmd+D 复制
        </span>
        <button onClick={() => engine.current?.fit()} title="查看全部">
          <Maximize size={17} />
        </button>
        <button onClick={() => engine.current?.rotateAll(Math.PI / 4)}>
          <RotateCw size={17} />
          整体视角
        </button>
        <button disabled={!selectedModel} onClick={rotate}>
          旋转物体 45°
        </button>
        <button
          disabled={!selectedModel}
          title="让选中物体占满目标物体的占地范围，再点击目标 (F)"
          onClick={() => engine.current?.beginFillMode()}
        >
          <Expand size={17} />
          填满空间
        </button>
        <label>
          大小
          <input
            aria-label="Selected model size"
            type="range"
            min={Math.round(MODEL_SHAPE_SIZE * 0.15)}
            max={MODEL_SHAPE_SIZE * 12}
            value={selectedModel?.props.w ?? MODEL_SHAPE_SIZE}
            disabled={!selectedModel}
            onPointerDown={() => editor.markHistoryStoppingPoint("Resize model")}
            onChange={(e) => {
              if (selectedModel)
                resizeModel(editor, selectedModel.id, Number(e.target.value));
            }}
          />
        </label>
        <button
          disabled={!selectedModel}
          aria-label="Delete selected model"
          title="删除选中模型 (Delete)"
          onClick={() => selectedModel && deleteModels(editor, [selectedModel.id])}
        >
          <Trash2 size={17} />
        </button>
      </div>
    </section>
  );
}
