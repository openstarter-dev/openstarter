import { m } from "@openstarter/i18n-web/messages";
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@openstarter/ui-web/components/dropdown-menu";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

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
