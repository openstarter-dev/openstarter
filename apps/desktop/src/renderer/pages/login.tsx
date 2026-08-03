import { useState } from "react";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // 调用 packages/auth 的登录 API
    // 成功后跳转到 /
  };

  return (
    <form onSubmit={handleSubmit}>
      <h1 style={{ marginBottom: "24px", fontSize: "24px" }}>Sign In</h1>
      <div style={{ marginBottom: "16px" }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: "100%",
            padding: "10px",
            background: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: "4px",
            color: "#f5f5f5",
            outline: "none",
          }}
        />
      </div>
      <div style={{ marginBottom: "24px" }}>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%",
            padding: "10px",
            background: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: "4px",
            color: "#f5f5f5",
            outline: "none",
          }}
        />
      </div>
      <button
        type="submit"
        style={{
          width: "100%",
          padding: "10px",
          background: "#3b82f6",
          border: "none",
          borderRadius: "4px",
          color: "#fff",
          cursor: "pointer",
          fontSize: "14px",
        }}
      >
        Sign In
      </button>
    </form>
  );
}