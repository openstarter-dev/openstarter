import { m } from "@openstarter/i18n-web/messages";
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@openstarter/ui-web/components/dropdown-menu";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

// Theme values map to `common.nav.theme_{value}` message keys. The key is only
// known at runtime, but the candidate set is small and fixed, so each label is
// resolved with a static `m["..."]()` lookup — a runtime-computed key into the
// whole message namespace (`m[dynamicKey]()`) would defeat Paraglide's
// tree-shaking and ship the entire catalog. Requirements: 23.2.
const THEME_OPTIONS = [
  { value: "system", label: () => m["common.nav.theme_system"]() },
  { value: "light", label: () => m["common.nav.theme_light"]() },
  { value: "dark", label: () => m["common.nav.theme_dark"]() },
] as const;

export function ThemeMenuItems() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <DropdownMenuRadioGroup
      onValueChange={(value) => setTheme(String(value))}
      value={mounted ? theme : undefined}
    >
      {THEME_OPTIONS.map((option) => (
        <DropdownMenuRadioItem key={option.value} value={option.value}>
          {option.label()}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}
