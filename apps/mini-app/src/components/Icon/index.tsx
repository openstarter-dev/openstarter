import { View, Text } from "@tarojs/components";
import "./index.scss";

interface IconProps {
  type: "success" | "error" | "info" | "arrow-right" | "user" | "lock" | "logout";
  size?: number;
  color?: string;
}

export default function Icon({ type, size = 40, color }: IconProps) {
  const iconMap: Record<string, string> = {
    success: "✓",
    error: "✕",
    info: "ℹ",
    "arrow-right": "›",
    user: "👤",
    lock: "🔒",
    logout: "↩",
  };

  return (
    <Text
      className="icon"
      style={{
        fontSize: `${size}px`,
        ...(color ? { color } : {}),
      }}
    >
      {iconMap[type] || "?"}
    </Text>
  );
}
