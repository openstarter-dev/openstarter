import { View, Text } from "@tarojs/components";
import "./index.scss";

type ButtonVariant = "primary" | "secondary" | "text";

interface ButtonProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  onClick?: () => void;
  type?: "submit" | "button";
}

function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export default function Button({
  children,
  variant = "primary",
  loading = false,
  disabled = false,
  fullWidth = false,
  onClick,
  type = "button",
}: ButtonProps) {
  const handleClick = () => {
    if (!loading && !disabled && onClick) {
      onClick();
    }
  };

  return (
    <View
      className={cn(
        "btn",
        `btn--${variant}`,
        loading && "btn--loading",
        disabled && "btn--disabled",
        fullWidth && "btn--full-width",
      )}
      onClick={handleClick}
    >
      {loading && <View className="btn__spinner" />}
      <Text className="btn__text">{children}</Text>
    </View>
  );
}
