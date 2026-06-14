"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

const NAV = [
  { href: "/",         label: "Générer",    icon: "⚡", desc: "Lettre & CV"    },
  { href: "/optimize", label: "Optimiser",  icon: "◈",  desc: "Analyse ATS"   },
  { href: "/export",   label: "Exporter",   icon: "↓",  desc: "CV → DOCX"     },
  { href: "/search",   label: "Rechercher", icon: "◎",  desc: "Offres emploi"  },
  { href: "/history",  label: "Historique", icon: "◎",  desc: "Candidatures"  },
  { href: "/rag",      label: "RAG",        icon: "⬡",  desc: "Base apprent." },
]

const TOKEN_KEY = "droidbooster_tokens"

interface TokenStats {
  input:  number
  output: number
  calls:  number
}

export function addTokenUsage(input: number, output: number) {
  try {
    const raw   = localStorage.getItem(TOKEN_KEY)
    const stats: TokenStats = raw ? JSON.parse(raw) : { input: 0, output: 0, calls: 0 }
    stats.input  += input
    stats.output += output
    stats.calls  += 1
    localStorage.setItem(TOKEN_KEY, JSON.stringify(stats))
    window.dispatchEvent(new Event("tokenUpdate"))
  } catch {}
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function estimateCost(input: number, output: number): string {
  // Claude Sonnet 4.6 : $3/M input, $15/M output
  const cost = (input / 1_000_000) * 3 + (output / 1_000_000) * 15
  if (cost < 0.01) return `< $0.01`
  return `$${cost.toFixed(2)}`
}

export default function Sidebar() {
  const path   = usePathname()
  const [stats, setStats] = useState<TokenStats>({ input: 0, output: 0, calls: 0 })

  useEffect(() => {
    function load() {
      try {
        const raw = localStorage.getItem(TOKEN_KEY)
        if (raw) setStats(JSON.parse(raw))
      } catch {}
    }
    load()
    window.addEventListener("tokenUpdate", load)
    return () => window.removeEventListener("tokenUpdate", load)
  }, [])

  function resetTokens() {
    localStorage.removeItem(TOKEN_KEY)
    setStats({ input: 0, output: 0, calls: 0 })
  }

  return (
    <aside style={{
      position:      "fixed",
      top:           0,
      left:          0,
      width:         "220px",
      height:        "100vh",
      background:    "#0B1120",
      borderRight:   "1px solid rgba(45,55,72,0.8)",
      display:       "flex",
      flexDirection: "column",
      zIndex:        100,
    }}>

      {/* Logo */}
      <div style={{ padding: "1.5rem 1.25rem 1.25rem", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "1.15rem", color: "var(--white)", letterSpacing: "-0.03em" }}>
          Droid<span style={{ color: "var(--orange)" }}>Booster</span>
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "rgba(255,255,255,0.55)", marginTop: "0.2rem", textTransform: "uppercase", letterSpacing: "0.12em" }}>
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
                borderLeft:     active ? "3px solid var(--orange)" : "3px solid transparent",
                background:     active ? "rgba(232,99,10,0.1)" : "transparent",
                transition:     "all 0.15s ease",
              }}
              onMouseEnter={e => { if (!active)(e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)" }}
              onMouseLeave={e => { if (!active)(e.currentTarget as HTMLElement).style.background = "transparent" }}
            >
              <span style={{ fontSize: "1rem", color: active ? "var(--orange)" : "rgba(255,255,255,0.7)", width: "18px", textAlign: "center", flexShrink: 0 }}>
                {item.icon}
              </span>
              <div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: active ? 700 : 500, fontSize: "0.85rem", color: active ? "var(--white)" : "rgba(255,255,255,0.75)" }}>
                  {item.label}
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: active ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {item.desc}
                </div>
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Compteur tokens */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
            Tokens utilisés
          </span>
          {stats.calls > 0 && (
            <button
              onClick={resetTokens}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 9, color: "rgba(255,255,255,0.25)", padding: 0, fontFamily: "'IBM Plex Mono', monospace" }}
              title="Remettre à zéro"
            >
              reset
            </button>
          )}
        </div>

        {stats.calls === 0 ? (
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "'IBM Plex Mono', monospace" }}>
            Aucun appel encore
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: "rgba(255,255,255,0.5)" }}>
                In
              </span>
              <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: "var(--turquoise)", fontWeight: 600 }}>
                {formatTokens(stats.input)}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: "rgba(255,255,255,0.5)" }}>
                Out
              </span>
              <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: "var(--turquoise)", fontWeight: 600 }}>
                {formatTokens(stats.output)}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: "rgba(255,255,255,0.5)" }}>
                Appels
              </span>
              <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: "rgba(255,255,255,0.6)" }}>
                {stats.calls}
              </span>
            </div>
            <div style={{ marginTop: 6, padding: "4px 8px", background: "rgba(232,99,10,0.15)", border: "1px solid rgba(232,99,10,0.3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: "rgba(255,255,255,0.4)" }}>
                  Coût estimé
                </span>
                <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: "var(--orange)", fontWeight: 700 }}>
                  {estimateCost(stats.input, stats.output)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "1rem 1.25rem" }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", lineHeight: 1.7 }}>
          Powered by<br />
          <span style={{ color: "var(--orange)", fontWeight: 600 }}>Anthropic Claude</span>
        </div>
      </div>

    </aside>
  )
}