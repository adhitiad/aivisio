'use client'

const INFINITY_PATH =
  'M 20,50 C 20,20 55,20 75,50 C 95,80 130,80 130,50 C 130,20 95,20 75,50 C 55,80 20,80 20,50 Z'

interface InfinityLogoProps {
  width?: number
  className?: string
  glow?: boolean
}

/**
 * Logo aiviso: simbol infinity neon dengan aliran data (dot) mengikuti kurva,
 * direplikasi dari aset brand yang diunggah pengguna.
 */
export function InfinityLogo({ width = 200, className = '', glow = true }: InfinityLogoProps) {
  const height = Math.round(width / 2)
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 150 100"
      className={className}
      role="img"
      aria-label="Logo aiviso"
    >
      <defs>
        <linearGradient id="aivisoStroke" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="35%" stopColor="#6366f1" />
          <stop offset="70%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#ec4899" />
          <animateTransform
            attributeName="gradientTransform"
            type="rotate"
            from="0 0.5 0.5"
            to="360 0.5 0.5"
            dur="8s"
            repeatCount="indefinite"
          />
        </linearGradient>
        {glow && (
          <filter id="aivisoGlow" x="-40%" y="-60%" width="180%" height="220%">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>

      {/* kurva infinity utama */}
      <path
        id="aiviso-inf-path"
        d={INFINITY_PATH}
        fill="none"
        stroke="url(#aivisoStroke)"
        strokeWidth="5"
        strokeLinecap="round"
        filter={glow ? 'url(#aivisoGlow)' : undefined}
      />

      {/* aliran cahaya (comet) bergerak sepanjang kurva */}
      <path
        d={INFINITY_PATH}
        fill="none"
        stroke="#e0f2fe"
        strokeWidth="2.4"
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray="10 90"
        opacity="0.9"
        style={{ animation: 'aiviso-comet 3.2s linear infinite' }}
      />
      <path
        d={INFINITY_PATH}
        fill="none"
        stroke="#f0abfc"
        strokeWidth="2"
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray="6 94"
        opacity="0.8"
        style={{ animation: 'aiviso-comet 4.4s linear infinite', animationDelay: '-1.6s' }}
      />

      {/* titik data mengalir di sepanjang kurva */}
      <circle r="3" fill="#22d3ee">
        <animateMotion dur="6s" repeatCount="indefinite">
          <mpath href="#aiviso-inf-path" />
        </animateMotion>
        <animate attributeName="opacity" values="0.35;1;0.35" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle r="2.4" fill="#e879f9">
        <animateMotion dur="8s" begin="-2.5s" repeatCount="indefinite">
          <mpath href="#aiviso-inf-path" />
        </animateMotion>
        <animate attributeName="opacity" values="1;0.3;1" dur="2.6s" repeatCount="indefinite" />
      </circle>
      <circle r="2.2" fill="#ffffff">
        <animateMotion dur="10s" begin="-5s" repeatCount="indefinite">
          <mpath href="#aiviso-inf-path" />
        </animateMotion>
        <animate attributeName="opacity" values="0.4;1;0.4" dur="3s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}

export function AivisoWordmark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const cls =
    size === 'lg'
      ? 'text-6xl sm:text-7xl'
      : size === 'md'
        ? 'text-3xl'
        : 'text-xl'
  return (
    <span className={`font-bold tracking-tight ${cls}`}>
      <span className="text-brand-gradient">ai</span>
      <span className="text-foreground">viso</span>
    </span>
  )
}
