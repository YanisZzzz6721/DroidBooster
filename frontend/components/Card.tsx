import { HTMLAttributes } from "react"

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?:    string
  tag?:      string
  tagColor?: "turquoise" | "orange"
  hover?:    boolean
  padding?:  string
}

export default function Card({
  title,
  tag,
  tagColor = "turquoise",
  hover = false,
  padding = "1.5rem",
  children,
  style,
  ...props
}: CardProps) {
  return (
    <div
      style={{
        background:  "var(--white)",
        border:      "2px solid var(--black)",
        boxShadow:   "4px 4px 0px var(--black)",
        transition:  hover ? "box-shadow 0.1s ease, transform 0.1s ease" : "none",
        ...style,
      }}
      onMouseEnter={hover ? e => {
        const el = e.currentTarget
        el.style.boxShadow = "6px 6px 0px var(--black)"
        el.style.transform = "translate(-1px, -1px)"
      } : undefined}
      onMouseLeave={hover ? e => {
        const el = e.currentTarget
        el.style.boxShadow = "4px 4px 0px var(--black)"
        el.style.transform = "translate(0, 0)"
      } : undefined}
      {...props}
    >
      {/* Header de la carte */}
      {(title || tag) && (
        <div style={{
          display:      "flex",
          alignItems:   "center",
          justifyContent: "space-between",
          padding:      `0.75rem ${padding}`,
          borderBottom: "2px solid var(--black)",
          background:   "var(--gray-100)",
        }}>
          {title && (
            <span style={{
              fontFamily:    "'Space Grotesk', sans-serif",
              fontWeight:    700,
              fontSize:      "0.8rem",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color:         "var(--black)",
            }}>
              {title}
            </span>
          )}
          {tag && (
            <span style={{
              fontFamily:  "'IBM Plex Mono', monospace",
              fontSize:    "0.7rem",
              fontWeight:  500,
              padding:     "0.15rem 0.5rem",
              border:      "1.5px solid var(--black)",
              background:  tagColor === "turquoise" ? "var(--turquoise)" : "var(--orange)",
              color:       "var(--white)",
            }}>
              {tag}
            </span>
          )}
        </div>
      )}

      {/* Contenu */}
      <div style={{ padding }}>
        {children}
      </div>

    </div>
  )
}