"use client"

import { useToast } from "@/lib/toast"

const COLORS = {
  success: { bg: "#edfafa", border: "var(--turquoise)", icon: "✓", color: "var(--turquoise)" },
  error:   { bg: "#fff0f0", border: "#c0392b",          icon: "✗", color: "#c0392b"          },
  info:    { bg: "#fff8f4", border: "var(--orange)",    icon: "◎", color: "var(--orange)"    },
}

export default function Toasts() {
  const { toasts, remove } = useToast()

  if (toasts.length === 0) return null

  return (
    <div style={{
      position:      "fixed",
      bottom:        24,
      right:         24,
      zIndex:        9999,
      display:       "flex",
      flexDirection: "column",
      gap:           10,
      pointerEvents: "none",
    }}>
      {toasts.map(toast => {
        const c = COLORS[toast.type]
        return (
          <div
            key={toast.id}
            style={{
              background:  c.bg,
              border:      `2px solid ${c.border}`,
              boxShadow:   `4px 4px 0 ${c.border}`,
              padding:     "12px 16px",
              display:     "flex",
              alignItems:  "center",
              gap:         10,
              minWidth:    260,
              maxWidth:    360,
              pointerEvents: "all",
              animation:   "slideIn 0.15s ease",
            }}
          >
            <span style={{ fontSize: 16, color: c.color, fontWeight: 700, flexShrink: 0 }}>
              {c.icon}
            </span>
            <span style={{ fontSize: 13, color: "var(--black)", flex: 1, fontFamily: "'Space Grotesk', sans-serif" }}>
              {toast.message}
            </span>
            <button
              onClick={() => remove(toast.id)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray-text)", fontSize: 14, padding: 0, flexShrink: 0 }}
            >
              x
            </button>
          </div>
        )
      })}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>
    </div>
  )
}