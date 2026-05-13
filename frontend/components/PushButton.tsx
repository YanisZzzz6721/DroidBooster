"use client"

import { ButtonHTMLAttributes } from "react"

interface PushButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  "primary" | "secondary" | "danger"
  size?:     "sm" | "md" | "lg"
  loading?:  boolean
  fullWidth?: boolean
}

const VARIANTS = {
  primary: {
    background: "var(--orange)",
    color:      "var(--white)",
    shadow:     "4px 4px 0px var(--black)",
    hoverBg:    "var(--orange-dark)",
  },
  secondary: {
    background: "var(--white)",
    color:      "var(--black)",
    shadow:     "4px 4px 0px var(--black)",
    hoverBg:    "var(--turquoise)",
  },
  danger: {
    background: "var(--white)",
    color:      "#c0392b",
    shadow:     "4px 4px 0px #c0392b",
    hoverBg:    "#c0392b",
  },
}

const SIZES = {
  sm: { padding: "0.4rem 1rem",   fontSize: "0.78rem" },
  md: { padding: "0.65rem 1.5rem", fontSize: "0.88rem" },
  lg: { padding: "0.85rem 2rem",   fontSize: "1rem"    },
}

export default function PushButton({
  variant  = "primary",
  size     = "md",
  loading  = false,
  fullWidth = false,
  children,
  disabled,
  style,
  onMouseEnter,
  onMouseLeave,
  onMouseDown,
  onMouseUp,
  ...props
}: PushButtonProps) {
  const v = VARIANTS[variant]
  const s = SIZES[size]

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled && !loading) {
      const el = e.currentTarget
      el.style.transform   = "translate(-2px, -2px)"
      el.style.boxShadow   = "6px 6px 0px var(--black)"
      if (variant === "secondary") el.style.background = v.hoverBg
      if (variant === "secondary") el.style.color = "var(--white)"
      if (variant === "danger") {
        el.style.background = v.hoverBg
        el.style.color = "var(--white)"
      }
    }
    onMouseEnter?.(e)
  }

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled && !loading) {
      const el = e.currentTarget
      el.style.transform   = "translate(0, 0)"
      el.style.boxShadow   = v.shadow
      el.style.background  = v.background
      el.style.color       = v.color
    }
    onMouseLeave?.(e)
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled && !loading) {
      const el = e.currentTarget
      el.style.transform = "translate(4px, 4px)"
      el.style.boxShadow = "none"
    }
    onMouseDown?.(e)
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled && !loading) {
      const el = e.currentTarget
      el.style.transform = "translate(0, 0)"
      el.style.boxShadow = v.shadow
    }
    onMouseUp?.(e)
  }

  return (
    <button
      disabled={disabled || loading}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      style={{
        background:    v.background,
        color:         v.color,
        border:        "2px solid var(--black)",
        boxShadow:     v.shadow,
        fontFamily:    "'Space Grotesk', sans-serif",
        fontWeight:    600,
        fontSize:      s.fontSize,
        padding:       s.padding,
        cursor:        disabled || loading ? "not-allowed" : "pointer",
        borderRadius:  0,
        letterSpacing: "0.01em",
        display:       "inline-flex",
        alignItems:    "center",
        justifyContent:"center",
        gap:           "0.5rem",
        width:         fullWidth ? "100%" : "auto",
        transition:    "background 0.08s ease, color 0.08s ease",
        opacity:       disabled || loading ? 0.5 : 1,
        userSelect:    "none",
        ...style,
      }}
      {...props}
    >
      {loading ? (
        <>
          <span className="loading-dot">●</span>
          <span className="loading-dot" style={{ animationDelay: "0.2s" }}>●</span>
          <span className="loading-dot" style={{ animationDelay: "0.4s" }}>●</span>
        </>
      ) : children}
    </button>
  )
}