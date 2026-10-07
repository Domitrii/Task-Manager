import { RefreshCw } from 'lucide-react'
import { describeStatus, useSync } from '@/features/account/sync'
import { Menu, MenuDivider, MenuItem } from '@/components/ui/Menu'

/**
 * Where the records on this device stand. Neutral on purpose: status colours
 * are kept for compliance, and an offline device is working as intended.
 */
export function SyncIndicator() {
  const sync = useSync()
  if (!sync) return null

  const view = describeStatus(sync.status)
  const Icon = view.icon
  const { pending } = sync.status

  return (
    <Menu
      width="w-72"
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label={`${view.title}. Sync details`}
          className="text-ink-muted hover:bg-surface-muted hover:text-ink flex h-9 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium transition-colors"
        >
          <Icon className="size-4.5" />
          {pending > 0 ? <span className="tabular">{pending}</span> : null}
          <span className="hidden xl:inline">{view.label}</span>
        </button>
      )}
    >
      {({ close }) => (
        <>
          <div className="px-3 pt-2.5 pb-2">
            <p className="text-ink text-sm font-semibold">{view.title}</p>
            <p className="text-ink-muted mt-0.5 text-xs">{view.detail}</p>
          </div>
          <MenuDivider />
          <MenuItem
            icon={<RefreshCw className="size-4" />}
            description={sync.email}
            onClick={() => {
              sync.syncNow()
              close()
            }}
          >
            Sync now
          </MenuItem>
        </>
      )}
    </Menu>
  )
}
