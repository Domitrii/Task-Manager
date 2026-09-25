import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { MonitoredItem } from '@/data/types'
import { formatRange } from '@/lib/compliance'
import { QrImage } from './QrImage'
import { scanUrl } from './scanUrl'

/**
 * One sticker, at its printed size: 60 × 66 mm fits three across and four down
 * on A4 with a 10 mm margin. Colours are fixed so it prints the same in dark mode.
 */
export function QrLabel({ item, venueName }: { item: MonitoredItem; venueName: string }) {
  return (
    <div className="flex h-[66mm] w-[60mm] shrink-0 break-inside-avoid flex-col items-center rounded-[2mm] border border-dashed border-[#9aa5b1] bg-white px-[3.5mm] py-[3mm] text-center text-black">
      <p className="w-full truncate text-[6.5pt] font-semibold tracking-[0.08em] text-[#4a5561] uppercase">
        {venueName || 'Mise'}
      </p>
      <QrImage
        value={scanUrl(item.id)}
        label={`QR code for ${item.name}`}
        quietZone={1}
        className="mt-[1.5mm] size-[34mm] shrink-0"
      />
      <p className="mt-[1.5mm] line-clamp-2 w-full text-[11pt] leading-[1.15] font-bold">{item.name}</p>
      <p className="mt-[0.8mm] w-full truncate text-[7.5pt] text-[#303a45]">
        {item.location} · {formatRange(item)}
      </p>
      <p className="mt-auto w-full text-[6.5pt] text-[#4a5561]">Scan with your phone camera to log a reading</p>
    </div>
  )
}

export function LabelGrid({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-[2mm]">{children}</div>
}

/**
 * The only thing that prints. It sits outside the app root, and the print
 * styles in `index.css` hide everything else while one is on the page, so the
 * browser's Print prints just the labels.
 */
export function PrintSheet({ children }: { children: ReactNode }) {
  return createPortal(<div className="print-sheet">{children}</div>, document.body)
}
