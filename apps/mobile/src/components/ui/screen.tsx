import type { ReactNode } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

export function Screen(props: { children: ReactNode; className?: string }) {
  return (
    <SafeAreaView
      className={`flex-1 bg-background dark:bg-dark-background ${props.className ?? ""}`}
    >
      {props.children}
    </SafeAreaView>
  );
}
