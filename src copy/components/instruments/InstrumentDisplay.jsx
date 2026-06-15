// Animated instrument display for the member home page
// Each instrument has a unique SVG animation

const INSTRUMENT_COLORS = {
  'Worship Leader':  { bg: 'from-indigo-500 to-violet-600', light: 'bg-indigo-50', accent: '#6366f1' },
  'Music Director':  { bg: 'from-violet-500 to-purple-600', light: 'bg-violet-50', accent: '#7c3aed' },
  'Pianist/Keys':    { bg: 'from-sky-400 to-blue-600',      light: 'bg-sky-50',    accent: '#0ea5e9' },
  'Acoustic Guitar': { bg: 'from-amber-500 to-orange-600',  light: 'bg-amber-50',  accent: '#f59e0b' },
  'Electric Guitar': { bg: 'from-red-500 to-rose-600',      light: 'bg-red-50',    accent: '#ef4444' },
  'Bass Guitar':     { bg: 'from-teal-500 to-emerald-600',  light: 'bg-teal-50',   accent: '#14b8a6' },
  'Drummer':         { bg: 'from-orange-500 to-red-600',    light: 'bg-orange-50', accent: '#f97316' },
  'Vocalist':        { bg: 'from-pink-500 to-rose-500',     light: 'bg-pink-50',   accent: '#ec4899' },
  'Sound Engineer':  { bg: 'from-slate-600 to-slate-800',   light: 'bg-slate-50',  accent: '#475569' },
  'Projection':      { bg: 'from-cyan-500 to-blue-500',     light: 'bg-cyan-50',   accent: '#06b6d4' },
  'AUX Instrument':  { bg: 'from-lime-500 to-green-600',    light: 'bg-lime-50',   accent: '#84cc16' },
  'Camera':          { bg: 'from-gray-600 to-gray-800',     light: 'bg-gray-50',   accent: '#6b7280' },
}

// ── Piano / Keys ──────────────────────────────────────────
function PianoSVG({ animated }) {
  return (
    <svg viewBox="0 0 160 90" className="w-full h-full">
      <style>{`
        @keyframes piano-glow { 0%,100%{opacity:0.3} 50%{opacity:1} }
        @keyframes key-press { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(0.92)} }
        .pk1 { animation: ${animated ? 'key-press 1.2s ease-in-out infinite 0s' : 'none'} }
        .pk2 { animation: ${animated ? 'key-press 1.2s ease-in-out infinite 0.3s' : 'none'} }
        .pk3 { animation: ${animated ? 'key-press 1.2s ease-in-out infinite 0.6s' : 'none'} }
        .pk4 { animation: ${animated ? 'key-press 1.2s ease-in-out infinite 0.15s' : 'none'} }
        .pk5 { animation: ${animated ? 'key-press 1.2s ease-in-out infinite 0.45s' : 'none'} }
        .pglow { animation: ${animated ? 'piano-glow 2s ease-in-out infinite' : 'none'} }
      `}</style>
      {/* Piano body */}
      <rect x="10" y="20" width="140" height="60" rx="4" fill="#1e293b"/>
      <rect x="12" y="22" width="136" height="56" rx="3" fill="#0f172a"/>
      {/* White keys */}
      {[0,1,2,3,4,5,6,7,8,9,10,11].map((i) => (
        <rect key={i} x={14 + i*11} y={28} width={10} height={44} rx="2" fill="white"
          className={i===0?'pk1':i===2?'pk2':i===5?'pk3':i===7?'pk4':i===9?'pk5':''}
          style={{transformOrigin:`${14+i*11+5}px 28px`}}/>
      ))}
      {/* Black keys */}
      {[0,1,3,4,5].map((i,idx) => (
        <rect key={idx} x={20 + i*11} y={28} width={7} height={27} rx="1.5" fill="#1e293b"/>
      ))}
      {/* Glow under pressed keys */}
      <ellipse cx="36" cy="74" rx="8" ry="3" fill="#0ea5e9" className="pglow"/>
      <ellipse cx="80" cy="74" rx="8" ry="3" fill="#0ea5e9" className="pglow" style={{animationDelay:'0.3s'}}/>
      <ellipse cx="124" cy="74" rx="8" ry="3" fill="#0ea5e9" className="pglow" style={{animationDelay:'0.6s'}}/>
    </svg>
  )
}

