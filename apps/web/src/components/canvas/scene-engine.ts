import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";

export type SceneItem = {
  id: string;
  url: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  /** Containers (courtyard villa) define the yard bounds other items clamp to. */
  isContainer?: boolean;
};
/** One renderer and one load per GLB, regardless of the number of placements. */
export function createScene(
  host: HTMLElement,
  callbacks: {
    select: (id: string | null) => void;
    move: (id: string, x: number, y: number) => void;
    /** Rotation in the stored shape convention (scene yaw negated). */
    rotate: (id: string, rotation: number) => void;
    /** Absolute uniform scale, e.g. after dragging a scale handle. */
    scale: (id: string, scale: number) => void;
    /** A material was dropped from the library at scene position (x, z meters). */
    place: (url: string, x: number, y: number) => void;
    dragStart: () => void;
    status: (message: string) => void;
    /** Transient interaction hint (no retry semantics). */
    hint: (message: string, options?: { persist?: boolean }) => void;
  },
) {
  const MIN_SCALE = 0.15;
  const MAX_SCALE = 12;
  /** Click-vs-drag threshold in CSS pixels. */
  const CLICK_THRESHOLD = 6;
  /** Inset between the container wall and the clappable area, in meters. */
  const YARD_MARGIN = 0.12;
  /** Edge/center snap distance while dragging inside the yard, in meters. */
  const YARD_SNAP = 0.35;
  /** Assumed half-footprint for the drop marker before the GLB finishes loading. */
  const DROP_FOOTPRINT_HALF = 0.5;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#303633");
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 2000);
  camera.position.set(6, 7, 9);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2 - 0.03;
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.PAN,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.ROTATE,
  };
  controls.target.set(0, 0, 0);
  controls.update();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x667562, 3));
  const sun = new THREE.DirectionalLight(0xfff5e3, 3);
  sun.position.set(5, 10, 6);
  scene.add(sun);
  const grid = new THREE.GridHelper(200, 200, 0x63746a, 0x444d47);
  scene.add(grid);
  const selection = new THREE.BoxHelper(new THREE.Object3D(), 0xa5d6a7);
  selection.visible = false;
  scene.add(selection);
  // Four uniform-scale handles at the top corners of the selected model's
  // world footprint. Shown through objects so nested items stay grabbable.
  const handleGeometry = new THREE.SphereGeometry(1, 16, 12);
  const handleMaterial = new THREE.MeshBasicMaterial({
    color: 0xa5d6a7,
    depthTest: false,
  });
  const handles = new THREE.Group();
  const handleMeshes = Array.from({ length: 4 }, () => {
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.visible = false;
    handle.renderOrder = 999;
    handle.userData.scaleHandle = true;
    handles.add(handle);
    return handle;
  });
  handles.visible = false;
  scene.add(handles);
  // Yard boundary: the footprint rectangle of the largest container model.
  const yardMaterial = new THREE.LineBasicMaterial({
    color: 0x86b794,
    transparent: true,
    opacity: 0.45,
  });
  const yardGeometry = new THREE.BufferGeometry();
  yardGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(12), 3),
  );
  const yardRect = new THREE.LineLoop(yardGeometry, yardMaterial);
  yardRect.visible = false;
  yardRect.position.y = 0.04;
  scene.add(yardRect);
  // Snap guides (edge / center alignment) shown while dragging in the yard.
  const guideMaterial = new THREE.LineBasicMaterial({
    color: 0xffd54f,
    transparent: true,
    opacity: 0.95,
    depthTest: false,
  });
  const guideGeometry = new THREE.BufferGeometry();
  guideGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(12), 3),
  );
  guideGeometry.setDrawRange(0, 0);
  const guideLines = new THREE.LineSegments(guideGeometry, guideMaterial);
  guideLines.visible = false;
  guideLines.renderOrder = 998;
  scene.add(guideLines);
  // Ground marker shown while dragging a library card over the viewport.
  const dropMaterial = new THREE.MeshBasicMaterial({
    color: 0xa5d6a7,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
    depthTest: false,
  });
  const dropMarker = new THREE.Mesh(
    new THREE.RingGeometry(0.24, 0.32, 36),
    dropMaterial,
  );
  dropMarker.rotation.x = -Math.PI / 2;
  dropMarker.position.y = 0.06;
  dropMarker.visible = false;
  dropMarker.renderOrder = 997;
  scene.add(dropMarker);
  const templates = new Map<string, Promise<THREE.Object3D>>();
  const loaded = new Set<THREE.Object3D>();
  const objects = new Map<string, THREE.Object3D>();
  const desired = new Map<string, SceneItem>();
  const pending = new Set<string>();
  const failed = new Set<string>();
  let alive = true;
  let selected: string | null = null;
  let firstFit = true;
  type Drag =
    | {
        mode: "move";
        id: string;
        offset: THREE.Vector3;
        start: THREE.Vector3;
        pointer: number;
      }
    | {
        mode: "rotate";
        id: string;
        startAngle: number;
        startYaw: number;
        pointer: number;
      }
    | {
        mode: "scale";
        id: string;
        startDist: number;
        startScale: number;
        pointer: number;
      };
  let drag: Drag | null = null;
  /** Pending gesture bookkeeping for click-vs-drag and selection cycling. */
  let gesture: {
    pointer: number;
    button: number;
    startX: number;
    startY: number;
    hits: string[];
    selectedAtDown: string | null;
  } | null = null;
  let fillArmed = false;
  /** Largest container footprint — the yard other items are constrained to. */
  let yardId: string | null = null;
  let yardBox: THREE.Box3 | null = null;
  const tmpBox = new THREE.Box3();
  const tmpSize = new THREE.Vector3();
  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const loader = new GLTFLoader();
  function disposeRoot(root: THREE.Object3D) {
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
        mat.dispose();
      }
    });
  }
  function template(url: string) {
    if (!templates.has(url))
      templates.set(
        url,
        loader
          .loadAsync(url)
          .then((gltf) => {
            const source = gltf.scene;
            if (!alive) {
              disposeRoot(source);
              throw new Error("Scene closed");
            }
            const box = new THREE.Box3().setFromObject(source);
            if (box.isEmpty()) throw new Error("Empty model");
            const size = box.getSize(new THREE.Vector3());
            const factor = 1 / Math.max(size.x, size.y, size.z, 0.01);
            source.scale.multiplyScalar(factor);
            const normalized = new THREE.Box3().setFromObject(source);
            const center = normalized.getCenter(new THREE.Vector3());
            source.position.sub(new THREE.Vector3(center.x, normalized.min.y, center.z));
            const root = new THREE.Group();
            root.add(source);
            loaded.add(root);
            return root;
          })
          .catch((error) => {
            templates.delete(url);
            throw error;
          }),
      );
    return templates.get(url)!;
  }
  function updateSelection() {
    const object = selected ? objects.get(selected) : null;
    selection.visible = Boolean(object);
    if (object) selection.setFromObject(object);
    updateHandles();
  }
  const clampScale = (value: number) =>
    Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
  /** All model ids under the pointer, front to back, de-duplicated. */
  function pickModels(): string[] {
    const hits = ray.intersectObjects([...objects.values()], true);
    const ids: string[] = [];
    for (const hit of hits) {
      let node: THREE.Object3D | null = hit.object;
      while (node && !node.userData.modelId) node = node.parent;
      const id = node?.userData.modelId as string | undefined;
      if (id && objects.has(id) && !ids.includes(id)) ids.push(id);
    }
    return ids;
  }
  /** Reposition the four scale handles at the selected model's top corners. */
  function updateHandles() {
    const object = selected ? objects.get(selected) : null;
    if (!object) {
      handles.visible = false;
      handleMeshes.forEach((h) => (h.visible = false));
      return;
    }
    handles.visible = true;
    tmpBox.setFromObject(object);
    tmpBox.getSize(tmpSize);
    const radius = Math.max(tmpSize.x, tmpSize.z) / 2;
    const handleSize = Math.min(0.3, Math.max(0.03, radius * 0.14));
    const corners: Array<[number, number]> = [
      [tmpBox.min.x, tmpBox.min.z],
      [tmpBox.max.x, tmpBox.min.z],
      [tmpBox.max.x, tmpBox.max.z],
      [tmpBox.min.x, tmpBox.max.z],
    ];
    corners.forEach(([x, z], i) => {
      const handle = handleMeshes[i];
      handle.visible = true;
      handle.position.set(x, tmpBox.max.y + handleSize * 0.4, z);
      handle.scale.setScalar(handleSize);
    });
  }
  // ---- Yard boundary: clamp + snap -------------------------------------
  /** Re-pick the largest container and refresh its ground rectangle. */
  function refreshYard() {
    const yard = [...objects.entries()]
      .filter(([, obj]) => Boolean(obj.userData.isContainer))
      .map(([id, obj]) => {
        const box = new THREE.Box3().setFromObject(obj);
        const size = box.getSize(new THREE.Vector3());
        return { id, box, area: size.x * size.z };
      })
      .filter((entry) => entry.area > 0)
      .sort((a, b) => b.area - a.area)[0];
    yardId = yard?.id ?? null;
    yardBox = yard?.box ?? null;
    const attr = yardGeometry.getAttribute("position") as THREE.BufferAttribute;
    if (yardBox) {
      const { min, max } = yardBox;
      attr.array.set([
        min.x, 0, min.z, max.x, 0, min.z, max.x, 0, max.z, min.x, 0, max.z,
      ]);
      attr.needsUpdate = true;
    }
    yardRect.visible = Boolean(yardBox);
  }
  function setYardActive(active: boolean) {
    yardMaterial.opacity = active ? 0.95 : 0.45;
  }
  /**
   * Keep an object's half-footprint inside [boundMin, boundMax].
   * Snaps to the near/far wall or the yard center line within YARD_SNAP.
   */
  function clampAxis(value: number, half: number, boundMin: number, boundMax: number) {
    const lo = boundMin + YARD_MARGIN + half;
    const hi = boundMax - YARD_MARGIN - half;
    if (lo > hi) return { value: (boundMin + boundMax) / 2, snapped: false };
    let snappedAt: number | null = null;
    for (const candidate of [lo, hi, (boundMin + boundMax) / 2]) {
      if (
        Math.abs(value - candidate) <= YARD_SNAP &&
        (snappedAt === null || Math.abs(value - candidate) < Math.abs(value - snappedAt))
      )
        snappedAt = candidate;
    }
    return {
      value: snappedAt ?? Math.min(hi, Math.max(lo, value)),
      snapped: snappedAt !== null,
    };
  }
  /** Constrain a desired ground position to the yard; report snapped axes. */
  function constrainPosition(
    id: string | null,
    desired: THREE.Vector3,
    halfX: number,
    halfZ: number,
  ) {
    const snaps: Array<"x" | "z"> = [];
    let x = desired.x;
    let z = desired.z;
    if (yardBox && id !== yardId) {
      const rx = clampAxis(x, halfX, yardBox.min.x, yardBox.max.x);
      const rz = clampAxis(z, halfZ, yardBox.min.z, yardBox.max.z);
      x = rx.value;
      z = rz.value;
      if (rx.snapped) snaps.push("x");
      if (rz.snapped) snaps.push("z");
    }
    return { position: new THREE.Vector3(x, 0, z), snaps };
  }
  function showGuides(snaps: Array<"x" | "z">, x: number, z: number) {
    const attr = guideGeometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    let n = 0;
    if (yardBox)
      for (const axis of snaps) {
        if (axis === "x") {
          arr[n++] = x; arr[n++] = 0.07; arr[n++] = yardBox.min.z;
          arr[n++] = x; arr[n++] = 0.07; arr[n++] = yardBox.max.z;
        } else {
          arr[n++] = yardBox.min.x; arr[n++] = 0.07; arr[n++] = z;
          arr[n++] = yardBox.max.x; arr[n++] = 0.07; arr[n++] = z;
        }
      }
    attr.needsUpdate = true;
    guideGeometry.setDrawRange(0, n / 3);
    guideLines.visible = n > 0;
  }
  function hideGuides() {
    guideGeometry.setDrawRange(0, 0);
    guideLines.visible = false;
  }
  /** Uniformly scale `sourceId` so it fits inside `targetId`'s footprint. */
  function fillInside(sourceId: string, targetId: string) {
    if (sourceId === targetId) {
      callbacks.hint("已取消填满");
      return;
    }
    const source = objects.get(sourceId);
    const target = objects.get(targetId);
    if (!source || !target) return;
    const sourceSize = tmpBox.setFromObject(source).getSize(tmpSize);
    const targetBox = new THREE.Box3().setFromObject(target);
    const targetSize = targetBox.getSize(new THREE.Vector3());
    if (sourceSize.x <= 0 || sourceSize.z <= 0 || targetSize.x <= 0 || targetSize.z <= 0) {
      callbacks.hint("目标物体没有可用的占地范围");
      return;
    }
    // Fit the longer footprint edge inside with an 8% margin.
    const ratio =
      Math.min(targetSize.x / sourceSize.x, targetSize.z / sourceSize.z) * 0.92;
    const next = clampScale(source.scale.x * ratio);
    source.scale.setScalar(next);
    updateSelection();
    callbacks.scale(sourceId, next);
    callbacks.hint("已占满目标物体的占地范围");
  }
  function setFillArmed(armed: boolean) {
    fillArmed = armed;
    renderer.domElement.style.cursor = armed ? "crosshair" : "";
    if (armed)
      callbacks.hint("点击要占满的目标物体 · Esc 取消（小物体可先放进别墅再填满）", {
        persist: true,
      });
    else callbacks.hint("");
  }
  function beginFillMode() {
    const object = selected ? objects.get(selected) : null;
    if (!object) {
      callbacks.hint("请先选中要缩放的物体");
      return;
    }
    setFillArmed(true);
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && fillArmed) setFillArmed(false);
  };
  window.addEventListener("keydown", onKeyDown);
  function fit() {
    const box = new THREE.Box3();
    objects.forEach((o) => box.expandByObject(o));
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const extent = Math.max(box.getSize(new THREE.Vector3()).length(), 3);
    controls.target.copy(center);
    camera.position
      .copy(center)
      .add(new THREE.Vector3(1, 1.1, 1.4).normalize().multiplyScalar(extent * 1.7));
    controls.update();
  }
  function sync(items: SceneItem[], selectedId: string | null) {
    desired.clear();
    items.forEach((i) => desired.set(i.id, i));
    selected = selectedId;
    for (const [id, obj] of objects) {
      if (!desired.has(id)) {
        scene.remove(obj);
        objects.delete(id);
        failed.delete(id);
      }
    }
    for (const item of items) {
      const obj = objects.get(item.id);
      if (obj) {
        if (drag?.id !== item.id) {
          obj.position.set(item.x, 0, item.y);
          obj.rotation.y = -item.rotation;
          obj.scale.setScalar(item.scale);
        }
      } else if (!pending.has(item.id) && !failed.has(item.id)) {
        pending.add(item.id);
        callbacks.status("正在加载模型…");
        void template(item.url)
          .then((source) => {
            if (!alive || !desired.has(item.id)) return;
            const instance = clone(source);
            instance.userData.modelId = item.id;
            instance.userData.isContainer = Boolean(desired.get(item.id)?.isContainer);
            objects.set(item.id, instance);
            scene.add(instance);
            sync([...desired.values()], selected);
            // Newly loaded item: if a yard already exists, keep it inside.
            if (yardBox && !instance.userData.isContainer) {
              const box = new THREE.Box3().setFromObject(instance);
              const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
              const result = constrainPosition(item.id, instance.position, half.x, half.z);
              if (result.position.distanceToSquared(instance.position) > 1e-6) {
                instance.position.copy(result.position);
                callbacks.move(item.id, result.position.x, result.position.z);
              }
            }
            if (firstFit) {
              fit();
              firstFit = false;
            }
          })
          .catch(() => {
            if (alive) {
              failed.add(item.id);
              callbacks.status("模型加载失败，点击重试");
            }
          })
          .finally(() => {
            pending.delete(item.id);
            if (alive && pending.size === 0 && failed.size === 0) callbacks.status("");
          });
      }
    }
    refreshYard();
    updateSelection();
  }
  function cast(event: PointerEvent) {
    castFromClient(event.clientX, event.clientY);
  }
  function castFromClient(clientX: number, clientY: number) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      (-(clientY - rect.top) / rect.height) * 2 + 1,
    );
    ray.setFromCamera(mouse, camera);
  }
  // ---- Drag a material card from the library into the yard -------------
  const hasModelDrag = (event: DragEvent) =>
    Array.from(event.dataTransfer?.types ?? []).includes("application/x-scene-model");
  /** Ground point for a drop, already constrained to the yard footprint. */
  function dropPoint(clientX: number, clientY: number) {
    castFromClient(clientX, clientY);
    const point = ray.ray.intersectPlane(ground, new THREE.Vector3());
    if (!point) return null;
    if (!yardBox) return point;
    return constrainPosition(
      null,
      point,
      DROP_FOOTPRINT_HALF,
      DROP_FOOTPRINT_HALF,
    ).position;
  }
  function onDragEnter(event: DragEvent) {
    if (hasModelDrag(event)) event.preventDefault();
  }
  function onDragOver(event: DragEvent) {
    if (!hasModelDrag(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    const point = dropPoint(event.clientX, event.clientY);
    if (point) {
      dropMarker.position.set(point.x, 0.06, point.z);
      dropMarker.visible = true;
      setYardActive(true);
    } else {
      dropMarker.visible = false;
    }
  }
  function onDragLeave(event: DragEvent) {
    // relatedTarget is null when the pointer actually leaves the canvas.
    if (!event.relatedTarget) {
      dropMarker.visible = false;
      setYardActive(false);
    }
  }
  function onDrop(event: DragEvent) {
    if (!hasModelDrag(event)) return;
    event.preventDefault();
    const url = event.dataTransfer?.getData("application/x-scene-model") ?? "";
    const point = dropPoint(event.clientX, event.clientY);
    dropMarker.visible = false;
    setYardActive(false);
    if (point && url) callbacks.place(url, point.x, point.z);
  }
  /** The model to act on: the current selection when it is under the
   *  pointer (so nested items stay draggable), otherwise the front-most hit. */
  function resolveTarget(hits: string[]): string | null {
    if (selected && hits.includes(selected)) return selected;
    return hits[0] ?? null;
  }
  function down(event: PointerEvent) {
    if (drag || (event.button !== 0 && event.button !== 2)) return;
    cast(event);
    // Fill-space mode consumes the next left click; Esc cancels it.
    if (fillArmed) {
      if (event.button !== 0) return;
      const fillHits = pickModels();
      if (fillHits.length && selected) {
        fillInside(selected, fillHits[0]);
        fillArmed = false;
        renderer.domElement.style.cursor = "";
      } else {
        callbacks.hint("没有点到物体，继续点击目标或按 Esc 取消");
      }
      event.stopImmediatePropagation();
      return;
    }
    // Scale handles take priority over model picking.
    if (event.button === 0 && handles.visible && selected) {
      const handleHit = ray.intersectObjects(handleMeshes, false)[0];
      const obj = objects.get(selected);
      const p = ray.ray.intersectPlane(ground, new THREE.Vector3());
      if (handleHit && obj && p) {
        const startDist = p.distanceTo(obj.position);
        if (startDist > 1e-4) {
          controls.enabled = false;
          callbacks.dragStart();
          renderer.domElement.setPointerCapture(event.pointerId);
          drag = {
            mode: "scale",
            id: selected,
            startDist,
            startScale: obj.scale.x,
            pointer: event.pointerId,
          };
          gesture = {
            pointer: event.pointerId,
            button: event.button,
            startX: event.clientX,
            startY: event.clientY,
            hits: [],
            selectedAtDown: selected,
          };
          event.stopImmediatePropagation();
          return;
        }
      }
    }
    const hits = pickModels();
    gesture = {
      pointer: event.pointerId,
      button: event.button,
      startX: event.clientX,
      startY: event.clientY,
      hits,
      selectedAtDown: selected,
    };
    if (hits.length === 0) {
      // Empty ground: left-drag pans and right-drag orbits via OrbitControls;
      // a plain left click clears the selection on pointerup.
      return;
    }
    const id = resolveTarget(hits);
    if (!id) return;
    const obj = objects.get(id);
    const point = ray.ray.intersectPlane(ground, new THREE.Vector3());
    if (!obj || !point) return;
    controls.enabled = false;
    callbacks.select(id);
    renderer.domElement.setPointerCapture(event.pointerId);
    if (event.button === 2) {
      // Right-drag on a model: rotate only this model. The yaw follows the
      // cursor's orbit angle around the model's center on the ground plane.
      drag = {
        mode: "rotate",
        id,
        startAngle: Math.atan2(point.x - obj.position.x, point.z - obj.position.z),
        startYaw: obj.rotation.y,
        pointer: event.pointerId,
      };
    } else {
      callbacks.dragStart();
      drag = {
        mode: "move",
        id,
        offset: point.sub(obj.position),
        start: obj.position.clone(),
        pointer: event.pointerId,
      };
    }
    event.stopImmediatePropagation();
  }
  function move(event: PointerEvent) {
    cast(event);
    if (!drag) {
      // Hover affordance only; OrbitControls keeps receiving these events.
      if (fillArmed || event.pointerType === "touch") return;
      const overHandle =
        handles.visible && ray.intersectObjects(handleMeshes, false).length > 0;
      renderer.domElement.style.cursor = overHandle
        ? "pointer"
        : pickModels().length
          ? "grab"
          : "";
      return;
    }
    if (drag.pointer !== event.pointerId) return;
    const p = ray.ray.intersectPlane(ground, new THREE.Vector3());
    const obj = objects.get(drag.id);
    if (p && obj) {
      if (drag.mode === "rotate") {
        const angle = Math.atan2(p.x - obj.position.x, p.z - obj.position.z);
        let delta = angle - drag.startAngle;
        if (delta > Math.PI) delta -= Math.PI * 2;
        if (delta < -Math.PI) delta += Math.PI * 2;
        obj.rotation.y = drag.startYaw + delta;
      } else if (drag.mode === "move") {
        const desired = p.sub(drag.offset);
        desired.y = 0;
        tmpBox.setFromObject(obj);
        const half = tmpBox.getSize(tmpSize).multiplyScalar(0.5);
        const result = constrainPosition(drag.id, desired, half.x, half.z);
        obj.position.copy(result.position);
        showGuides(result.snaps, result.position.x, result.position.z);
        setYardActive(true);
      } else {
        const dist = p.distanceTo(obj.position);
        obj.scale.setScalar(clampScale(drag.startScale * (dist / drag.startDist)));
      }
      updateSelection();
    }
    event.stopImmediatePropagation();
  }
  function up(event: PointerEvent) {
    // Commit an actual drag; otherwise treat as a click and cycle selection
    // through every model stacked under the pointer.
    if (drag && drag.pointer === event.pointerId) {
      const obj = objects.get(drag.id);
      const cancelled = event.type === "pointercancel";
      if (obj) {
        if (cancelled) {
          if (drag.mode === "move") obj.position.copy(drag.start);
          else if (drag.mode === "rotate") obj.rotation.y = drag.startYaw;
          else obj.scale.setScalar(drag.startScale);
          updateSelection();
        } else if (drag.mode === "move") {
          callbacks.move(drag.id, obj.position.x, obj.position.z);
        } else if (drag.mode === "rotate") {
          // Stored shape rotation is the negated scene yaw.
          callbacks.rotate(drag.id, -obj.rotation.y);
        } else {
          callbacks.scale(drag.id, obj.scale.x);
        }
      }
      drag = null;
      controls.enabled = true;
      hideGuides();
      setYardActive(false);
      if (renderer.domElement.hasPointerCapture(event.pointerId))
        renderer.domElement.releasePointerCapture(event.pointerId);
      if (gesture?.pointer === event.pointerId) gesture = null;
      event.stopImmediatePropagation();
      return;
    }
    if (
      gesture &&
      gesture.pointer === event.pointerId &&
      gesture.button === 0 &&
      event.type !== "pointercancel"
    ) {
      const moved =
        Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) >
        CLICK_THRESHOLD;
      if (!moved) {
        const { hits, selectedAtDown } = gesture;
        if (hits.length === 0) {
          callbacks.select(null);
        } else if (hits.length === 1) {
          callbacks.select(hits[0]!);
        } else {
          const index = selectedAtDown ? hits.indexOf(selectedAtDown) : -1;
          callbacks.select(hits[(index + 1) % hits.length]!);
        }
      }
      gesture = null;
    }
  }
  const preventContextMenu = (event: Event) => event.preventDefault();
  renderer.domElement.addEventListener("pointerdown", down, true);
  renderer.domElement.addEventListener("pointermove", move, true);
  renderer.domElement.addEventListener("pointerup", up, true);
  renderer.domElement.addEventListener("pointercancel", up, true);
  renderer.domElement.addEventListener("contextmenu", preventContextMenu);
  renderer.domElement.addEventListener("dragenter", onDragEnter);
  renderer.domElement.addEventListener("dragover", onDragOver);
  renderer.domElement.addEventListener("dragleave", onDragLeave);
  renderer.domElement.addEventListener("drop", onDrop);
  const resize = () => {
    const w = host.clientWidth,
      h = host.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });
  return {
    sync,
    fit,
    beginFillMode,
    retry() {
      failed.clear();
      sync([...desired.values()], selected);
    },
    rotateAll(angle: number) {
      controls.rotateSpeed = 1;
      const offset = camera.position.clone().sub(controls.target);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      camera.position.copy(controls.target).add(offset);
      controls.update();
    },
    dispose() {
      alive = false;
      renderer.setAnimationLoop(null);
      observer.disconnect();
      controls.dispose();
      window.removeEventListener("keydown", onKeyDown);
      renderer.domElement.removeEventListener("pointerdown", down, true);
      renderer.domElement.removeEventListener("pointermove", move, true);
      renderer.domElement.removeEventListener("pointerup", up, true);
      renderer.domElement.removeEventListener("pointercancel", up, true);
      renderer.domElement.removeEventListener("contextmenu", preventContextMenu);
      renderer.domElement.removeEventListener("dragenter", onDragEnter);
      renderer.domElement.removeEventListener("dragover", onDragOver);
      renderer.domElement.removeEventListener("dragleave", onDragLeave);
      renderer.domElement.removeEventListener("drop", onDrop);
      loaded.forEach(disposeRoot);
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      selection.geometry.dispose();
      (selection.material as THREE.Material).dispose();
      handleGeometry.dispose();
      handleMaterial.dispose();
      yardGeometry.dispose();
      yardMaterial.dispose();
      guideGeometry.dispose();
      guideMaterial.dispose();
      dropMarker.geometry.dispose();
      dropMaterial.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
