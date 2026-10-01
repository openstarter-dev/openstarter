import { Button } from "@openstarter/ui-web/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@openstarter/ui-web/components/dropdown-menu";
import { Globe } from "lucide-react";

import { getLocale, setLocale } from "@/paraglide/runtime.js";

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
] as const;

export function LanguageSwitcher() {
  const currentLocale = getLocale();

  const handleLanguageChange = (newLocale: string) => {
    if (newLocale !== currentLocale) {
      setLocale(newLocale as "en" | "zh");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="Switch language" size="icon" type="button" variant="ghost">
          <Globe aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGUAGE_OPTIONS.map((option) => (
          <DropdownMenuItem key={option.value} onClick={() => handleLanguageChange(option.value)}>
            <span className={currentLocale === option.value ? "font-medium" : ""}>
              {option.label}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
