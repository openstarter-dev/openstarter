// 事务性邮件模板的内联样式集合。
// 邮件客户端普遍不支持外部样式表/类名，React Email 约定使用内联 style 对象。
// 由 layout 与各模板共享，保证 7 个模板视觉一致。

import type { CSSProperties } from "react";

export const styles: Record<string, CSSProperties> = {
  body: {
    margin: 0,
    padding: 0,
    backgroundColor: "#f6f9fc",
    fontFamily:
      '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,Helvetica,Arial,sans-serif',
    color: "#0f172a",
  },
  container: {
    maxWidth: 560,
    margin: "0 auto",
    padding: "32px 16px 40px",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: "28px 24px",
    border: "1px solid rgba(15, 23, 42, 0.08)",
    boxShadow: "0 20px 50px rgba(2, 6, 23, 0.10), 0 2px 8px rgba(2, 6, 23, 0.05)",
  },
  accentBar: {
    height: 6,
    borderRadius: 999,
    marginBottom: 18,
    background:
      "linear-gradient(90deg, rgba(99,102,241,1) 0%, rgba(236,72,153,1) 55%, rgba(14,165,233,1) 100%)",
  },
  brand: {
    margin: "0 0 16px",
    fontSize: 14,
    lineHeight: "18px",
    fontWeight: 600,
    color: "#0f172a",
    letterSpacing: "-0.01em",
  },
  heading: {
    margin: "0 0 10px",
    fontSize: 24,
    lineHeight: "30px",
    fontWeight: 700,
    letterSpacing: "-0.01em",
  },
  paragraph: {
    margin: "0 0 18px",
    fontSize: 14,
    lineHeight: "22px",
    color: "#334155",
  },
  buttonWrap: {
    textAlign: "center",
    margin: "18px 0 14px",
  },
  button: {
    backgroundColor: "#111827",
    borderRadius: 12,
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 600,
    textDecoration: "none",
    padding: "12px 18px",
    display: "inline-block",
  },
  codeWrap: {
    textAlign: "center",
    margin: "18px 0 14px",
  },
  code: {
    display: "inline-block",
    backgroundColor: "#0f172a",
    borderRadius: 12,
    color: "#ffffff",
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: "0.35em",
    padding: "14px 24px",
    fontFamily: 'ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace',
  },
  muted: {
    margin: "0 0 10px",
    fontSize: 12,
    lineHeight: "18px",
    color: "#64748b",
    textAlign: "center",
  },
  divider: {
    borderColor: "rgba(15, 23, 42, 0.08)",
    margin: "18px 0",
  },
  small: {
    margin: "0 0 6px",
    fontSize: 12,
    lineHeight: "18px",
    color: "#64748b",
  },
  link: {
    fontSize: 12,
    lineHeight: "18px",
    color: "#2563eb",
    wordBreak: "break-all",
  },
  footer: {
    margin: "18px 0 0",
    fontSize: 12,
    lineHeight: "18px",
    color: "#94a3b8",
  },
};
