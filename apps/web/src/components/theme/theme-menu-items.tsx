import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@openstarter/ui/components/dropdown-menu";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { tDynamic } from "@/lib/i18n";

// Theme values map to `common.nav.theme_{value}` message keys. This is a keyed
// list, so labels are resolved with tDynamic (R23.2) rather than one static
// `m[...]()` call per branch.
const THEME_OPTIONS = ["system", "light", "dark"] as const;

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
      {THEME_OPTIONS.map((value) => (
        <DropdownMenuRadioItem key={value} value={value}>
          {tDynamic(`common.nav.theme_${value}`)}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}
