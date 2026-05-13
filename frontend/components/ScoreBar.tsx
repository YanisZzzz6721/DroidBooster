"use client"

import { useEffect, useState } from "react"

interface ScoreBarProps {
  score:     number
  label?:    string
  showValue?: boolean
}

function getColor(score: number): string {
  if (score >= 70) return "var(--turquoise)"
  if (score >= 50) return "var(--orange)"
  return "#c0392b"
}

function getLabel(score: number): string {
  if (score >= 90) return "Excellent"
  if (score >= 70) return "Bon match"
  if (score >= 50) return "Match partiel"
  return "Match faible"
}

export default function ScoreBar({ score, label, showValue = true }: ScoreBarProps) {
  const [width, setWidth] = useState(0)
  const color = getColor(score)

  useEffect(() => {
    const t = setTimeout(() => setWidth(score), 100)
    return () => clearTimeout(t)
  }, [score])

  return (
    <div style={{ width: "100%" }}>

      {/* Header */}
      <div style={{
        display:        "flex",
        justifyContent: "space-between",
        alignItems:     "baseline",
        marginBottom:   "0.5rem",
      }}>
        <span style={{
          fontFamily:    "'Space Grotesk', sans-serif",
          fontWeight:    700,
          fontSize:      "0.75rem",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color:         "var(--gray-600)",
        }}>
          {label ?? getLabel(score)}
        </span>

        {showValue && (
          <span style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize:   "1.8rem",
            color,
            lineHeight: 1,
            border:     "2px solid var(--black)",
            boxShadow:  "3px 3px 0px var(--black)",
            padding:    "0.1rem 0.6rem",
          }}>
            {score}<span style={{ fontSize: "0.9rem", color: "var(--gray-400)" }}>/100</span>
          </span>
        )}
      </div>

      {/* Barre */}
      <div style={{
        width:      "100%",
        height:     "12px",
        background: "var(--gray-200)",
        border:     "2px solid var(--black)",
        overflow:   "hidden",
      }}>
        <div style={{
          height:     "100%",
          width:      `${width}%`,
          background: color,
          transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
          borderRight: width < 100 ? "2px solid var(--black)" : "none",
        }} />
      </div>

    </div>
  )
}