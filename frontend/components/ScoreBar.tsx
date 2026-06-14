"use client"

import { useEffect, useState, useRef } from "react"

interface ScoreBarProps {
  score:      number
  label?:     string
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

function useCountUp(target: number, duration = 900): number {
  const [current, setCurrent] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const start     = performance.now()
    const startVal  = 0

    function tick(now: number) {
      const elapsed  = now - start
      const progress = Math.min(elapsed / duration, 1)
      // Easing out cubic
      const eased    = 1 - Math.pow(1 - progress, 3)
      setCurrent(Math.round(startVal + (target - startVal) * eased))
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
    }

    // Délai court pour laisser le composant se monter
    const timeout = setTimeout(() => {
      rafRef.current = requestAnimationFrame(tick)
    }, 120)

    return () => {
      clearTimeout(timeout)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [target, duration])

  return current
}

export default function ScoreBar({ score, label, showValue = true }: ScoreBarProps) {
  const [barWidth, setBarWidth] = useState(0)
  const displayScore = useCountUp(score)
  const color = getColor(score)

  useEffect(() => {
    const t = setTimeout(() => setBarWidth(score), 80)
    return () => clearTimeout(t)
  }, [score])

  const milestones = [50, 70, 90]

  return (
    <div style={{ width: "100%" }} className="animate-in">

      {/* Header */}
      <div style={{
        display:        "flex",
        justifyContent: "space-between",
        alignItems:     "center",
        marginBottom:   "0.75rem",
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
            fontFamily:  "'Space Grotesk', sans-serif",
            fontWeight:  700,
            fontSize:    "1.8rem",
            color,
            lineHeight:  1,
            border:      "2px solid var(--black)",
            boxShadow:   "3px 3px 0px var(--black)",
            padding:     "0.1rem 0.6rem",
            minWidth:    "4rem",
            textAlign:   "center",
            transition:  "color 0.3s ease",
          }}>
            {displayScore}
            <span style={{ fontSize: "0.9rem", color: "var(--gray-400)" }}>/100</span>
          </span>
        )}
      </div>

      {/* Barre avec jalons */}
      <div style={{ position: "relative" }}>
        <div style={{
          width:      "100%",
          height:     "14px",
          background: "var(--gray-200)",
          border:     "2px solid var(--black)",
          overflow:   "hidden",
          position:   "relative",
        }}>
          <div style={{
            height:     "100%",
            width:      `${barWidth}%`,
            background: color,
            transition: "width 1s cubic-bezier(0.34, 1.1, 0.64, 1)",
            borderRight: barWidth < 100 ? "2px solid var(--black)" : "none",
          }} />
        </div>

        {/* Jalons 50 / 70 / 90 */}
        {milestones.map(m => (
          <div key={m} style={{
            position:  "absolute",
            top:       "-4px",
            left:      `${m}%`,
            width:     "2px",
            height:    "22px",
            background: score >= m ? "rgba(255,255,255,0.5)" : "var(--gray-400)",
            transition: "background 0.5s ease",
          }} />
        ))}
      </div>

      {/* Légende jalons */}
      <div style={{
        display:        "flex",
        justifyContent: "space-between",
        marginTop:      "0.35rem",
        padding:        "0 0",
      }}>
        {[
          { pos: "0%",   label: "0"   },
          { pos: "50%",  label: "50"  },
          { pos: "70%",  label: "70"  },
          { pos: "90%",  label: "90"  },
          { pos: "100%", label: "100" },
        ].map(({ pos, label: l }) => (
          <span key={l} style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize:   "0.6rem",
            color:      "var(--gray-400)",
            position:   "absolute",
            left:       pos,
            transform:  "translateX(-50%)",
          }}>
            {l}
          </span>
        ))}
      </div>
      <div style={{ height: "1rem" }} />

    </div>
  )
}
