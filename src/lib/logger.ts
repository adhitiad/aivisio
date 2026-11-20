import pino from 'pino'

/**
 * Logger terpusat berbasis Pino.
 * Output JSON terstruktur ke stdout (tertangkap oleh dev.log saat pengembangan).
 * Pakai: logger.info({ ctx }, 'pesan') / logger.warn / logger.error({ err }, 'pesan')
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { app: 'aiviso' },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'apiKey', '*.apiKey', 'req.headers.authorization', '*.authorization',
      '*.accessToken', '*.refreshToken', '*.idToken', '*.clientSecret',
      '*.uploadSessionUriEncrypted', '*.sessionUri', '*.token',
      'config.apiKey',
    ],
    censor: '[REDACTED]',
  },
})

/** Logger turunan dengan konteks modul. */
export function moduleLogger(module: string) {
  return logger.child({ module })
}
