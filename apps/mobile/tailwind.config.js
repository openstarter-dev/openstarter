// 设计 token 镜像自 packages/ui/ui-web/src/styles/globals.css 的 :root / .dark 语义色。
// 那边是 oklch()，React Native 不支持该颜色空间，故此处存等价 hex。
// 唯一权威来源仍是 ui-web 的 globals.css —— 改那边时必须同步改这里（见 spec §9）。
const light = {
  accent: "#f5f5f5",
  "accent-foreground": "#171717",
  background: "#ffffff",
  border: "#e5e5e5",
  card: "#ffffff",
  "card-foreground": "#0a0a0a",
  destructive: "#df2225",
  foreground: "#0a0a0a",
  input: "#e5e5e5",
  muted: "#f5f5f5",
  "muted-foreground": "#737373",
  primary: "#171717",
  "primary-foreground": "#fafafa",
  ring: "#a1a1a1",
  secondary: "#f5f5f5",
  "secondary-foreground": "#171717",
};

const dark = {
  accent: "#404040",
  "accent-foreground": "#fafafa",
  background: "#0a0a0a",
  border: "rgba(255,255,255,0.10)",
  card: "#171717",
  "card-foreground": "#fafafa",
  destructive: "#ff6467",
  foreground: "#fafafa",
  input: "rgba(255,255,255,0.15)",
  muted: "#262626",
  "muted-foreground": "#a1a1a1",
  primary: "#d4d4d4",
  "primary-foreground": "#171717",
  ring: "#737373",
  secondary: "#262626",
  "secondary-foreground": "#fafafa",
};

module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ...light,
        dark,
      },
    },
  },
};
