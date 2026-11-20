import { cache } from "react";
import { db } from "@/lib/db";

export const SETTING_KEYS = [
  "siteName",
  "siteLogo",
  "contactEmail",
  "contactPhone",
  "contactAddress",
  "aboutTitle",
  "aboutBody",
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];
export type SettingsMap = Record<SettingKey, string>;

export const DEFAULT_SETTINGS: SettingsMap = {
  siteName: "AIVISO",
  siteLogo: "",
  contactEmail: "",
  contactPhone: "",
  contactAddress: "",
  aboutTitle: "",
  aboutBody: "",
};

/** Ambil seluruh pengaturan publik (di-cache per request). */
export const getSettings = cache(async (): Promise<SettingsMap> => {
  try {
    const rows = await db.setting.findMany({
      where: { key: { in: [...SETTING_KEYS] } },
    });
    const map = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      if ((SETTING_KEYS as readonly string[]).includes(row.key)) {
        map[row.key as SettingKey] = row.value;
      }
    }
    return map;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
});

export async function getSetting(key: SettingKey): Promise<string> {
  return (await getSettings())[key];
}
