/// <reference types="vite/client" />

// 声明插件端运行时使用的自定义环境变量。
// WXT 生成的 .wxt/types/globals.d.ts 只静态声明了 WXT 自身的固定键
// （MANIFEST_VERSION / BROWSER / COMMAND 等），不包含 VITE_ 前缀的自定义变量，
// 见 https://wxt.dev/guide/essentials/config/environment-variables。
// vite/client 提供通用 ImportMetaEnv 索引签名，此处再精确补上 VITE_APP_URL
// 以获得严格类型（与 docs/superpowers/specs/2026-08-01-browser-extension-app-design.md §5 对齐）。
interface ImportMetaEnv {
  readonly VITE_APP_URL: string;
}
