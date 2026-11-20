import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { uuidv7 } from 'uuidv7'
import { db } from './db'
import { moduleLogger } from './logger'

const log = moduleLogger('auth')

const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET
const facebookClientId = process.env.FACEBOOK_CLIENT_ID
const facebookClientSecret = process.env.FACEBOOK_CLIENT_SECRET

export const oauthConfigured = {
  google: Boolean(googleClientId && googleClientSecret),
  facebook: Boolean(facebookClientId && facebookClientSecret),
}

export const auth = betterAuth({
  appName: 'AIVISO',
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.SITE_URL ?? 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    ...new Set(
      [process.env.SITE_URL, process.env.BETTER_AUTH_URL, 'http://localhost:3000']
        .filter(Boolean)
        .map((v) => String(v).replace(/\/$/, '')),
    ),
  ],
  database: prismaAdapter(db, { provider: 'postgresql' }),
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
    database: {
      generateId: () => uuidv7(),
    },
    ipAddress: {
      ipAddressHeaders: ['x-forwarded-for', 'x-real-ip'],
    },
  },
  account: {
    encryptOAuthTokens: true,
    storeStateStrategy: 'cookie',
  },
  socialProviders: {
    ...(oauthConfigured.google
      ? {
          google: {
            clientId: googleClientId!,
            clientSecret: googleClientSecret!,
          },
        }
      : {}),
    ...(oauthConfigured.facebook
      ? {
          facebook: {
            clientId: facebookClientId!,
            clientSecret: facebookClientSecret!,
          },
        }
      : {}),
  },
  session: {
    expiresIn: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
    cookieCache: { enabled: true, maxAge: 5 * 60, strategy: 'jwe' },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
    customRules: {
      '/api/auth/sign-in/*': { window: 60, max: 5 },
      '/api/auth/sign-up/*': { window: 60, max: 3 },
      '/api/auth/change-password': { window: 60, max: 3 },
      '/api/auth/change-email': { window: 60, max: 3 },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            await db.notification.create({
              data: {
                userId: user.id,
                type: 'success',
                title: 'Selamat datang di AIVISO!',
                body: 'Akun Anda berhasil dibuat. Jelajahi Studio, Video, dan Pustaka Prompt di beranda.',
                link: '/',
              },
            })
          } catch (err) {
            log.error({ err: String(err).slice(0, 200) }, 'welcome notification gagal')
          }
        },
      },
    },
  },
  // Plugin ini harus terakhir: menerjemahkan set-cookie BetterAuth ke cookie TanStack Start.
  plugins: [tanstackStartCookies()],
})

export type Session = typeof auth.$Infer.Session
