interface SkeletonProps {
  variant?: "text" | "title" | "block" | "score" | "badge"
  width?:   string
  height?:  string
  count?:   number
}

function SkeletonItem({ variant = "text", width, height }: Omit<SkeletonProps, "count">) {
  const base = "skeleton"

  const variantClass = {
    text:  "skeleton-text",
    title: "skeleton-title",
    block: "skeleton-block",
    score: "skeleton-score",
    badge: "",
  }[variant]

  const inlineStyle: React.CSSProperties = {
    ...(width  ? { width }  : {}),
    ...(height ? { height } : {}),
    ...(variant === "badge" ? { height: "24px", width: "64px", display: "inline-block" } : {}),
  }

  return <div className={`${base} ${variantClass}`} style={inlineStyle} />
}

export default function Skeleton({ count = 1, ...props }: SkeletonProps) {
  if (count === 1) return <SkeletonItem {...props} />
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonItem key={i} {...props} />
      ))}
    </>
  )
}

/* ─── Preset : carte de candidature ─────────────────────────────────────── */
export function SkeletonCard() {
  return (
    <div style={{
      border:    "2px solid var(--black)",
      boxShadow: "4px 4px 0px var(--black)",
      padding:   "1.25rem",
      display:   "flex",
      flexDirection: "column",
      gap: "0.75rem",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Skeleton variant="title" width="45%" />
        <Skeleton variant="score" />
      </div>
      <Skeleton variant="text" width="70%" />
      <Skeleton variant="text" width="50%" />
    </div>
  )
}

/* ─── Preset : ligne de stat RAG ────────────────────────────────────────── */
export function SkeletonStatRow() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Skeleton variant="text" width="30%" />
        <Skeleton variant="badge" />
      </div>
      <Skeleton variant="text" height="6px" />
    </div>
  )
}

/* ─── Preset : badges keywords ──────────────────────────────────────────── */
export function SkeletonBadges({ count = 6 }: { count?: number }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="badge" width={`${48 + (i % 3) * 20}px`} />
      ))}
    </div>
  )
}
