"use client";

import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useTheme } from "next-themes";
import { useLocale, useT } from "@/lib/i18n";
import { Loader2, Moon, Save, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { SiteLogo } from "@/components/brand/site-logo";
import type { SettingsMap } from "@/lib/settings";

export function SettingsForm({ initial }: { initial: SettingsMap }) {
  const t = useT("settings");
  const tCommon = useT("common");
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const locale = useLocale();
  const { toast } = useToast();

  const [values, setValues] = useState<SettingsMap>({ ...initial });
  const [saving, setSaving] = useState(false);

  const set = (key: keyof SettingsMap) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? t("saveFailed"));
      }
      toast({ title: t("saved") });
      router.invalidate();
    } catch (err) {
      toast({
        title: t("saveFailed"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function switchLocale(next: "id" | "en") {
    await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next }),
    });
    router.invalidate();
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <Button
          onClick={save}
          disabled={saving}
          className="gap-1.5 bg-brand-gradient font-semibold text-slate-950 hover:opacity-90"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="h-4 w-4" aria-hidden="true" />
          )}
          {tCommon("save")}
        </Button>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap">
          <TabsTrigger value="general">{t("tabGeneral")}</TabsTrigger>
          <TabsTrigger value="about">{t("tabAbout")}</TabsTrigger>
          <TabsTrigger value="appearance">{t("tabAppearance")}</TabsTrigger>
          <TabsTrigger value="language">{t("tabLanguage")}</TabsTrigger>
        </TabsList>

        {/* ===== Umum ===== */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-base">
                <SiteLogo logoUrl={values.siteLogo} size={28} className="text-foreground" />
                {values.siteName || "AIVISO"}
              </CardTitle>
              <CardDescription>{t("note")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="siteName">{t("siteName")}</Label>
                <Input id="siteName" value={values.siteName} onChange={set("siteName")} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="siteLogo">{t("siteLogo")}</Label>
                <Input
                  id="siteLogo"
                  placeholder="https://…/logo.svg"
                  value={values.siteLogo}
                  onChange={set("siteLogo")}
                />
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="contactEmail">{t("contactEmail")}</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    placeholder="hello@example.com"
                    value={values.contactEmail}
                    onChange={set("contactEmail")}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="contactPhone">{t("contactPhone")}</Label>
                  <Input
                    id="contactPhone"
                    placeholder="+62 …"
                    value={values.contactPhone}
                    onChange={set("contactPhone")}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="contactAddress">{t("contactAddress")}</Label>
                <Input
                  id="contactAddress"
                  placeholder="Jl. …"
                  value={values.contactAddress}
                  onChange={set("contactAddress")}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== Tentang ===== */}
        <TabsContent value="about">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("tabAbout")}</CardTitle>
              <CardDescription>/about</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="aboutTitle">{t("aboutTitle")}</Label>
                <Input
                  id="aboutTitle"
                  value={values.aboutTitle}
                  onChange={set("aboutTitle")}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="aboutBody">{t("aboutBody")}</Label>
                <Textarea
                  id="aboutBody"
                  rows={10}
                  value={values.aboutBody}
                  onChange={set("aboutBody")}
                  className="font-mono text-xs"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== Tampilan ===== */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("appearance")}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {(
                [
                  { value: "light", label: t("light"), icon: Sun },
                  { value: "dark", label: t("dark"), icon: Moon },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  aria-pressed={theme === value}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-5 transition-colors ${
                    theme === value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <Icon className="h-6 w-6" aria-hidden="true" />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== Bahasa ===== */}
        <TabsContent value="language">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("language")}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {(
                [
                  { value: "id", label: t("id") },
                  { value: "en", label: t("en") },
                ] as const
              ).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => switchLocale(value)}
                  aria-pressed={locale === value}
                  className={`rounded-xl border p-5 text-sm font-semibold uppercase transition-colors ${
                    locale === value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
