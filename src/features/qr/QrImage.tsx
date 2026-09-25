import { useMemo } from 'react'
import { create } from 'qrcode'

/** Dark modules as one path, a run of neighbours per segment, so it stays small and crisp. */
function qrPath(value: string, quietZone: number): { d: string; size: number } {
  const { size, data } = create(value, { errorCorrectionLevel: 'M' }).modules
  let d = ''
  for (let y = 0; y < size; y += 1) {
    let x = 0
    while (x < size) {
      if (!data[y * size + x]) {
        x += 1
        continue
      }
      const start = x
      while (x < size && data[y * size + x]) x += 1
      d += `M${start + quietZone} ${y + quietZone}h${x - start}v1h${start - x}z`
    }
  }
  return { d, size: size + quietZone * 2 }
}

/**
 * A QR code drawn in the browser. Always black on white, including in dark
 * mode: phone cameras read that most reliably.
 */
export function QrImage({
  value,
  label,
  quietZone = 4,
  className,
}: {
  value: string
  /** Accessible name, e.g. "QR code for Fridge 1". */
  label: string
  /** Blank modules around the code. Less is fine when it sits on white paper. */
  quietZone?: number
  className?: string
}) {
  const { d, size } = useMemo(() => qrPath(value, quietZone), [value, quietZone])
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={size} height={size} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  )
}
