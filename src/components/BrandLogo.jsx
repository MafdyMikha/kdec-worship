import { KDEC_LOGO, KDEC_TOWER } from '../assets/kdecLogo.js'

export default function BrandLogo({ compact = false, className = '' }) {
  return (
    <img
      src={compact ? KDEC_TOWER : KDEC_LOGO}
      alt="KDEC Worship"
      width={compact ? 100 : 176}
      height={compact ? 118 : 180}
      className={`worship-brand-logo ${className}`}
      decoding="async"
    />
  )
}
