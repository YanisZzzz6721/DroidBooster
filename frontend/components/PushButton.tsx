"use client"

import { ButtonHTMLAttributes } from "react"

interface PushButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:   "primary" | "secondary" | "danger"
  size?:      "sm" | "md" | "lg"
  loading?:   boolean
  success?:   boolean
  fullWidth?: boolean
}

const VARIANTS = {
  primary: {
    bg:          "var(--orange)",
    color:       "#fff",
    shadow:      "4px 4px 0px var(--shadow-col)",
    shadowHover: "4px 4px 0px var(--orange)",
    border:      "1.5px solid var(--orange)",
    hoverBg:     "var(--orange-dark)",
    hoverColor:  "#fff",
  },
  secondary: {
    bg:          "var(--bg-raised)",
    color:       "var(--fg)",
    shadow:      "4px 4px 0px var(--shadow-col)",
    shadowHover: "4px 4px 0px var(--turquoise)",
    border:      "1.5px solid var(--border-col)",
    hoverBg:     "var(--turquoise)",
    hoverColor:  "#fff",
  },
  danger: {
    bg:          "var(--bg-raised)",
    color:       "#e05252",
    shadow:      "4px 4px 0px var(--shadow-col)",
    shadowHover: "4px 4px 0px #e05252",
    border:      "1.5px solid #e05252",
    hoverBg:     "#e05252",
    hoverColor:  "#fff",
  },
}

const SIZES = {
  sm: { padding: "0.4rem 1rem",    fontSize: "0.76rem", spinnerSize: "13px" },
  md: { padding: "0.65rem 1.5rem", fontSize: "0.88rem", spinnerSize: "15px" },
  lg: { padding: "0.85rem 2rem",   fontSize: "0.95rem", spinnerSize: "17px" },
}

export default function PushButton({
  variant   = "primary",
  size      = "md",
  loading   = false,
  success   = false,
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
  const isDisabled = disabled || loading

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isDisabled) {
      const el = e.currentTarget
      el.style.transform   = "translate(-2px, -2px)"
      el.style.boxShadow   = v.shadowHover
      el.style.background  = v.hoverBg
      el.style.color       = v.hoverColor
    }
    onMouseEnter?.(e)
  }

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isDisabled) {
      const el = e.currentTarget
      el.style.transform  = "translate(0, 0)"
      el.style.boxShadow  = v.shadow
      el.style.background = success ? "var(--turquoise)" : v.bg
      el.style.color      = success ? "#fff" : v.color
    }
    onMouseLeave?.(e)
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isDisabled) {
      const el = e.currentTarget
      el.style.transform = "translate(3px, 3px)"
      el.style.boxShadow = "none"
    }
    onMouseDown?.(e)
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isDisabled) {
      const el = e.currentTarget
      el.style.transform = "translate(0, 0)"
      el.style.boxShadow = v.shadow
    }
    onMouseUp?.(e)
  }

  return (
    <button
      disabled={isDisabled}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      style={{
        background:     success ? "var(--turquoise)" : v.bg,
        color:          success ? "#fff" : v.color,
        border:         v.border,
        boxShadow:      v.shadow,
        fontFamily:     "'Space Grotesk', sans-serif",
        fontWeight:     600,
        fontSize:       s.fontSize,
        padding:        s.padding,
        cursor:         isDisabled ? "not-allowed" : "pointer",
        borderRadius:   0,
        letterSpacing:  "0.01em",
        display:        "inline-flex",
        alignItems:     "center",
        justifyContent: "center",
        gap:            "0.5rem",
        width:          fullWidth ? "100%" : "auto",
        transition:     "background 80ms ease, color 80ms ease, box-shadow 80ms ease, transform 80ms ease",
        opacity:        disabled ? 0.4 : 1,
        userSelect:     "none",
        ...style,
      }}
      {...props}
    >
      {loading ? (
        <span
          className={variant === "primary" ? "spinner" : "spinner spinner-dark"}
          style={{ width: s.spinnerSize, height: s.spinnerSize }}
        />
      ) : success ? (
        <span className="animate-bounce-in">✓</span>
      ) : children}
    </button>
  )
}
