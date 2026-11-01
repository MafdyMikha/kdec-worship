import { KDEC_SYMBOLS } from '../assets/kdecLogo.js'

export default function BrandLogo({ compact = false, className = '' }) {
  return (
    <svg
      role="img"
      aria-label="KDEC Worship"
      viewBox={compact ? '0 0 240 264' : '0 0 320 384'}
      width={compact ? 40 : 112}
      height={compact ? 44 : 134.4}
      className={`worship-brand-logo ${className}`}
      focusable="false"
    >
      <use href={`${KDEC_SYMBOLS}#${compact ? 'tower' : 'lockup'}`} />
    </svg>
  )
}
