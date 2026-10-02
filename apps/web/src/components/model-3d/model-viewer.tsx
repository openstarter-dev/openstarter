import { useEffect, useRef, useState } from "react";

/** Loads a GLB in an isolated Three.js scene. Orbit/pan/zoom and GPU cleanup. */
export function ModelViewer({ url }: { url: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let canceled = false;
    let dispose = () => {};
    setLoading(true);
    setError("");
    async function mount() {
      const [THREE, { GLTFLoader }, { OrbitControls }] = await Promise.all([
        import("three"),
        import("three/addons/loaders/GLTFLoader.js"),
        import("three/addons/controls/OrbitControls.js"),
      ]);
      if (canceled || !element) return;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#242826");
      const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      element.appendChild(renderer.domElement);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      const ambient = new THREE.HemisphereLight(0xffffff, 0x556655, 2.5);
      const sun = new THREE.DirectionalLight(0xffffff, 3);
      sun.position.set(4, 6, 3);
      scene.add(ambient, sun);
      const release = (root: import("three").Object3D) => {
        const textures = new Set<import("three").Texture>();
        root.traverse((node) => {
          const mesh = node as import("three").Mesh;
          if (!mesh.isMesh) return;
          mesh.geometry.dispose();
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const material of materials) {
            for (const value of Object.values(material)) {
              if (value instanceof THREE.Texture) textures.add(value);
            }
            material.dispose();
          }
        });
        for (const texture of textures) texture.dispose();
      };
      const observer = new ResizeObserver(() => {
        const { width, height } = element.getBoundingClientRect();
        camera.aspect = width / Math.max(height, 1);
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      });
      observer.observe(element);
      renderer.setAnimationLoop(() => {
        controls.update();
        renderer.render(scene, camera);
      });
      dispose = () => {
        observer.disconnect();
        renderer.setAnimationLoop(null);
        controls.dispose();
        release(scene);
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      };
      const model = await new GLTFLoader().loadAsync(url);
      if (canceled) {
        release(model.scene);
        return;
      }
      const bounds = new THREE.Box3().setFromObject(model.scene);
      if (bounds.isEmpty()) {
        release(model.scene);
        throw new Error("No visible geometry in this model.");
      }
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const extent = Math.max(size.x, size.y, size.z, 0.01);
      model.scene.position.sub(center);
      scene.add(model.scene);
      camera.near = extent / 1000;
      camera.far = extent * 100;
      camera.position.set(extent * 1.7, extent, extent * 1.7);
      camera.updateProjectionMatrix();
      controls.target.set(0, 0, 0);
      controls.update();
      setLoading(false);
    }
    void mount().catch(() => {
      dispose();
      if (!canceled) {
        setLoading(false);
        setError(
          "Could not load this GLB. Check the model file, network access and WebGL support.",
        );
      }
    });
    return () => {
      canceled = true;
      dispose();
    };
  }, [url]);
  return (
    <div className="model-viewer">
      <div ref={host} className="model-webgl" />
      {loading && <p role="status">Loading 3D model…</p>}
      {error && <p role="alert">{error}</p>}
      <span>Drag to orbit · right drag to pan · scroll to zoom</span>
    </div>
  );
}
