interface KeywordBadgeProps {
  word:    string
  variant: "found" | "missing" | "neutral"
}

const STYLES = {
  found: {
    background: "var(--turquoise)",
    color:      "var(--white)",
    border:     "1.5px solid var(--black)",
    shadow:     "2px 2px 0px var(--black)",
  },
  missing: {
    background: "var(--white)",
    color:      "#c0392b",
    border:     "1.5px solid #c0392b",
    shadow:     "2px 2px 0px #c0392b",
  },
  neutral: {
    background: "var(--gray-100)",
    color:      "var(--black)",
    border:     "1.5px solid var(--black)",
    shadow:     "2px 2px 0px var(--black)",
  },
}

export default function KeywordBadge({ word, variant }: KeywordBadgeProps) {
  const s = STYLES[variant]

  return (
    <span style={{
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
    }}>
      {variant === "found"   && "✓ "}
      {variant === "missing" && "✗ "}
      {word}
    </span>
  )
}