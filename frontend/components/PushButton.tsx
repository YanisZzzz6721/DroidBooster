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
    background:   "var(--orange)",
    color:        "var(--white)",
    shadow:       "4px 4px 0px var(--black)",
    shadowHover:  "6px 6px 0px var(--black)",
    hoverBg:      "var(--orange)",
    hoverColor:   "var(--white)",
    border:       "2px solid var(--black)",
  },
  secondary: {
    background:   "var(--white)",
    color:        "var(--black)",
    shadow:       "4px 4px 0px var(--black)",
    shadowHover:  "6px 6px 0px var(--black)",
    hoverBg:      "var(--turquoise)",
    hoverColor:   "var(--white)",
    border:       "2px solid var(--black)",
  },
  danger: {
    background:   "var(--white)",
    color:        "#c0392b",
    shadow:       "4px 4px 0px #c0392b",
    shadowHover:  "6px 6px 0px #c0392b",
    hoverBg:      "#c0392b",
    hoverColor:   "var(--white)",
    border:       "2px solid #c0392b",
  },
}

const SIZES = {
  sm: { padding: "0.4rem 1rem",    fontSize: "0.78rem", spinnerSize: "14px" },
  md: { padding: "0.65rem 1.5rem", fontSize: "0.88rem", spinnerSize: "16px" },
  lg: { padding: "0.85rem 2rem",   fontSize: "1rem",    spinnerSize: "18px" },
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
      el.style.background = success ? "var(--turquoise)" : v.background
      el.style.color      = success ? "var(--white)"     : v.color
    }
    onMouseLeave?.(e)
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isDisabled) {
      const el = e.currentTarget
      el.style.transform = "translate(4px, 4px)"
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

  const bgColor  = success ? "var(--turquoise)" : v.background
  const txtColor = success ? "var(--white)"     : v.color

  return (
    <button
      disabled={isDisabled}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      style={{
        background:     bgColor,
        color:          txtColor,
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
        opacity:        disabled ? 0.5 : 1,
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
        <span className="animate-bounce-in">✓ OK</span>
      ) : (
        children
      )}
    </button>
  )
}
