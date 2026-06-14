"use client"

interface KeywordBadgeProps {
  word:    string
  variant: "found" | "missing" | "neutral"
  index?:  number   // pour le stagger
}

const STYLES = {
  found: {
    background: "var(--turquoise)",
    color:      "var(--white)",
    border:     "1.5px solid var(--black)",
    shadow:     "2px 2px 0px var(--black)",
    hoverShadow:"3px 3px 0px var(--black)",
  },
  missing: {
    background: "var(--white)",
    color:      "#c0392b",
    border:     "1.5px solid #c0392b",
    shadow:     "2px 2px 0px #c0392b",
    hoverShadow:"3px 3px 0px #c0392b",
  },
  neutral: {
    background: "var(--gray-100)",
    color:      "var(--black)",
    border:     "1.5px solid var(--black)",
    shadow:     "2px 2px 0px var(--black)",
    hoverShadow:"3px 3px 0px var(--black)",
  },
}

export default function KeywordBadge({ word, variant, index = 0 }: KeywordBadgeProps) {
  const s = STYLES[variant]
  // Stagger max 8 → cycle
  const staggerClass = `stagger-${Math.min((index % 8) + 1, 8)}`

  return (
    <span
      className={`animate-in keyword-badge ${staggerClass}`}
      style={{
        fontFamily:  "'IBM Plex Mono', monospace",
        fontSize:    "0.72rem",
        fontWeight:  500,
        padding:     "0.2rem 0.6rem",
        background:  s.background,
        color:       s.color,
        border:      s.border,
        boxShadow:   s.shadow,
        display:     "inline-block",
        lineHeight:  1.4,
        userSelect:  "none",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLSpanElement
        el.style.transform  = "translateY(-2px)"
        el.style.boxShadow  = s.hoverShadow
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLSpanElement
        el.style.transform  = ""
        el.style.boxShadow  = s.shadow
      }}
    >
      {variant === "found"   && "✓ "}
      {variant === "missing" && "✗ "}
      {word}
    </span>
  )
}
