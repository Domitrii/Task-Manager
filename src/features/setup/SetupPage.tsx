import { useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { ChevronRight, ClipboardCheck, Compass, type LucideIcon } from 'lucide-react'
import { useStore } from '@/data/store'
import { cn } from '@/lib/utils'
import { FocusFrame, FocusHeading } from '@/components/layout/FocusFrame'
import { SetupFlow } from './SetupFlow'

/**
 * `/setup` offers the two ways in; `/setup/venue` is the questions. The
 * questions are also reached from Settings to start again over existing data.
 */
export function SetupPage() {
  return (
    <Routes>
      <Route index element={<SetupWelcome />} />
      <Route path="venue" element={<SetupFlow />} />
      <Route path="*" element={<Navigate to="/setup" replace />} />
    </Routes>
  )
}

function SetupWelcome() {
  const { hasData, resetDemoData } = useStore()
  const navigate = useNavigate()
  const [loadingDemo, setLoadingDemo] = useState(false)

  // Loading demo data from here would overwrite a venue without asking.
  // Settings is the way to start again once there is something to lose.
  if (hasData && !loadingDemo) return <Navigate to="/" replace />

  async function exploreDemo() {
    setLoadingDemo(true)
    await resetDemoData()
    navigate('/', { replace: true })
  }

  return (
    <FocusFrame>
      <FocusHeading
        title="Welcome to Mise"
        description="Your kitchen’s food safety records in one place: temperatures, checklists, deliveries and anything that goes wrong."
      />

      <div className="space-y-3">
        <Choice
          primary
          icon={ClipboardCheck}
          title="Set up my venue"
          description="Answer a few questions and we’ll create your fridges, checklists and check times. Takes about two minutes."
          onClick={() => navigate('/setup/venue')}
        />
        <Choice
          icon={Compass}
          title="Explore with demo data"
          description="Look around a sample restaurant with two weeks of records. You can set up your own venue later in Settings."
          onClick={exploreDemo}
          disabled={loadingDemo}
        />
      </div>

      <p className="text-ink-subtle mt-6 text-center text-xs">Everything is saved on this device.</p>
    </FocusFrame>
  )
}

function Choice({
  icon: Icon,
  title,
  description,
  onClick,
  primary,
  disabled,
}: {
  icon: LucideIcon
  title: string
  description: string
  onClick: () => void
  primary?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-colors disabled:opacity-60 sm:p-5',
        primary
          ? 'bg-brand-600 border-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white'
          : 'bg-surface border-line-default hover:border-line-strong active:bg-surface-muted',
      )}
    >
      <span
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-xl',
          primary ? 'bg-white/15' : 'bg-surface-muted text-ink-muted',
        )}
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[17px] font-bold', !primary && 'text-ink')}>{title}</span>
        <span className={cn('mt-1 block text-sm', primary ? 'text-brand-50' : 'text-ink-muted')}>{description}</span>
      </span>
      <ChevronRight className={cn('mt-3 size-5 shrink-0', primary ? 'text-white' : 'text-ink-subtle')} />
    </button>
  )
}
