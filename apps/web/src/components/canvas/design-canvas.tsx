import { SceneWorkspace } from "./scene-workspace";
import { useState } from "react";
import { Tldraw, type Editor, type TLAssetStore, type TLComponents } from "tldraw";
import { useSync } from "@tldraw/sync";
import { CanvasToolbar, CanvasHeader } from "./ui";
import "tldraw/tldraw.css";

// Assets stay on the user's device in local mode. Shared rooms synchronize the
// data URL through our own server; no third-party demo asset service is used.
export const inlineAssets: TLAssetStore = {
  async upload(_asset, file) {
    if (file.size > 10 * 1024 * 1024) throw new Error("Choose an image smaller than 10 MB.");
    const src = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Unable to read image."));
      reader.readAsDataURL(file);
    });
    return { src };
  },
  resolve: (asset) => asset.props.src,
};
const components: TLComponents = {
  Toolbar: CanvasToolbar,
};

const licenseKey = import.meta.env.VITE_TLDRAW_LICENSE_KEY;
function setup(editor: Editor) {
  editor.user.updateUserPreferences({ colorScheme: "dark" });
  editor.updateInstanceState({ isGridMode: true });
}
export function DesignCanvas({ room }: { room?: string }) {
  return (
    <div className="design-canvas">{room ? <SharedCanvas room={room} /> : <LocalCanvas />}</div>
  );
}
function LocalCanvas() {
  const [editor, setEditor] = useState<Editor | null>(null);
  return (
    <>
      <Tldraw
        persistenceKey="greenplan-infinite-canvas-v1"
        licenseKey={licenseKey}
        components={components}

        assets={inlineAssets}
        onMount={(e) => {
          setup(e);
          setEditor(e);
        }}
      />
      {editor && (
        <>
          <SceneWorkspace editor={editor} />
          <CanvasHeader editor={editor} />
        </>
      )}
    </>
  );
}
function SharedCanvas({ room }: { room: string }) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const store = useSync({
    uri: `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/canvas-sync/${room}`,
    assets: inlineAssets,
  });
  if (store.status === "error")
    return (
      <div className="canvas-loading" role="alert">
        <strong>Cannot connect to this room</strong>
        <p>
          The collaboration service is unavailable. Your local board is separate and remains on this
          device.
        </p>
        <a href="/design">Back to local board</a>
        <button onClick={() => window.location.reload()}>Reconnect</button>
      </div>
    );
  return (
    <>
      <Tldraw
        store={store}
        licenseKey={licenseKey}
        components={components}

        onMount={(e) => {
          setup(e);
          setEditor(e);
        }}
      />
      {editor && (
        <CanvasHeader
          editor={editor}
          room={room}
          connection={store.status === "synced-remote" ? store.connectionStatus : "connecting"}
        />
      )}
    </>
  );
}
