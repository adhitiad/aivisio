import { useCallback, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight, Rocket, Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  AivisoWordmark,
  InfinityLogo,
} from "@/components/aiviso/infinity-logo";
import { AiProvidersDialog } from "@/components/aiviso/ai-providers-dialog";
import { Studio } from "@/components/aiviso/studio";
import { VideoStudio } from "@/components/aiviso/video-studio";
import { PromptLibrary } from "@/components/aiviso/prompt-library";
import { TOOLS } from "@/lib/tools";

interface HeroStat {
  value: string;
  label: string;
}

export const Route = createFileRoute("/")({
  component: Home,
})

function Home() {
  const t = useT();
  const [activeToolId, setActiveToolId] = useState<string | null>(null);

  const openTool = useCallback((toolId: string) => {
    setActiveToolId(toolId);
    requestAnimationFrame(() => {
      document.getElementById("studio")?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  const scrollToStudio = useCallback(() => {
    document.getElementById("studio")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const heroStats = t.raw("hero.stats") as HeroStat[];

  return (
    <main className="flex-1">
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-grid opacity-60" />
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[480px] w-[720px] rounded-full bg-cyan-500/10 blur-[140px]" />
        <div className="absolute top-1/3 -left-40 h-[420px] w-[420px] rounded-full bg-violet-600/10 blur-[130px]" />
        <div className="absolute bottom-0 -right-40 h-[420px] w-[420px] rounded-full bg-fuchsia-600/10 blur-[130px]" />
      </div>

      <section className="relative mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 pt-14 pb-14 text-center sm:px-6 sm:pt-20 sm:pb-20">
        <div className="flex items-center gap-2 self-end -mt-6">
          <AiProvidersDialog />
        </div>
        <div className="relative">
          <span
            className="absolute inset-0 -z-10 scale-150 rounded-full bg-fuchsia-500/10 blur-3xl"
            aria-hidden="true"
          />
          <InfinityLogo width={260} className="max-w-full" />
        </div>
        <div className="space-y-3">
          <AivisoWordmark size="lg" />
          <p className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground">
            {t("hero.badge")}
          </p>
        </div>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          {t("hero.titleA")}{" "}
          <span className="text-brand-gradient">{t("hero.titleHighlight")}</span>{" "}
          {t("hero.titleB")}
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          {t("hero.subtitle")}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button
            size="lg"
            onClick={scrollToStudio}
            className="h-11 bg-brand-gradient px-6 font-semibold text-slate-950 shadow-[0_0_40px_-10px_rgba(99,102,241,0.7)] hover:opacity-90 hover:text-slate-950"
          >
            <Rocket className="h-4 w-4" aria-hidden="true" />
            {t("hero.ctaPrimary")}
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => {
              document
                .getElementById("prompt")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
            className="h-11 px-6"
          >
            <Sparkles
              className="h-4 w-4 text-yellow-500 dark:text-yellow-300"
              aria-hidden="true"
            />
            {t("hero.ctaSecondary")}
          </Button>
        </div>
        <div className="grid w-full max-w-3xl grid-cols-2 gap-3 pt-6 sm:grid-cols-4">
          {heroStats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center gap-0.5 rounded-xl border border-border bg-card/60 px-4 py-3"
            >
              <span className="text-2xl font-bold text-brand-gradient">
                {stat.value}
              </span>
              <span className="text-center text-xs leading-snug text-muted-foreground">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section
        aria-label={t("hero.workflowLabel")}
        className="mx-auto max-w-6xl px-4 pb-16 sm:px-6"
      >
        <div className="rounded-2xl border border-border bg-card/50 p-4 sm:p-6">
          <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t("hero.workflowLabel")}
          </p>
          <ol className="flex flex-col items-stretch gap-2 md:flex-row md:gap-1">
            {TOOLS.map((tool, idx) => (
              <li
                key={tool.id}
                className="flex flex-1 flex-col items-stretch md:flex-row"
              >
                <button
                  onClick={() => openTool(tool.id)}
                  className="group flex-1 rounded-xl px-3 py-3 text-left transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br ${tool.accent} text-[11px] font-bold text-slate-950`}
                    >
                      {tool.step}
                    </span>
                    <span className="text-sm font-medium transition-colors group-hover:text-primary">
                      {tool.name}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs leading-snug text-muted-foreground">
                    {tool.tagline.split(":")[0].split(",")[0]}
                  </span>
                </button>
                {idx < TOOLS.length - 1 && (
                  <span
                    className="hidden items-center justify-center px-1 text-muted-foreground/50 md:flex"
                    aria-hidden="true"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="relative mx-auto max-w-6xl space-y-20 px-4 pb-20 sm:px-6">
        <Studio
          activeToolId={activeToolId}
          setActiveToolId={setActiveToolId}
        />
        <VideoStudio />
        <PromptLibrary onUseTool={openTool} />
      </div>
    </main>
  )
}