// ── Acoustic Guitar ───────────────────────────────────────
function AcousticGuitarSVG({ animated }) {
  return (
    <svg viewBox="0 0 100 160" className="w-full h-full">
      <style>{`
        @keyframes strum { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-3px)} 75%{transform:translateX(3px)} }
        @keyframes shine { 0%,100%{opacity:0.3} 50%{opacity:0.7} }
        .gstrum { animation: ${animated ? 'strum 0.8s ease-in-out infinite' : 'none'}; transform-origin: 50px 80px }
        .gshine { animation: ${animated ? 'shine 2s ease-in-out infinite' : 'none'} }
      `}</style>
      {/* Neck */}
      <rect x="44" y="8" width="12" height="70" rx="3" fill="#92400e"/>
      <rect x="44" y="8" width="12" height="70" rx="3" fill="url(#neckGrad)"/>
      {/* Frets */}
      {[18,26,34,42,50,58,66].map((y,i) => <line key={i} x1="44" y1={y} x2="56" y2={y} stroke="#d97706" strokeWidth="1.5"/>)}
      {/* Body */}
      <ellipse cx="50" cy="115" rx="28" ry="35" fill="#92400e" className="gstrum"/>
      <ellipse cx="50" cy="100" rx="20" ry="20" fill="#78350f" className="gstrum"/>
      <ellipse cx="50" cy="130" rx="24" ry="24" fill="#78350f" className="gstrum"/>
      {/* Sound hole */}
      <circle cx="50" cy="115" r="10" fill="#1c0a00" className="gstrum"/>
      <circle cx="50" cy="115" r="9" fill="#1c0a00" stroke="#d97706" strokeWidth="1" className="gstrum"/>
      {/* Strings */}
      {[45,47,49,51,53,55].map((x,i) => (
        <line key={i} x1={x} y1="10" x2={x} y2="145" stroke="#d1d5db" strokeWidth="0.7" opacity="0.9"/>
      ))}
      {/* Shine */}
      <ellipse cx="38" cy="105" rx="5" ry="8" fill="white" opacity="0.15" className="gshine"/>
      <defs>
        <linearGradient id="neckGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#a16207"/>
          <stop offset="100%" stopColor="#78350f"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

// ── Electric Guitar ───────────────────────────────────────
function ElectricGuitarSVG({ animated }) {
  return (
    <svg viewBox="0 0 100 160" className="w-full h-full">
      <style>{`
        @keyframes elec-glow { 0%,100%{filter:drop-shadow(0 0 3px #ef4444)} 50%{filter:drop-shadow(0 0 10px #ef4444)} }
        .eglow { animation: ${animated ? 'elec-glow 1.5s ease-in-out infinite' : 'none'} }
      `}</style>
      {/* Neck */}
      <rect x="45" y="5" width="10" height="80" rx="2" fill="#374151" className="eglow"/>
      {/* Frets */}
      {[15,23,31,39,47,55,63].map((y,i) => <line key={i} x1="45" y1={y} x2="55" y2={y} stroke="#6b7280" strokeWidth="1.5"/>)}
      {/* Body - Les Paul style */}
      <path d="M20,90 Q15,85 18,75 Q22,65 30,68 Q38,62 42,70 L58,70 Q62,62 70,68 Q78,65 82,75 Q85,85 80,90 Q78,110 75,120 Q65,140 50,143 Q35,140 25,120 Q22,110 20,90 Z" fill="#b91c1c" className="eglow"/>
      {/* Pickups */}
      <rect x="35" y="92" width="30" height="8" rx="1" fill="#1f2937"/>
      <rect x="35" y="105" width="30" height="8" rx="1" fill="#1f2937"/>
      {/* Pickup poles */}
      {[38,41,44,47,50,53,56].map((x,i) => <circle key={i} cx={x} cy="96" r="1.2" fill="#9ca3af"/>)}
      {/* Strings */}
      {[44,46,48,50,52,54].map((x,i) => <line key={i} x1={x} y1="8" x2={x} y2="138" stroke="#9ca3af" strokeWidth="0.6"/>)}
      {/* Knobs */}
      <circle cx="66" cy="120" r="4" fill="#374151"/><circle cx="66" cy="120" r="2" fill="#6b7280"/>
      <circle cx="74" cy="114" r="4" fill="#374151"/><circle cx="74" cy="114" r="2" fill="#6b7280"/>
    </svg>
  )
}

// ── Bass Guitar ───────────────────────────────────────────
function BassGuitarSVG({ animated }) {
  return (
    <svg viewBox="0 0 100 160" className="w-full h-full">
      <style>{`
        @keyframes bass-pulse { 0%,100%{opacity:0.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.02)} }
        .bpulse { animation: ${animated ? 'bass-pulse 1s ease-in-out infinite' : 'none'}; transform-origin:50px 120px }
      `}</style>
      <rect x="46" y="5" width="10" height="85" rx="2" fill="#065f46"/>
      {[18,28,38,48,58,68].map((y,i)=><line key={i} x1="46" y1={y} x2="56" y2={y} stroke="#10b981" strokeWidth="1.5"/>)}
      <path d="M22,95 Q18,88 20,78 Q24,70 32,72 L58,72 Q66,70 70,78 Q72,88 68,95 Q65,120 60,132 Q55,145 50,146 Q45,145 40,132 Q35,120 22,95 Z" fill="#047857" className="bpulse"/>
      <rect x="33" y="100" width="34" height="10" rx="1.5" fill="#064e3b"/>
      {[36,40,44,48,52,56,60].map((x,i)=><circle key={i} cx={x} cy="105" r="1.3" fill="#34d399"/>)}
      {[45,48,51,54].map((x,i)=><line key={i} x1={x} y1="8" x2={x} y2="140" stroke="#6ee7b7" strokeWidth="0.8"/>)}
    </svg>
  )
}

// ── Drums ─────────────────────────────────────────────────
function DrumsSVG({ animated }) {
  return (
    <svg viewBox="0 0 160 130" className="w-full h-full">
      <style>{`
        @keyframes hit-kick { 0%,100%{transform:scaleX(1)} 50%{transform:scaleX(1.04)} }
        @keyframes hit-snare { 0%,85%,100%{transform:rotate(0)} 90%{transform:rotate(-5deg)} }
        @keyframes cymbal-sway { 0%,100%{transform:rotate(-2deg)} 50%{transform:rotate(2deg)} }
        .dkick { animation: ${animated ? 'hit-kick 0.8s ease-in-out infinite' : 'none'}; transform-origin:80px 100px }
        .dsnare { animation: ${animated ? 'hit-snare 1.6s ease-in-out infinite' : 'none'}; transform-origin:45px 80px }
        .dcymbal { animation: ${animated ? 'cymbal-sway 1.2s ease-in-out infinite' : 'none'}; transform-origin:120px 35px }
      `}</style>
      {/* Kick drum */}
      <ellipse cx="80" cy="100" rx="38" ry="25" fill="#1e293b" className="dkick"/>
      <ellipse cx="80" cy="100" rx="35" ry="22" fill="#0f172a" className="dkick"/>
      <ellipse cx="80" cy="100" rx="34" ry="21" fill="#1e293b" stroke="#f97316" strokeWidth="2" className="dkick"/>
      {/* Snare */}
      <ellipse cx="45" cy="80" rx="20" ry="12" fill="#334155" className="dsnare"/>
      <ellipse cx="45" cy="80" rx="18" ry="10" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.5" className="dsnare"/>
      {/* Hi-hat */}
      <ellipse cx="25" cy="50" rx="16" ry="4" fill="#b45309"/>
      <ellipse cx="25" cy="46" rx="16" ry="4" fill="#d97706"/>
      {/* Crash cymbal */}
      <ellipse cx="120" cy="35" rx="20" ry="5" fill="#b45309" className="dcymbal"/>
      <ellipse cx="120" cy="35" rx="18" ry="3" fill="#d97706" className="dcymbal"/>
      {/* Ride */}
      <ellipse cx="135" cy="60" rx="16" ry="4" fill="#92400e"/>
      {/* Stands */}
      <line x1="25" y1="50" x2="25" y2="120" stroke="#374151" strokeWidth="2"/>
      <line x1="120" y1="40" x2="120" y2="120" stroke="#374151" strokeWidth="2"/>
      {/* Sticks */}
      {animated && <>
        <line x1="30" y1="55" x2="55" y2="75" stroke="#fef3c7" strokeWidth="2" opacity="0.9"/>
        <line x1="60" y1="55" x2="38" y2="75" stroke="#fef3c7" strokeWidth="2" opacity="0.9"/>
      </>}
    </svg>
  )
}

// ── Vocalist ──────────────────────────────────────────────
function VocalistSVG({ animated }) {
  return (
    <svg viewBox="0 0 100 160" className="w-full h-full">
      <style>{`
        @keyframes mic-wave { 0%,100%{r:12} 50%{r:18} }
        @keyframes sound-wave { 0%,100%{opacity:0.2;transform:scale(1)} 50%{opacity:0.7;transform:scale(1.1)} }
        @keyframes note-float { 0%{transform:translate(0,0) rotate(0)} 100%{transform:translate(20px,-40px) rotate(20deg); opacity:0} }
        .mwave { animation: ${animated ? 'mic-wave 1s ease-in-out infinite' : 'none'}; transform-origin:50px 50px }
        .swave1 { animation: ${animated ? 'sound-wave 1.4s ease-in-out infinite 0s' : 'none'}; transform-origin:50px 50px }
        .swave2 { animation: ${animated ? 'sound-wave 1.4s ease-in-out infinite 0.2s' : 'none'}; transform-origin:50px 50px }
        .note1 { animation: ${animated ? 'note-float 2s ease-out infinite 0s' : 'none'} }
        .note2 { animation: ${animated ? 'note-float 2s ease-out infinite 0.7s' : 'none'} }
        .note3 { animation: ${animated ? 'note-float 2s ease-out infinite 1.4s' : 'none'} }
      `}</style>
      {/* Sound waves */}
      <circle cx="50" cy="50" r="35" fill="none" stroke="#ec4899" strokeWidth="1.5" opacity="0.3" className="swave2"/>
      <circle cx="50" cy="50" r="28" fill="none" stroke="#ec4899" strokeWidth="1.5" opacity="0.5" className="swave1"/>
      {/* Mic head */}
      <ellipse cx="50" cy="42" rx="14" ry="18" fill="#1e293b"/>
      <ellipse cx="50" cy="42" rx="12" ry="16" fill="#374151"/>
      <path d="M38,42 Q50,26 62,42 Q62,58 50,62 Q38,58 38,42 Z" fill="none" stroke="#94a3b8" strokeWidth="0.8" opacity="0.5"/>
      {/* Mic grille lines */}
      {[34,38,42,46,50,54,58].map((y,i)=><line key={i} x1="38" y1={y} x2="62" y2={y} stroke="#4b5563" strokeWidth="0.6"/>)}
      {/* Mic handle */}
      <rect x="46" y="60" width="8" height="50" rx="4" fill="#1e293b"/>
      <rect x="46" y="60" width="8" height="15" rx="2" fill="#374151"/>
      {/* Cable */}
      <path d="M50,110 Q60,120 55,135 Q50,140 50,150" fill="none" stroke="#374151" strokeWidth="2.5"/>
      {/* Musical notes */}
      <text x="65" y="35" fontSize="14" fill="#ec4899" className="note1">♪</text>
      <text x="72" y="48" fontSize="10" fill="#f9a8d4" className="note2">♫</text>
      <text x="60" y="25" fontSize="11" fill="#ec4899" className="note3">♩</text>
    </svg>
  )
}

// ── Sound Engineer ────────────────────────────────────────
function SoundEngineerSVG({ animated }) {
  return (
    <svg viewBox="0 0 160 120" className="w-full h-full">
      <style>{`
        @keyframes fader-move { 0%,100%{transform:translateY(0)} 33%{transform:translateY(-8px)} 66%{transform:translateY(4px)} }
        @keyframes led-blink { 0%,90%,100%{opacity:1} 95%{opacity:0.3} }
        .f1 { animation: ${animated ? 'fader-move 2s ease-in-out infinite 0s' : 'none'} }
        .f2 { animation: ${animated ? 'fader-move 2s ease-in-out infinite 0.3s' : 'none'} }
        .f3 { animation: ${animated ? 'fader-move 2s ease-in-out infinite 0.6s' : 'none'} }
        .f4 { animation: ${animated ? 'fader-move 2s ease-in-out infinite 0.9s' : 'none'} }
        .f5 { animation: ${animated ? 'fader-move 2s ease-in-out infinite 1.2s' : 'none'} }
        .f6 { animation: ${animated ? 'fader-move 2s ease-in-out infinite 1.5s' : 'none'} }
        .led { animation: ${animated ? 'led-blink 1s ease-in-out infinite' : 'none'} }
      `}</style>
      {/* Mixer body */}
      <rect x="10" y="20" width="140" height="90" rx="6" fill="#0f172a"/>
      <rect x="14" y="24" width="132" height="82" rx="4" fill="#1e293b"/>
      {/* Channel strips */}
      {[0,1,2,3,4,5].map(i => {
        const x = 20 + i * 22
        return (
          <g key={i}>
            <rect x={x} y="32" width="14" height="50" rx="2" fill="#0f172a"/>
            {/* Fader track */}
            <rect x={x+5} y="34" width="4" height="46" rx="2" fill="#374151"/>
            {/* Fader knob */}
            <rect x={x+2} y="50" width="10" height="8" rx="2" fill="#64748b" className={`f${i+1}`}/>
            {/* Knobs */}
            <circle cx={x+7} cy="92" r="4" fill="#374151"/>
            <circle cx={x+7} cy="92" r="2.5" fill="#475569"/>
            <line x1={x+7} y1="92" x2={x+7} y2="89" stroke="#94a3b8" strokeWidth="1"/>
          </g>
        )
      })}
      {/* VU meters */}
      <rect x="150" y="28" width="5" height="70" rx="2" fill="#0f172a"/>
      {[0,4,8,12,16,20,24,28,32,36,40,44,48,52,56,60,64].map((y,i) => (
        <rect key={i} x="150" y={28+y} width="5" height="3" rx="0.5" fill={i<10?'#22c55e':i<14?'#f59e0b':'#ef4444'} opacity={animated&&i<12?1:0.3} className="led"/>
      ))}
      {/* Master fader */}
      <rect x="136" y="32" width="10" height="60" rx="2" fill="#0f172a"/>
      <rect x="138" y="34" width="6" height="56" rx="2" fill="#374151"/>
      <rect x="135" y="60" width="16" height="10" rx="3" fill="#94a3b8"/>
    </svg>
  )
}

// ── Worship Leader ────────────────────────────────────────
function WorshipLeaderSVG({ animated }) {
  return (
    <svg viewBox="0 0 100 160" className="w-full h-full">
      <style>{`
        @keyframes raise-hands { 0%,100%{transform:rotate(0)} 50%{transform:rotate(-10deg)} }
        @keyframes glow-crown { 0%,100%{opacity:0.6;r:4} 50%{opacity:1;r:6} }
        @keyframes worship-note { 0%{transform:translate(0,0);opacity:1} 100%{transform:translate(15px,-50px);opacity:0} }
        .lhand { animation: ${animated ? 'raise-hands 2s ease-in-out infinite' : 'none'}; transform-origin:30px 70px }
        .rhand { animation: ${animated ? 'raise-hands 2s ease-in-out infinite 1s' : 'none'}; transform-origin:70px 70px; transform:scaleX(-1) }
        .crown { animation: ${animated ? 'glow-crown 2s ease-in-out infinite' : 'none'} }
        .wn1 { animation: ${animated ? 'worship-note 2.5s ease-out infinite 0s' : 'none'} }
        .wn2 { animation: ${animated ? 'worship-note 2.5s ease-out infinite 0.8s' : 'none'} }
        .wn3 { animation: ${animated ? 'worship-note 2.5s ease-out infinite 1.6s' : 'none'} }
      `}</style>
      {/* Crown/halo glow */}
      <circle cx="50" cy="22" r="18" fill="none" stroke="#fbbf24" strokeWidth="1" opacity="0.4"/>
      <circle cx="50" cy="22" r="14" fill="none" stroke="#f59e0b" strokeWidth="1.5" opacity="0.6"/>
      {/* Person */}
      <circle cx="50" cy="28" r="14" fill="#fed7aa"/>
      {/* Eyes */}
      <circle cx="45" cy="26" r="2" fill="#1e293b"/>
      <circle cx="55" cy="26" r="2" fill="#1e293b"/>
      {/* Smile */}
      <path d="M44,32 Q50,37 56,32" fill="none" stroke="#92400e" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Body */}
      <path d="M30,70 Q28,55 35,48 Q42,42 50,42 Q58,42 65,48 Q72,55 70,70 L65,90 L35,90 Z" fill="#4f46e5"/>
      {/* Left arm raised */}
      <path d="M35,55 Q20,45 15,30 Q14,24 18,22" fill="none" stroke="#fed7aa" strokeWidth="5" strokeLinecap="round" className="lhand"/>
      <circle cx="18" cy="22" r="4" fill="#fed7aa" className="lhand"/>
      {/* Right arm raised */}
      <path d="M65,55 Q80,45 85,30 Q86,24 82,22" fill="none" stroke="#fed7aa" strokeWidth="5" strokeLinecap="round" className="rhand"/>
      <circle cx="82" cy="22" r="4" fill="#fed7aa" className="rhand"/>
      {/* Legs */}
      <path d="M35,90 Q33,115 35,140" fill="none" stroke="#1e293b" strokeWidth="6" strokeLinecap="round"/>
      <path d="M65,90 Q67,115 65,140" fill="none" stroke="#1e293b" strokeWidth="6" strokeLinecap="round"/>
      {/* Floating notes */}
      <text x="18" y="15" fontSize="13" fill="#fbbf24" className="wn1">♪</text>
      <text x="72" y="18" fontSize="10" fill="#fbbf24" className="wn2">♫</text>
      <text x="45" y="10" fontSize="11" fill="#f59e0b" className="wn3">♩</text>
      {/* Stars */}
      {animated && [0,1,2].map(i=><circle key={i} cx={40+i*10} cy={i===1?12:14} r={2} fill="#fbbf24" className="crown"/>)}
    </svg>
  )
}

// ── Projection ────────────────────────────────────────────
function ProjectionSVG({ animated }) {
  return (
    <svg viewBox="0 0 160 120" className="w-full h-full">
      <style>{`
        @keyframes screen-slide { 0%,100%{transform:translateX(0)} 50%{transform:translateX(-20px)} }
        @keyframes proj-beam { 0%,100%{opacity:0.4} 50%{opacity:0.8} }
        .sslide { animation: ${animated ? 'screen-slide 3s ease-in-out infinite' : 'none'} }
        .pbeam { animation: ${animated ? 'proj-beam 2s ease-in-out infinite' : 'none'} }
      `}</style>
      {/* Screen */}
      <rect x="10" y="10" width="100" height="70" rx="3" fill="#0f172a"/>
      <rect x="13" y="13" width="94" height="64" rx="2" fill="#0ea5e9" opacity="0.1"/>
      {/* Slide content */}
      <g clipPath="url(#screenClip)" className="sslide">
        <rect x="18" y="20" width="84" height="10" rx="2" fill="#e2e8f0" opacity="0.8"/>
        <rect x="18" y="35" width="60" height="6" rx="1" fill="#94a3b8" opacity="0.6"/>
        <rect x="18" y="44" width="72" height="6" rx="1" fill="#94a3b8" opacity="0.6"/>
        <rect x="18" y="53" width="50" height="6" rx="1" fill="#94a3b8" opacity="0.4"/>
        {/* Cross symbol */}
        <line x1="95" y1="30" x2="95" y2="55" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round"/>
        <line x1="88" y1="36" x2="102" y2="36" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round"/>
      </g>
      <clipPath id="screenClip"><rect x="13" y="13" width="94" height="64"/></clipPath>
      {/* Projector */}
      <rect x="120" y="40" width="35" height="25" rx="4" fill="#334155"/>
      <circle cx="127" cy="52" r="8" fill="#1e293b"/>
      <circle cx="127" cy="52" r="5" fill="#0ea5e9" opacity="0.7"/>
      {/* Beam */}
      <path d="M120,45 L113,25 L113,75 L120,68 Z" fill="#0ea5e9" opacity="0.15" className="pbeam"/>
      {/* Laptop */}
      <rect x="75" y="88" width="50" height="28" rx="3" fill="#1e293b"/>
      <rect x="78" y="91" width="44" height="22" rx="2" fill="#0f172a"/>
      <rect x="80" y="92" width="40" height="20" rx="1" fill="#0ea5e9" opacity="0.15"/>
      <rect x="65" y="116" width="70" height="4" rx="2" fill="#374151"/>
    </svg>
  )
}

// ── Camera ────────────────────────────────────────────────
function CameraSVG({ animated }) {
  return (
    <svg viewBox="0 0 160 110" className="w-full h-full">
      <style>{`
        @keyframes rec-blink { 0%,49%,100%{opacity:1} 50%,99%{opacity:0} }
        @keyframes zoom { 0%,100%{transform:scaleX(1)} 50%{transform:scaleX(1.05)} }
        .rblink { animation: ${animated ? 'rec-blink 1s step-end infinite' : 'none'} }
        .czoom { animation: ${animated ? 'zoom 3s ease-in-out infinite' : 'none'}; transform-origin:70px 55px }
      `}</style>
      {/* Camera body */}
      <rect x="20" y="30" width="100" height="60" rx="8" fill="#1e293b" className="czoom"/>
      {/* Lens barrel */}
      <circle cx="68" cy="60" r="28" fill="#0f172a" className="czoom"/>
      <circle cx="68" cy="60" r="22" fill="#1e293b" className="czoom"/>
      <circle cx="68" cy="60" r="16" fill="#0f172a" className="czoom"/>
      <circle cx="68" cy="60" r="10" fill="#1e40af" opacity="0.8" className="czoom"/>
      <circle cx="68" cy="60" r="6"  fill="#3b82f6" className="czoom"/>
      <circle cx="64" cy="56" r="2" fill="white" opacity="0.5" className="czoom"/>
      {/* Viewfinder */}
      <rect x="80" y="32" width="30" height="20" rx="3" fill="#374151"/>
      <rect x="83" y="35" width="24" height="14" rx="2" fill="#0f172a"/>
      {/* REC indicator */}
      <circle cx="116" cy="38" r="5" fill="#ef4444" className="rblink"/>
      <text x="110" y="54" fontSize="7" fill="#ef4444" fontWeight="bold" className="rblink">REC</text>
      {/* Grip */}
      <rect x="110" y="55" width="18" height="35" rx="5" fill="#374151"/>
      {/* Hot shoe */}
      <rect x="55" y="25" width="30" height="7" rx="2" fill="#374151"/>
      {/* Status light */}
      <circle cx="26" cy="38" r="4" fill="#22c55e" opacity="0.8"/>
    </svg>
  )
}

// ── Music Director ────────────────────────────────────────
function MusicDirectorSVG({ animated }) {
  return (
    <svg viewBox="0 0 160 130" className="w-full h-full">
      <style>{`
        @keyframes baton-wave { 0%,100%{transform:rotate(-15deg)} 50%{transform:rotate(15deg)} }
        @keyframes note-appear { 0%{opacity:0;transform:scale(0)} 30%{opacity:1;transform:scale(1)} 80%{opacity:1} 100%{opacity:0;transform:translate(10px,-20px)} }
        .baton { animation: ${animated ? 'baton-wave 0.8s ease-in-out infinite' : 'none'}; transform-origin:80px 60px }
        .mn1 { animation: ${animated ? 'note-appear 2s ease-in-out infinite 0s' : 'none'} }
        .mn2 { animation: ${animated ? 'note-appear 2s ease-in-out infinite 0.5s' : 'none'} }
        .mn3 { animation: ${animated ? 'note-appear 2s ease-in-out infinite 1s' : 'none'} }
        .mn4 { animation: ${animated ? 'note-appear 2s ease-in-out infinite 1.5s' : 'none'} }
      `}</style>
      {/* Sheet music */}
      <rect x="15" y="60" width="70" height="55" rx="3" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
      {[70,75,80,85,90,95,100].map((y,i)=><line key={i} x1="20" y1={y} x2="80" y2={y} stroke="#94a3b8" strokeWidth="0.7"/>)}
      {/* Notes on staff */}
      <circle cx="28" cy="75" r="3" fill="#1e293b"/><line x1="31" y1="75" x2="31" y2="62" stroke="#1e293b" strokeWidth="1.5"/>
      <circle cx="40" cy="80" r="3" fill="#1e293b"/><line x1="43" y1="80" x2="43" y2="67" stroke="#1e293b" strokeWidth="1.5"/>
      <circle cx="52" cy="70" r="3" fill="#1e293b"/><line x1="55" y1="70" x2="55" y2="57" stroke="#1e293b" strokeWidth="1.5"/>
      <circle cx="64" cy="85" r="3" fill="#1e293b"/><line x1="67" y1="85" x2="67" y2="72" stroke="#1e293b" strokeWidth="1.5"/>
      {/* Treble clef */}
      <text x="19" y="87" fontSize="24" fill="#7c3aed" fontFamily="serif">𝄞</text>
      {/* Baton */}
      <line x1="70" y1="75" x2="130" y2="25" stroke="#d97706" strokeWidth="3" strokeLinecap="round" className="baton"/>
      <circle cx="130" cy="25" r="5" fill="#f59e0b" className="baton"/>
      <circle cx="70" cy="75" r="7" fill="#92400e" className="baton"/>
      {/* Floating notes */}
      <text x="100" y="55" fontSize="16" fill="#7c3aed" className="mn1">♪</text>
      <text x="120" y="45" fontSize="12" fill="#a78bfa" className="mn2">♫</text>
      <text x="90" y="40" fontSize="14" fill="#7c3aed" className="mn3">♩</text>
      <text x="135" y="60" fontSize="10" fill="#a78bfa" className="mn4">𝅗𝅥</text>
    </svg>
  )
}

// ── Main exported component ───────────────────────────────
export default function InstrumentDisplay({ role, animated = true, size = 'md' }) {
  const sizeClass = { sm:'w-24 h-24', md:'w-40 h-40', lg:'w-56 h-56', xl:'w-72 h-72' }[size] || 'w-40 h-40'
  const colors = INSTRUMENT_COLORS[role] || INSTRUMENT_COLORS['Vocalist']

  const getIllustration = () => {
    switch (role) {
      case 'Pianist/Keys':    return <PianoSVG animated={animated}/>
      case 'Acoustic Guitar': return <AcousticGuitarSVG animated={animated}/>
      case 'Electric Guitar': return <ElectricGuitarSVG animated={animated}/>
      case 'Bass Guitar':     return <BassGuitarSVG animated={animated}/>
      case 'Drummer':         return <DrumsSVG animated={animated}/>
      case 'Vocalist':        return <VocalistSVG animated={animated}/>
      case 'Sound Engineer':  return <SoundEngineerSVG animated={animated}/>
      case 'Projection':      return <ProjectionSVG animated={animated}/>
      case 'Camera':          return <CameraSVG animated={animated}/>
      case 'Music Director':  return <MusicDirectorSVG animated={animated}/>
      case 'Worship Leader':  return <WorshipLeaderSVG animated={animated}/>
      default:                return <VocalistSVG animated={animated}/>
    }
  }

  return (
    <div className={`${sizeClass} relative flex items-center justify-center`}>
      {/* Gradient background circle */}
      <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${colors.bg} opacity-15`}/>
      <div className={`w-full h-full p-3 ${sizeClass}`}>
        {getIllustration()}
      </div>
    </div>
  )
}

export { INSTRUMENT_COLORS }
