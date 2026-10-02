export function ModelViewer({ url: _url }: { url: string }) {
  return (
    <div className="model-placeholder" role="status">
      <h3>3D preview is not ready</h3>
      <p>The Three.js dependency is missing. The 2D canvas remains available.</p>
    </div>
  );
}
