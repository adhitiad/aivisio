"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const t = useT("nav");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  const isDark = theme !== "light";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t("toggleTheme")}
      title={t("toggleTheme")}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {mounted ? (
        isDark ? (
          <Sun className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Moon className="h-4 w-4" aria-hidden="true" />
        )
      ) : (
        <Sun className="h-4 w-4 opacity-0" aria-hidden="true" />
      )}
    </Button>
  );
}
