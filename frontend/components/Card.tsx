import { HTMLAttributes } from "react"

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?:    string
  tag?:      string
  tagColor?: "turquoise" | "orange" | "black"
  hover?:    boolean
  padding?:  string
  animate?:  boolean
  stagger?:  number
}

export default function Card({
  title,
  tag,
  tagColor = "turquoise",
  hover    = false,
  padding  = "1.5rem",
  animate  = false,
  stagger,
  children,
  style,
  className = "",
  ...props
}: CardProps) {

  const animClass = animate
    ? `animate-in ${stagger ? `stagger-${Math.min(stagger, 8)}` : ""}`
    : ""

  const tagBg: Record<string, string> = {
    turquoise: "var(--turquoise)",
    orange:    "var(--orange)",
    black:     "var(--bg-page)",
  }

  return (
    <div
      className={`${animClass} ${className}`.trim()}
      style={{
        background:  "var(--bg-surface)",
        border:      "1.5px solid var(--border-col)",
        boxShadow:   "var(--shadow)",
        transition:  hover
          ? "box-shadow 120ms var(--ease-smooth), transform 120ms var(--ease-smooth), border-color 120ms var(--ease-smooth)"
          : "none",
        ...style,
      }}
      onMouseEnter={hover ? e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.boxShadow   = "4px 4px 0px var(--turquoise)"
        el.style.borderColor = "var(--turquoise)"
        el.style.transform   = "translate(-1px, -1px)"
      } : undefined}
      onMouseLeave={hover ? e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.boxShadow   = "var(--shadow)"
        el.style.borderColor = "var(--border-col)"
        el.style.transform   = "translate(0, 0)"
      } : undefined}
      {...props}
    >
      {(title || tag) && (
        <div style={{
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "space-between",
          padding:         `0.65rem ${padding}`,
          borderBottom:    "1px solid var(--border-col)",
          background:      "var(--bg-raised)",
        }}>
          {title && (
            <span style={{
              fontFamily:    "'Space Grotesk', sans-serif",
              fontWeight:    700,
              fontSize:      "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color:         "var(--fg-muted)",
            }}>
              {title}
            </span>
          )}
          {tag && (
            <span style={{
              fontFamily:  "'IBM Plex Mono', monospace",
              fontSize:    "0.68rem",
              fontWeight:  500,
              padding:     "0.15rem 0.5rem",
              border:      "1.5px solid transparent",
              background:  tagBg[tagColor] ?? "var(--turquoise)",
              color:       "#fff",
            }}>
              {tag}
            </span>
          )}
        </div>
      )}

      <div style={{ padding }}>
        {children}
      </div>
    </div>
  )
}
