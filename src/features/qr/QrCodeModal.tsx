import { ExternalLink, Printer } from 'lucide-react'
import { useStore } from '@/data/store'
import type { MonitoredItem } from '@/data/types'
import { formatRange } from '@/lib/compliance'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { QrImage } from './QrImage'
import { LabelGrid, PrintSheet, QrLabel } from './QrLabel'
import { scanUrl } from './scanUrl'

/** One item's code, big enough to scan off the screen, with its label ready to print. */
export function QrCodeModal({ item, onClose }: { item: MonitoredItem; onClose: () => void }) {
  const { data } = useStore()
  const url = scanUrl(item.id)

  return (
    <Modal
      open
      onClose={onClose}
      title={item.name}
      description={`${item.location} · Safe range ${formatRange(item)}`}
      size="sm"
      footer={
        <>
          <ButtonLink to={`/scan/${encodeURIComponent(item.id)}`} className="gap-1.5">
            <ExternalLink className="size-4" />
            Open logging page
          </ButtonLink>
          <Button variant="primary" onClick={() => window.print()} className="gap-1.5">
            <Printer className="size-4" />
            Print label
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-3">
        <div className="border-line rounded-2xl border bg-white p-2">
          <QrImage value={url} label={`QR code for ${item.name}`} quietZone={2} className="size-56" />
        </div>
        <p className="text-ink-muted font-mono text-xs break-all">{url}</p>
        <p className="text-ink-muted text-center text-[13px]">
          Scanning opens a page for logging {item.name}. For now it only works on the device that holds
          this venue’s records.
        </p>
      </div>

      <PrintSheet>
        <LabelGrid>
          <QrLabel item={item} venueName={data.settings.venueName} />
        </LabelGrid>
      </PrintSheet>
    </Modal>
  )
}
