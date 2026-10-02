import { CHAIR_MODEL_URL, PLANT_MODEL_URL, VILLA_MODEL_URL } from "./model-shape";
import { addModel, MODEL_SHAPE_SIZE } from "./scene-store";
import { useState } from "react";
import { Leaf, Search, X } from "lucide-react";
import { AssetRecordType, createShapeId, type Editor } from "tldraw";

// Original lightweight SVG planning symbols, not cropped UI screenshots.
const svg = (body: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">${body}</svg>`)}`;
const foliage = (color: string, flowers = false) =>
  `<ellipse cx="80" cy="140" rx="50" ry="9" fill="#183421" opacity=".12"/>${Array.from(
    { length: 12 },
    (_, i) => {
      const a = (i * Math.PI) / 6;
      return `<ellipse cx="${80 + Math.cos(a) * 30}" cy="${78 + Math.sin(a) * 34}" rx="24" ry="32" transform="rotate(${i * 30} ${80 + Math.cos(a) * 30} ${78 + Math.sin(a) * 34})" fill="${i % 2 ? color : "#5b8942"}" stroke="#345f32" stroke-width="1.5"/>`;
    },
  ).join(
    "",
  )}${flowers ? Array.from({ length: 14 }, (_, i) => `<circle cx="${48 + ((i * 23) % 67)}" cy="${41 + ((i * 31) % 72)}" r="8" fill="${i % 2 ? "#a997cf" : "#d2bde8"}"/>`).join("") : ""}`;
const assets = [
  { name: "Boxwood shrub", category: "Plants", src: svg(foliage("#427236")) },
  { name: "Hydrangea", category: "Flowers", src: svg(foliage("#44753e", true)) },
  {
    name: "Small tree",
    category: "Trees",
    src: svg('<path d="M78 92h8v48h-8z" fill="#826348"/>' + foliage("#7c9d4f")),
  },
  {
    name: "Round planter",
    category: "Planters",
    src: svg(
      '<path d="M43 76h74l-12 66H55z" fill="#b48460"/><ellipse cx="80" cy="77" rx="40" ry="13" fill="#6d513b"/><path d="M80 89C17 62 35 15 80 64C101 5 138 34 85 83Z" fill="#547d3c"/>',
    ),
  },
  {
    name: "Outdoor chair",
    category: "Furniture",
    src: svg(
      '<rect x="39" y="25" width="82" height="24" rx="8" fill="#ac9a7f"/><rect x="43" y="49" width="74" height="61" rx="7" fill="#e9dfcc" stroke="#9e8a70" stroke-width="5"/><path d="M34 45v80M126 45v80M44 109v29M116 109v29" stroke="#86694b" stroke-width="7"/>',
    ),
  },
  {
    name: "Garden sofa",
    category: "Furniture",
    src: svg(
      '<rect x="13" y="39" width="134" height="76" rx="12" fill="#aa967c"/><rect x="24" y="56" width="54" height="50" rx="8" fill="#e6ddcf"/><rect x="82" y="56" width="54" height="50" rx="8" fill="#e6ddcf"/><path d="M24 115v13M137 115v13" stroke="#6d5842" stroke-width="6"/>',
    ),
  },
  {
    name: "Dining table",
    category: "Furniture",
    src: svg(
      '<rect x="23" y="35" width="114" height="84" rx="4" fill="#ad8354" stroke="#795b3d" stroke-width="4"/><path d="M30 56h100M30 77h100M30 98h100" stroke="#cba879" stroke-width="3"/>',
    ),
  },
  {
    name: "Raised bed",
    category: "Landscape",
    src: svg(
      '<path d="M20 51l89-23 33 27-91 30Z" fill="#574f30"/><path d="M20 51v45l31 33V85M51 85l91-30v45l-91 29" fill="#b18c5f" stroke="#7b603d" stroke-width="3"/><path d="M44 58l7-20 9 16M76 51l8-21 8 17M105 48l10-15 7 12" fill="#71a145"/>',
    ),
  },
  {
    name: "Fire pit",
    category: "Landscape",
    src: svg(
      '<ellipse cx="80" cy="105" rx="55" ry="23" fill="#444846"/><ellipse cx="80" cy="91" rx="55" ry="25" fill="#646660"/><ellipse cx="80" cy="89" rx="40" ry="15" fill="#252b27"/><path d="M66 98C36 75 90 54 76 29C124 64 116 95 87 101Z" fill="#e79e44"/><path d="M76 96C68 82 85 75 85 62C104 85 91 100 76 96" fill="#f8d780"/>',
    ),
  },
];
/** Drag payload mime for dragging a 3D material straight into the scene. */
export const MODEL_DRAG_MIME = "application/x-scene-model";

export type ModelCatalogEntry = {
  url: string;
  name: string;
  category: string;
  src: string;
  /** Shape size in page units when different from the default. */
  size?: number;
  /** Containers (e.g. the courtyard villa) define the yard bounds. */
  container?: boolean;
};

/** GLB-backed materials. `container` models act as the yard boundary. */
export const MODEL_CATALOG: ModelCatalogEntry[] = [
  {
    url: CHAIR_MODEL_URL,
    name: "户外花园椅",
    category: "Furniture",
    src: svg(
      '<rect x="42" y="22" width="76" height="74" rx="20" fill="#c6d9c0" stroke="#6f8c69" stroke-width="4"/><path d="M52 40v38M70 40v38M90 40v38M108 40v38M40 92l-8 49M120 92l8 49" stroke="#6f8c69" stroke-width="7"/><rect x="32" y="87" width="96" height="19" rx="8" fill="#c6d9c0" stroke="#6f8c69" stroke-width="4"/>',
    ),
  },
  {
    url: PLANT_MODEL_URL,
    name: "绿萝盆栽",
    category: "Plants",
    src: assets.find((asset) => asset.category === "Planters")!.src,
  },
  {
    url: VILLA_MODEL_URL,
    name: "庭院双拼别墅",
    category: "Buildings",
    src: svg(
      '<ellipse cx="80" cy="138" rx="64" ry="9" fill="#183421" opacity=".12"/>' +
        '<rect x="24" y="72" width="56" height="60" fill="#efe7d6"/><rect x="80" y="72" width="56" height="60" fill="#e5dac3"/>' +
        '<path d="M18 74 49 40l31 34z" fill="#b5654a"/><path d="M80 74l31-34 31 34z" fill="#a6553f"/>' +
        '<rect x="44" y="100" width="15" height="32" rx="2" fill="#6d5140"/><rect x="101" y="100" width="15" height="32" rx="2" fill="#6d5140"/>' +
        '<rect x="29" y="84" width="13" height="12" rx="2" fill="#8aa3a8"/><rect x="118" y="84" width="13" height="12" rx="2" fill="#8aa3a8"/>',
    ),
    size: MODEL_SHAPE_SIZE * 2,
    container: true,
  },
];

type LibraryAsset = {
  name: string;
  category: string;
  src: string;
  size?: number;
  modelUrl?: string;
  container?: boolean;
};

// 2D planning symbols plus the GLB-backed entries that drop into the 3D scene.
const libraryAssets: LibraryAsset[] = [
  ...assets,
  ...MODEL_CATALOG.map(({ url, ...rest }) => ({ ...rest, modelUrl: url })),
];

/** Register the tldraw image asset used as the 2D/thumbnail backing of a GLB. */
export function createModelAsset(
  editor: Editor,
  entry: Pick<ModelCatalogEntry, "name" | "src">,
) {
  const assetId = AssetRecordType.createId();
  editor.createAssets([
    {
      id: assetId,
      type: "image",
      typeName: "asset",
      props: {
        name: entry.name,
        src: entry.src,
        w: 160,
        h: 160,
        mimeType: "image/svg+xml",
        isAnimated: false,
      },
      meta: {},
    },
  ]);
  return assetId;
}

export function AssetLibrary({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const add = (asset: LibraryAsset) => {
    if (asset.modelUrl) {
      const assetId = createModelAsset(editor, asset);
      addModel(editor, asset.modelUrl, assetId, asset.size, asset.container);
      return;
    }
    const assetId = AssetRecordType.createId();
    editor.createAssets([
      {
        id: assetId,
        type: "image",
        typeName: "asset",
        props: {
          name: asset.name,
          src: asset.src,
          w: 160,
          h: 160,
          mimeType: "image/svg+xml",
          isAnimated: false,
        },
        meta: {},
      },
    ]);
    const shapeId = createShapeId();
    const center = editor.getViewportPageBounds().center;
    editor.markHistoryStoppingPoint("Add landscape element");
    editor.createShape({
      id: shapeId,
      type: "image",
      x: center.x - 80,
      y: center.y - 80,
      props: { assetId, w: 160, h: 160 },
      meta: {},
    });
    editor.setCurrentTool("select");
    editor.select(shapeId);
  };
  if (!open)
    return (
      <button className="board-elements-toggle" onClick={() => setOpen(true)}>
        <Leaf size={17} />
        Elements
      </button>
    );
  return (
    <aside className="board-elements" aria-label="Landscape elements">
      <header>
        <strong>
          <Leaf size={16} />
          Elements
        </strong>
        <button onClick={() => setOpen(false)} aria-label="Close elements">
          <X size={17} />
        </button>
      </header>

      <label className="board-element-search">
        <Search size={14} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search elements…"
          aria-label="Search elements"
        />
      </label>
      <div className="board-element-tabs">
        {[
          "All",
          "Plants",
          "Trees",
          "Flowers",
          "Planters",
          "Furniture",
          "Buildings",
          "Landscape",
        ].map((c) => (
          <button className={c === category ? "active" : ""} key={c} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>
      <div className="board-element-grid">
        {libraryAssets
          .filter(
            (a) =>
              (category === "All" || a.category === category) &&
              a.name.toLowerCase().includes(query.toLowerCase()),
          )
          .map((a) => (
            <button
              key={a.name}
              onClick={() => add(a)}
              draggable={Boolean(a.modelUrl)}
              onDragStart={(event) => {
                if (!a.modelUrl) return;
                event.dataTransfer.setData(MODEL_DRAG_MIME, a.modelUrl);
                event.dataTransfer.effectAllowed = "copy";
              }}
              title={a.modelUrl ? "拖进 3D 院子直接放置，或单击添加" : undefined}
            >
              <span className="board-element-thumb">
                <img src={a.src} alt="" />
                {a.modelUrl && <em className="board-element-3d">3D</em>}
              </span>
              <span>{a.name}</span>
            </button>
          ))}
      </div>
      <p>带 3D 角标的素材可直接拖进院子放置 · 物体会自动吸附在院墙范围内 · 也可单击添加</p>
    </aside>
  );
}
