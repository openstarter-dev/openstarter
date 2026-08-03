import { useEffect, useState } from "react";

export function AboutPage() {
  const [version, setVersion] = useState("");

  useEffect(() => {
    window.electronAPI?.getVersion().then(setVersion);
  }, []);

  return (
    <div>
      <h1 style={{ marginBottom: "16px" }}>About</h1>
      <p style={{ color: "#a3a3a3", marginBottom: "8px" }}>
        OpenStarter Desktop
      </p>
      <p style={{ color: "#a3a3a3" }}>
        Version: {version || "loading..."}
      </p>
    </div>
  );
}