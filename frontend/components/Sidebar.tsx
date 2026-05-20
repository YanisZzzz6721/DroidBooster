"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const NAV = [
  { href: "/",         label: "Générer",    icon: "⚡", desc: "Lettre & CV"   },
  { href: "/optimize", label: "Optimiser",  icon: "◈",  desc: "Analyse ATS"  },
  { href: "/history",  label: "Historique", icon: "◎",  desc: "Candidatures" },
]

export default function Sidebar() {
  const path = usePathname()

  return (
    <aside style ={{
      position:      "fixed",
      top:           0,
      left:          0,
      width:         "220px",
      height:        "100vh",
      background:    "#0D2137",
      borderRight:   "2px solid var(--black)",
      display:       "flex",
      flexDirection: "column",
      zIndex:        100,
    }}>

      {/* Logo */}
      <div style={{
        padding:      "1.5rem 1.25rem 1.25rem",
        borderBottom: "2px solid rgba(0,0,0,0.15)",
      }}>
        <div style={{
          fontFamily:    "'Space Grotesk', sans-serif",
          fontWeight:    700,
          fontSize:      "1.15rem",
          color:         "var(--white)",
          letterSpacing: "-0.03em",
        }}>
          Droid<span style={{ color: "var(--orange)" }}>Booster</span>
        </div>
        <div style={{
          fontFamily:    "'IBM Plex Mono', monospace",
          fontSize:      "0.62rem",
          color:         "rgba(255,255,255,0.55)",
          marginTop:     "0.2rem",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
        }}>
          v1.0 — IA Candidatures
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "0.75rem 0" }}>
        {NAV.map(item => {
          const active = path === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display:        "flex",
                alignItems:     "center",
                gap:            "0.75rem",
                padding:        "0.75rem 1.25rem",
                textDecoration: "none",
                borderLeft:     active ? "4px solid var(--orange)" : "4px solid transparent",
                background:     active ? "rgba(0,0,0,0.15)" : "transparent",
                transition:     "all 0.1s ease",
              }}
              onMouseEnter={e => {
                if (!active)(e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.1)"
              }}
              onMouseLeave={e => {
                if (!active)(e.currentTarget as HTMLElement).style.background = "transparent"
              }}
            >
              <span style={{
                fontSize:   "1rem",
                color:      active ? "var(--orange)" : "rgba(255,255,255,0.7)",
                width:      "18px",
                textAlign:  "center",
                flexShrink: 0,
              }}>
                {item.icon}
              </span>

              <div>
                <div style={{
                  fontFamily:    "'Space Grotesk', sans-serif",
                  fontWeight:    active ? 700 : 500,
                  fontSize:      "0.85rem",
                  color:         active ? "var(--white)" : "rgba(255,255,255,0.75)",
                  letterSpacing: "0.01em",
                }}>
                  {item.label}
                </div>
                <div style={{
                  fontFamily:    "'IBM Plex Mono', monospace",
                  fontSize:      "0.62rem",
                  color:         active ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.4)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}>
                  {item.desc}
                </div>
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{
        padding:   "1rem 1.25rem",
        borderTop: "2px solid rgba(0,0,0,0.15)",
      }}>
        <div style={{
          fontFamily:    "'IBM Plex Mono', monospace",
          fontSize:      "0.62rem",
          color:         "rgba(255,255,255,0.4)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          lineHeight:    1.7,
        }}>
          Powered by<br />
          <span style={{ color: "var(--orange)", fontWeight: 600 }}>
            Anthropic Claude
          </span>
        </div>
      </div>

    </aside>
  )
}