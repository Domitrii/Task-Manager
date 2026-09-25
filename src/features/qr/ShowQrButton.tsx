import { Suspense, lazy, useState } from 'react'
import { QrCode } from 'lucide-react'
import type { MonitoredItem } from '@/data/types'
import { IconButton } from '@/components/ui/Button'

// The QR encoder only loads once someone asks to see a code.
const QrCodeModal = lazy(async () => ({ default: (await import('./QrCodeModal')).QrCodeModal }))

/** The "Show QR" action on any list of monitored items. */
export function ShowQrButton({ item }: { item: MonitoredItem }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <IconButton label={`Show QR for ${item.name}`} size="sm" onClick={() => setOpen(true)}>
        <QrCode className="size-4" />
      </IconButton>
      {open ? (
        <Suspense fallback={null}>
          <QrCodeModal item={item} onClose={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </>
  )
}
