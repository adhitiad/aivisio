import { createServerFn } from '@tanstack/react-start'
import { getCookie, setCookie } from '@tanstack/react-start/server'
import { getSettings } from './settings'
import { oauthConfigured } from './auth'
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  type Locale,
} from './i18n'

export const getSettingsFn = createServerFn({ method: 'GET' }).handler(async () => {
  return getSettings()
})

export const getOAuthConfigFn = createServerFn({ method: 'GET' }).handler(
  async () => oauthConfigured,
)

export const getLocaleFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Locale> => {
    const raw = getCookie(LOCALE_COOKIE)
    return isLocale(raw) ? raw : DEFAULT_LOCALE
  },
)

export const setLocaleFn = createServerFn({ method: 'POST' })
  .validator((value: string) => value)
  .handler(async ({ data }) => {
    if (!isLocale(data)) throw new Error('Locale tidak didukung.')
    setCookie(LOCALE_COOKIE, data, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
    return { ok: true, locale: data }
  })
