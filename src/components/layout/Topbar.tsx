import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Check, ChevronDown, Moon, Plus, Search, Sun } from 'lucide-react'
import { ALL_NAV_ITEMS } from '@/config/navigation'
import { useStore } from '@/data/store'
import { useTheme } from '@/lib/theme'
import { titleCase } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Menu, MenuDivider, MenuItem, MenuLabel } from '@/components/ui/Menu'
import { LogoMark } from './Logo'

export function Topbar({ onOpenSearch, onOpenLog }: { onOpenSearch: () => void; onOpenLog: () => void }) {
  const location = useLocation()
  const { data, activeStaff, setActiveStaffId } = useStore()
  const { theme, toggle } = useTheme()

  const pageTitle = useMemo(() => {
    const matches = ALL_NAV_ITEMS.filter((item) =>
      item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to),
    )
    return matches.sort((a, b) => b.to.length - a.to.length)[0]?.label ?? 'Mise'
  }, [location.pathname])

  const activeStaffList = data.staff.filter((person) => person.active)

  return (
    <header className="bg-app/85 sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 px-4 backdrop-blur-md sm:px-6 lg:h-16 lg:px-8">
      {/* Phones: where am I. Desktop: find anything. */}
      <Link to="/" className="lg:hidden" aria-label="Today">
        <LogoMark className="size-7" />
      </Link>
      <p className="text-ink min-w-0 flex-1 truncate text-[17px] font-bold lg:hidden">{pageTitle}</p>

      <div className="hidden flex-1 lg:block">
        <button
          type="button"
          onClick={onOpenSearch}
          className="text-ink-muted border-line-default bg-surface hover:border-line-strong flex h-10 w-full max-w-sm items-center gap-2.5 rounded-lg border px-3 text-sm transition-colors"
        >
          <Search className="size-4" />
          <span>Search equipment, pages or actions</span>
          <kbd className="border-line-default text-ink-subtle ml-auto rounded border px-1.5 py-0.5 font-sans text-[11px] font-medium">
            ⌘K
          </kbd>
        </button>
      </div>

      <Button variant="primary" onClick={onOpenLog} className="hidden gap-1.5 pr-5 lg:inline-flex">
        <Plus className="size-4.5" strokeWidth={2.5} />
        Log
      </Button>

      <Menu
        width="w-64"
        trigger={({ toggle: toggleMenu }) => (
          <button
            type="button"
            onClick={toggleMenu}
            aria-label={`Signed in as ${activeStaff.name}. Switch person`}
            className="hover:bg-surface-muted flex items-center gap-2 rounded-full p-1 transition-colors lg:rounded-lg lg:pr-2"
          >
            <Avatar person={activeStaff} size="sm" />
            <span className="hidden text-left leading-tight lg:block">
              <span className="text-ink block text-[13px] font-semibold">{activeStaff.name}</span>
              <span className="text-ink-muted block text-xs">{titleCase(activeStaff.role)}</span>
            </span>
            <ChevronDown className="text-ink-subtle hidden size-3.5 lg:block" />
          </button>
        )}
      >
        {({ close }) => (
          <>
            <MenuLabel>Who's using this device?</MenuLabel>
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
                toggle()
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
