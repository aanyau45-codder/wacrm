// Flat SVG illustrations for the welcome and auth screens, in the
// Pastel Cards palette. `line` renders the figure as outline art.

const INK = '#17171c'
const LILAC = '#b9b8f2'
const LILAC_SOFT = '#dcdcfb'
const PEACH = '#fde3cf'
const MINT = '#c9eee6'
const CORAL = '#fbcaca'
const SKIN = '#e8a67e'
const HAIR = '#2b2340'

/** Waist-up person holding a phone, with chat bubbles floating around. */
export function PersonPhone({
  blob = LILAC_SOFT,
  line = false,
  className,
}: {
  blob?: string
  line?: boolean
  className?: string
}) {
  const stroke = line ? { stroke: INK, strokeWidth: 2.5, strokeLinejoin: 'round' as const } : {}
  const fill = (c: string) => (line ? '#fff' : c)
  return (
    <svg viewBox="0 0 300 270" className={className} aria-hidden>
      {/* background blob */}
      {!line && (
        <path
          d="M58 120C52 70 98 34 150 38c58 4 104 40 98 98-5 52-30 104-98 104-62 0-86-62-92-120z"
          fill={blob}
        />
      )}
      {line && <circle cx="150" cy="150" r="104" fill="none" stroke={LILAC} strokeWidth="2" strokeDasharray="4 8" />}

      {/* decorative dots */}
      <circle cx="252" cy="54" r="7" fill="none" stroke={INK} strokeWidth="2" />
      <circle cx="40" cy="200" r="10" fill={line ? LILAC : MINT} />
      <circle cx="268" cy="196" r="5" fill={line ? INK : CORAL} />

      {/* torso */}
      <path d="M92 270c0-56 22-80 58-80s58 24 58 80z" fill={line ? LILAC : LILAC} {...stroke} />
      {/* collar */}
      <path d="M134 192c4 12 28 12 32 0" fill="none" stroke={line ? INK : '#9a98e0'} strokeWidth="3" strokeLinecap="round" />
      {/* neck */}
      <rect x="140" y="164" width="20" height="28" rx="9" fill={fill(SKIN)} {...stroke} />
      {/* head */}
      <circle cx="150" cy="138" r="32" fill={fill(SKIN)} {...stroke} />
      {/* hair */}
      <path
        d="M117 140c-4-34 18-50 38-48 24 2 34 22 28 48-6-14-18-24-34-24-14 0-26 10-32 24z"
        fill={line ? INK : HAIR}
      />
      {/* face */}
      <path d="M134 142q5-5 10 0M156 142q5-5 10 0" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M142 154q8 8 16 0" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      {!line && (
        <>
          <circle cx="131" cy="152" r="5" fill="#f4a3a3" opacity=".7" />
          <circle cx="169" cy="152" r="5" fill="#f4a3a3" opacity=".7" />
        </>
      )}

      {/* raised arm + phone */}
      <path d="M196 214c10-6 16-18 14-34" fill="none" stroke={line ? INK : '#a3a1ea'} strokeWidth="16" strokeLinecap="round" />
      {line && <path d="M196 214c10-6 16-18 14-34" fill="none" stroke={LILAC} strokeWidth="11" strokeLinecap="round" />}
      <rect x="196" y="126" width="34" height="58" rx="8" fill={INK} />
      <rect x="200" y="132" width="26" height="42" rx="4" fill={line ? '#fff' : MINT} />
      <circle cx="210" cy="182" r="9" fill={fill(SKIN)} {...stroke} />

      {/* chat bubbles */}
      <g>
        <rect x="26" y="64" width="86" height="36" rx="16" fill="#fff" stroke={line ? INK : 'none'} strokeWidth="2" />
        <path d="M44 98l-6 12 16-10z" fill="#fff" stroke={line ? INK : 'none'} strokeWidth="2" strokeLinejoin="round" />
        <circle cx="54" cy="82" r="4" fill={LILAC} />
        <circle cx="69" cy="82" r="4" fill={LILAC} />
        <circle cx="84" cy="82" r="4" fill={LILAC} />
      </g>
      <g>
        <rect x="214" y="72" width="70" height="32" rx="14" fill={line ? '#fff' : PEACH} stroke={line ? INK : 'none'} strokeWidth="2" />
        <path d="M230 89l5 5 9-10M242 89l5 5 9-10" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* heart */}
      <path
        d="M70 140c-6-8-20-2-14 8l14 12 14-12c6-10-8-16-14-8z"
        fill={line ? 'none' : CORAL}
        stroke={line ? INK : 'none'}
        strokeWidth="2"
      />
    </svg>
  )
}

/** Small decorative leaf sprig for the login header. */
export function Sprig({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 80" className={className} aria-hidden>
      <circle cx="18" cy="22" r="8" fill="none" stroke={INK} strokeWidth="2" />
      <circle cx="140" cy="54" r="11" fill={LILAC_SOFT} stroke={INK} strokeWidth="2" />
      <path d="M40 66C70 50 100 30 128 8" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      {[
        [56, 56, -30],
        [74, 46, -40],
        [92, 34, -45],
        [108, 22, -50],
      ].map(([x, y, r], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
          <ellipse cx="0" cy="-12" rx="5" ry="11" fill={INK} />
          <ellipse cx="6" cy="10" rx="5" ry="11" fill={LILAC} transform="rotate(70)" />
        </g>
      ))}
    </svg>
  )
}
