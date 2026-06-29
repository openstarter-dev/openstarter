import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@openstarter/ui/components/dropdown-menu";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeMenuItems() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <DropdownMenuRadioGroup
      value={mounted ? theme : undefined}
      onValueChange={(value) => setTheme(String(value))}
    >
      <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  );
}
