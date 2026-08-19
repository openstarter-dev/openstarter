import { Text, TextInput, View } from "react-native";

export function Input(props: {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoComplete?: "email" | "password" | "name" | "off";
  errors?: string[];
}) {
  const errors = props.errors ?? [];

  return (
    <View className="gap-1.5">
      <Text className="font-medium text-foreground text-sm dark:text-dark-foreground">
        {props.label}
      </Text>
      <TextInput
        accessibilityLabel={props.label}
        autoCapitalize="none"
        autoComplete={props.autoComplete ?? "off"}
        className="min-h-[44px] rounded-xl border border-border px-3 text-base text-foreground dark:border-dark-border dark:text-dark-foreground"
        onBlur={props.onBlur}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        secureTextEntry={Boolean(props.secureTextEntry)}
        value={props.value}
      />
      {errors.map((message) => (
        <Text className="text-destructive text-xs dark:text-dark-destructive" key={message}>
          {message}
        </Text>
      ))}
    </View>
  );
}
