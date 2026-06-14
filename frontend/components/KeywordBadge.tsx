"use client"

interface KeywordBadgeProps {
  word:    string
  variant: "found" | "missing" | "neutral"
  index?:  number
}

const STYLES = {
  found: {
    bg:          "rgba(10,191,188,0.15)",
    color:       "var(--turquoise)",
    border:      "1.5px solid rgba(10,191,188,0.4)",
    hoverBorder: "rgba(10,191,188,0.8)",
    hoverBg:     "rgba(10,191,188,0.25)",
  },
  missing: {
    bg:          "rgba(224,82,82,0.1)",
    color:       "#e05252",
    border:      "1.5px solid rgba(224,82,82,0.35)",
    hoverBorder: "rgba(224,82,82,0.7)",
    hoverBg:     "rgba(224,82,82,0.2)",
  },
  neutral: {
    bg:          "var(--bg-raised)",
    color:       "var(--fg-muted)",
    border:      "1.5px solid var(--border-col)",
    hoverBorder: "var(--fg-dim)",
    hoverBg:     "var(--bg-raised)",
  },
}

export default function KeywordBadge({ word, variant, index = 0 }: KeywordBadgeProps) {
  const s = STYLES[variant]
  const staggerClass = `stagger-${Math.min((index % 8) + 1, 8)}`

  return (
    <span
      className={`animate-pop keyword-badge ${staggerClass}`}
      style={{
        fontFamily:  "'IBM Plex Mono', monospace",
        fontSize:    "0.7rem",
        fontWeight:  500,
        padding:     "0.2rem 0.55rem",
        background:  s.bg,
        color:       s.color,
        border:      s.border,
        display:     "inline-block",
        lineHeight:  1.4,
        userSelect:  "none",
        transition:  "background 120ms ease, border-color 120ms ease, transform 120ms var(--ease-spring)",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLSpanElement
        el.style.transform   = "translateY(-2px)"
        el.style.background  = s.hoverBg
        el.style.borderColor = s.hoverBorder
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLSpanElement
        el.style.transform   = ""
        el.style.background  = s.bg
        el.style.borderColor = s.border.split(" ").pop()!
      }}
    >
      {variant === "found"   && "✓ "}
      {variant === "missing" && "✗ "}
      {word}
    </span>
  )
}
