import { ActivityIndicator, Pressable, Text } from "react-native";

type ButtonVariant = "primary" | "outline" | "ghost";

const CONTAINER_CLASS: Record<ButtonVariant, string> = {
  ghost: "",
  outline: "border border-border dark:border-dark-border",
  primary: "bg-primary dark:bg-dark-primary",
};

const LABEL_CLASS: Record<ButtonVariant, string> = {
  ghost: "text-foreground dark:text-dark-foreground",
  outline: "text-foreground dark:text-dark-foreground",
  primary: "text-primary-foreground dark:text-dark-primary-foreground",
};

export function Button(props: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
}) {
  const variant = props.variant ?? "primary";
  const isBlocked = Boolean(props.disabled) || Boolean(props.loading);

  return (
    <Pressable
      accessibilityLabel={props.accessibilityLabel ?? props.label}
      accessibilityRole="button"
      accessibilityState={{ busy: Boolean(props.loading), disabled: isBlocked }}
      className={`min-h-[44px] items-center justify-center rounded-xl px-4 ${CONTAINER_CLASS[variant]} ${isBlocked ? "opacity-50" : ""}`}
      disabled={isBlocked}
      onPress={props.onPress}
    >
      {props.loading ? (
        <ActivityIndicator />
      ) : (
        <Text className={`font-medium text-base ${LABEL_CLASS[variant]}`}>
          {props.label}
        </Text>
      )}
    </Pressable>
  );
}
