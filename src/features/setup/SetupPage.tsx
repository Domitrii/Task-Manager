import { useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { ClipboardCheck, Compass } from 'lucide-react'
import { useStore } from '@/data/store'
import { useSync } from '@/features/account/sync'
import { FocusFrame, FocusHeading } from '@/components/layout/FocusFrame'
import { Choice } from '@/components/shared/Choice'
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
  const synced = useSync() !== null
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

      <p className="text-ink-subtle mt-6 text-center text-xs">
        {synced
          ? 'Everything is saved to your account, and kept on this device for when the signal drops.'
          : 'Everything is saved on this device.'}
      </p>
    </FocusFrame>
  )
}
