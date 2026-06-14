"use client"

import { useState } from "react"

interface MarkdownViewProps {
  content:   string
  label?:    string
  maxHeight?: string
}

export default function MarkdownView({
  content,
  label     = "Contenu",
  maxHeight = "420px",
}: MarkdownViewProps) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="animate-in"
      style={{
        border:      "1.5px solid var(--border-col)",
        boxShadow:   "var(--shadow)",
        background:  "var(--bg-surface)",
        overflow:    "hidden",
      }}
    >
      {/* Header */}
      <div style={{
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "space-between",
        padding:         "0.6rem 1rem",
        borderBottom:    "1px solid var(--border-col)",
        background:      "var(--bg-raised)",
      }}>
        <span style={{
          fontFamily:    "'IBM Plex Mono', monospace",
          fontSize:      "0.7rem",
          color:         "var(--turquoise)",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
        }}>
          ▸ {label}
        </span>

        <button
          onClick={copy}
          style={{
            fontFamily:  "'IBM Plex Mono', monospace",
            fontSize:    "0.68rem",
            color:       copied ? "var(--turquoise)" : "var(--fg-dim)",
            background:  "transparent",
            border:      `1px solid ${copied ? "var(--turquoise)" : "var(--border-col)"}`,
            padding:     "0.2rem 0.6rem",
            cursor:      "pointer",
            transition:  "all 0.15s ease",
          }}
          onMouseEnter={e => {
            if (!copied) {
              const el = e.currentTarget as HTMLElement
              el.style.color       = "var(--fg)"
              el.style.borderColor = "var(--fg-muted)"
            }
          }}
          onMouseLeave={e => {
            if (!copied) {
              const el = e.currentTarget as HTMLElement
              el.style.color       = "var(--fg-dim)"
              el.style.borderColor = "var(--border-col)"
            }
          }}
        >
          {copied ? "✓ Copié" : "Copier"}
        </button>
      </div>

      {/* Contenu */}
      <pre style={{
        padding:    "1.25rem",
        fontSize:   "0.82rem",
        fontFamily: "'IBM Plex Mono', monospace",
        color:      "var(--fg)",
        whiteSpace: "pre-wrap",
        lineHeight: 1.75,
        maxHeight,
        overflowY:  "auto",
        background: "var(--bg-input)",
      }}>
        {content}
      </pre>
    </div>
  )
}
