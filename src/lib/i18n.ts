import i18next from 'i18next'
import { initReactI18next, useTranslation } from 'react-i18next'
import idMessages from '../../messages/id.json'
import enMessages from '../../messages/en.json'

export const LOCALES = ['id', 'en'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'id'
export const LOCALE_COOKIE = 'NEXT_LOCALE'

const resources = {
  id: { translation: idMessages },
  en: { translation: enMessages },
} as const

export function isLocale(value: string | undefined | null): value is Locale {
  return value === 'id' || value === 'en'
}

/** Instance i18next baru per request — aman untuk SSR (tanpa state global bersama). */
export function createI18n(locale: Locale) {
  const instance = i18next.createInstance()
  instance.use(initReactI18next)
  void instance.init({
    lng: locale,
    fallbackLng: DEFAULT_LOCALE,
    resources,
    initImmediate: false,
    nsSeparator: false,
    keySeparator: '.',
    interpolation: { prefix: '{', suffix: '}', escapeValue: false },
    returnNull: false,
  } as never)
  return instance
}

type Translate = ((key: string, values?: Record<string, unknown>) => string) & {
  raw: (key: string) => any
}

function makeT(
  translate: (key: string, options?: Record<string, unknown>) => unknown,
  namespace?: string,
): Translate {
  const full = (key: string) => (namespace ? `${namespace}.${key}` : key)
  const t = ((key: string, values?: Record<string, unknown>) =>
    String(translate(full(key), values) ?? '')) as Translate
  t.raw = (key: string) => translate(full(key), { returnObjects: true })
  return t
}

/** Hook t: useT(namespace?) => t(key, values) + t.raw(key). */
export function useT(namespace?: string): Translate {
  const { t } = useTranslation()
  return makeT(
    t as unknown as (key: string, options?: Record<string, unknown>) => unknown,
    namespace,
  )
}

/** Versi server untuk loader/route handler. */
export function getT(locale: Locale, namespace?: string): Translate {
  const instance = createI18n(locale)
  return makeT(instance.t.bind(instance) as never, namespace)
}

export function useLocale(): Locale {
  const { i18n } = useTranslation()
  const value = i18n.language?.split('-')[0]
  return isLocale(value) ? value : DEFAULT_LOCALE
}
