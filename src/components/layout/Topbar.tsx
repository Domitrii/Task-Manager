import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { Check, ChevronDown, Menu as MenuIcon, Moon, Plus, Search, Sun, Thermometer, Package } from 'lucide-react'
import { ALL_NAV_ITEMS } from '@/config/navigation'
import { useStore } from '@/data/store'
import { Avatar } from '@/components/ui/Avatar'
import { Button, IconButton } from '@/components/ui/Button'
import { Menu, MenuDivider, MenuItem, MenuLabel } from '@/components/ui/Menu'
import { titleCase } from '@/lib/utils'

export function Topbar({
  onOpenNav,
  onOpenSearch,
  onRecordTemperature,
  onRecordDelivery,
  theme,
  onToggleTheme,
}: {
  onOpenNav: () => void
  onOpenSearch: () => void
  onRecordTemperature: () => void
  onRecordDelivery: () => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}) {
  const location = useLocation()
  const { data, activeStaff, setActiveStaffId } = useStore()

  const pageTitle = useMemo(() => {
    const matches = ALL_NAV_ITEMS.filter((item) =>
      item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to),
    )
    return matches.sort((a, b) => b.to.length - a.to.length)[0]?.label ?? 'Mise'
  }, [location.pathname])

  const activeStaffList = data.staff.filter((person) => person.active)

  return (
    <header className="bg-surface/85 border-line sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b px-3 backdrop-blur-md sm:px-5">
      <IconButton label="Open navigation" onClick={onOpenNav} className="lg:hidden">
        <MenuIcon className="size-5" />
      </IconButton>

      <div className="min-w-0 flex-1">
        <p className="text-ink truncate text-[15px] font-semibold lg:hidden">{pageTitle}</p>
        <button
          type="button"
          onClick={onOpenSearch}
          className="text-ink-subtle border-line-default bg-surface-muted/60 hover:border-line-strong hidden h-9 w-full max-w-xs items-center gap-2 rounded-lg border px-3 text-sm transition-colors lg:flex"
        >
          <Search className="size-4" />
          <span>Search</span>
          <kbd className="border-line-default text-ink-subtle ml-auto rounded border px-1.5 py-0.5 font-sans text-[10px] font-medium">
            ⌘K
          </kbd>
        </button>
      </div>

      <Menu
        width="w-60"
        trigger={({ toggle }) => (
          <Button variant="primary" size="sm" onClick={toggle} className="gap-1.5">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Record</span>
            <ChevronDown className="size-3.5 opacity-70" />
          </Button>
        )}
      >
        {({ close }) => (
          <>
            <MenuLabel>Quick entry</MenuLabel>
            <MenuItem
              icon={<Thermometer className="size-4" />}
              description="Fridge, freezer, cooking or hot holding"
              onClick={() => {
                close()
                onRecordTemperature()
              }}
            >
              Temperature check
            </MenuItem>
            <MenuItem
              icon={<Package className="size-4" />}
              description="Goods in, with temperatures and dates"
              onClick={() => {
                close()
                onRecordDelivery()
              }}
            >
              Delivery
            </MenuItem>
          </>
        )}
      </Menu>

      <IconButton
        label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        onClick={onToggleTheme}
        className="hidden sm:inline-flex"
      >
        {theme === 'dark' ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
      </IconButton>

      <Menu
        width="w-64"
        trigger={({ toggle }) => (
          <button
            type="button"
            onClick={toggle}
            className="hover:bg-surface-muted flex items-center gap-2 rounded-lg p-1 pr-2 transition-colors"
          >
            <Avatar person={activeStaff} size="sm" />
            <span className="hidden text-left leading-tight sm:block">
              <span className="text-ink block text-[13px] font-medium">{activeStaff.name}</span>
              <span className="text-ink-muted block text-[11px]">{titleCase(activeStaff.role)}</span>
            </span>
            <ChevronDown className="text-ink-subtle size-3.5" />
          </button>
        )}
      >
        {({ close }) => (
          <>
            <MenuLabel>Signed in as</MenuLabel>
            {activeStaffList.map((person) => (
              <MenuItem
                key={person.id}
                icon={<Avatar person={person} size="xs" />}
                onClick={() => {
                  setActiveStaffId(person.id)
                  close()
                }}
                description={titleCase(person.role)}
              >
                <span className="flex items-center gap-2">
                  {person.name}
                  {person.id === activeStaff.id ? <Check className="text-brand-600 size-3.5" /> : null}
                </span>
              </MenuItem>
            ))}
            <MenuDivider />
            <MenuItem
              icon={theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
              onClick={() => {
                onToggleTheme()
                close()
              }}
            >
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </MenuItem>
          </>
        )}
      </Menu>
    </header>
  )
}
