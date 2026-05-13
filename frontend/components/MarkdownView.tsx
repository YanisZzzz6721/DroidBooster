"use client"

import { useState } from "react"

interface MarkdownViewProps {
  content:  string
  label?:   string
  maxHeight?: string
}

export default function MarkdownView({
  content,
  label    = "Contenu",
  maxHeight = "420px",
}: MarkdownViewProps) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{
      border:    "2px solid var(--black)",
      boxShadow: "4px 4px 0px var(--black)",
      background:"var(--white)",
    }}>

      {/* Header */}
      <div style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        padding:        "0.6rem 1rem",
        borderBottom:   "2px solid var(--black)",
        background:     "var(--black)",
      }}>
        <span style={{
          fontFamily:    "'IBM Plex Mono', monospace",
          fontSize:      "0.72rem",
          color:         "var(--turquoise)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}>
          ▸ {label}
        </span>

        <button
          onClick={copy}
          style={{
            fontFamily:  "'IBM Plex Mono', monospace",
            fontSize:    "0.7rem",
            color:       copied ? "var(--turquoise)" : "#666",
            background:  "transparent",
            border:      `1px solid ${copied ? "var(--turquoise)" : "#333"}`,
            padding:     "0.2rem 0.6rem",
            cursor:      "pointer",
            transition:  "all 0.1s ease",
          }}
          onMouseEnter={e => {
            if (!copied) {
              (e.currentTarget as HTMLElement).style.color = "var(--white)"
              ;(e.currentTarget as HTMLElement).style.borderColor = "var(--white)"
            }
          }}
          onMouseLeave={e => {
            if (!copied) {
              (e.currentTarget as HTMLElement).style.color = "#666"
              ;(e.currentTarget as HTMLElement).style.borderColor = "#333"
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
        color:      "var(--black)",
        whiteSpace: "pre-wrap",
        lineHeight: 1.7,
        maxHeight,
        overflowY:  "auto",
        background: "#FAFAF8",
      }}>
        {content}
      </pre>

    </div>
  )
}