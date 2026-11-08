import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, Moon, Sun, Trash2 } from 'lucide-react'
import { staffRoleLabel } from '@/data/staffRoles'
import { useStore } from '@/data/store'
import { supabase } from '@/lib/supabase'
import { useTheme, type Theme } from '@/lib/theme'
import { useGoBack } from '@/lib/useGoBack'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Checkbox, Field, TextInput } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/shared/PageHeader'
import { NotificationToggles } from '@/features/notifications/NotificationToggles'
import { SetPinModal } from './SharedDevice'
import { ReminderList } from '@/features/notifications/ReminderList'
import { SignOutModal } from './AccountCard'
import { authErrorMessage, MIN_PASSWORD, passwordProblem, useSync, type SyncApi } from './sync'
import { teamErrorMessage } from './team'

/**
 * `/profile`: the signed-in person's own account, apart from Settings, which
 * is the whole team's. Without Supabase there are no accounts, so only the
 * device's appearance is here.
 */
export function ProfilePage() {
  const sync = useSync()
  const goBack = useGoBack('/more')
  const { data, activeStaff } = useStore()

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Your profile" onBack={goBack} />

      <Card as="div" className="p-4">
        <Avatar person={activeStaff} size="lg" />
        <h2 className="font-display text-ink mt-3 text-xl font-bold">{activeStaff.name}</h2>
        {sync ? <p className="text-ink-muted text-sm">{sync.email}</p> : null}
        <dl className="mt-3 space-y-2">
          <div>
            <dt className="text-ink-subtle text-xs">Role</dt>
            <dd className="text-ink text-sm">{staffRoleLabel(activeStaff)}</dd>
          </div>
          <div>
            <dt className="text-ink-subtle text-xs">Venue</dt>
            <dd className="text-ink text-sm">{data.settings.venueName}</dd>
          </div>
        </dl>
      </Card>

      <NotificationPreferencesSection />

      {sync && supabase ? (
        <>
          <NameCard sync={sync} />
          <EmailCard sync={sync} />
          <PasswordCard sync={sync} />
        </>
      ) : null}
      <KitchenPinCard />
      <AppearanceCard />
      {sync ? (
        <>
          <TeamCard sync={sync} />
          <AccountActionsCard sync={sync} />
        </>
      ) : null}
    </div>
  )
}

function NotificationPreferencesSection() {
  const { data } = useStore()
  return (
    <section aria-labelledby="notification-preferences">
      <h2 id="notification-preferences" className="font-display text-ink text-lg font-bold">
        Notification preferences
      </h2>
      <p className="text-ink-muted mt-1 text-[13px]">
        App preferences for {data.settings.venueName}, not device notification permission.
      </p>
      <div className="mt-3 space-y-3.5">
        <NotificationToggles />
        <ReminderList />
      </div>
    </section>
  )
}

function FormCard({
  title,
  description,
  onSubmit,
  action,
  children,
}: {
  title: string
  description: string
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  action: ReactNode
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <form onSubmit={onSubmit} noValidate>
        <CardBody className="space-y-4">
          {children}
          <div className="flex justify-end">{action}</div>
        </CardBody>
      </form>
    </Card>
  )
}

function ErrorText({ children }: { children: string | null }) {
  return children ? (
    <p role="alert" className="text-fail-600 dark:text-fail-500 text-sm">
      {children}
    </p>
  ) : null
}

function NameCard({ sync }: { sync: SyncApi }) {
  const toast = useToast()
  const [name, setName] = useState(sync.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Everyone in a team needs a name: it's what their records are signed with.
  const changed = name.trim() !== '' && name.trim() !== sync.name

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || busy || !changed) return
    setBusy(true)
    setError(null)
    const { error: failure } = await supabase.auth.updateUser({ data: { full_name: name.trim() } })
    setBusy(false)
    if (failure) setError(authErrorMessage(failure))
    else toast.success('Name saved')
  }

  return (
    <FormCard
      title="Name"
      description="How you appear to your team, and on everything you record."
      onSubmit={submit}
      action={
        <Button type="submit" variant="primary" disabled={busy || !changed}>
          {busy ? 'Saving…' : 'Save name'}
        </Button>
      }
    >
      <Field label="Your name" htmlFor="profile-name">
        <TextInput
          id="profile-name"
          autoComplete="name"
          value={name}
          placeholder="e.g. Sam Patel"
          onChange={(event) => setName(event.target.value)}
        />
      </Field>
      <ErrorText>{error}</ErrorText>
    </FormCard>
  )
}

function EmailCard({ sync }: { sync: SyncApi }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const next = email.trim()
  const valid = next !== '' && next.toLowerCase() !== sync.email.toLowerCase()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || busy || !valid) return
    setBusy(true)
    setError(null)
    const { error: failure } = await supabase.auth.updateUser(
      { email: next },
      { emailRedirectTo: window.location.origin },
    )
    setBusy(false)
    if (failure) {
      setError(authErrorMessage(failure))
      return
    }
    setPending(next)
    setEmail('')
  }

  return (
    <FormCard
      title="Email"
      description={`You sign in with ${sync.email}.`}
      onSubmit={submit}
      action={
        <Button type="submit" variant="primary" disabled={busy || !valid}>
          {busy ? 'Sending…' : 'Change email'}
        </Button>
      }
    >
      {pending ? (
        <div className="bg-info-50 dark:bg-info-500/10 rounded-lg px-3 py-2.5 text-[13px]">
          <p className="text-ink font-medium">Check your inbox to finish</p>
          <p className="text-ink-muted mt-0.5">
            We’ve sent a link to {pending}. Open it to confirm the change. If an email also arrives at {sync.email},
            open that link too. Until then, keep signing in with {sync.email}.
          </p>
        </div>
      ) : null}
      <Field label="New email" htmlFor="profile-email">
        <TextInput
          id="profile-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>
      <ErrorText>{error}</ErrorText>
    </FormCard>
  )
}

function PasswordCard({ sync }: { sync: SyncApi }) {
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  // A changed password usually means someone else might know the old one.
  const [signOutOthers, setSignOutOthers] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mismatch = repeat.length > 0 && repeat !== password
  const problem = password.length > 0 ? passwordProblem(password) : null

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || busy || !current || !password || password !== repeat || passwordProblem(password)) return
    setBusy(true)
    setError(null)
    // Checked first, so someone who picks up a signed-in phone can't lock its owner out.
    const check = await supabase.auth.signInWithPassword({ email: sync.email, password: current })
    if (check.error) {
      setBusy(false)
      setError(
        check.error.code === 'invalid_credentials' ? 'Your current password isn’t right.' : authErrorMessage(check.error),
      )
      return
    }
    const { error: failure } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (failure) {
      setError(authErrorMessage(failure))
      return
    }
    const others = signOutOthers ? await supabase.auth.signOut({ scope: 'others' }) : null
    setCurrent('')
    setPassword('')
    setRepeat('')
    if (others?.error) {
      toast.error('Password changed, but other devices are still signed in', 'Use Sign out everywhere below once you’re online.')
    } else {
      toast.success(
        'Password changed',
        signOutOthers ? 'Your other devices have been signed out.' : 'Use the new one next time you sign in on another device.',
      )
    }
  }

  return (
    <FormCard
      title="Password"
      description="Changing it can sign out your other devices too."
      onSubmit={submit}
      action={
        <Button
          type="submit"
          variant="primary"
          disabled={busy || !current || !password || password !== repeat || problem !== null}
        >
          {busy ? 'Changing…' : 'Change password'}
        </Button>
      }
    >
      <Field label="Current password" htmlFor="profile-current-password">
        <TextInput
          id="profile-current-password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="New password"
          hint={`At least ${MIN_PASSWORD} characters.`}
          error={problem ?? undefined}
          htmlFor="profile-new-password"
        >
          <TextInput
            id="profile-new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <Field
          label="Type it again"
          htmlFor="profile-repeat-password"
          error={mismatch ? 'The two passwords don’t match.' : undefined}
        >
          <TextInput
            id="profile-repeat-password"
            type="password"
            autoComplete="new-password"
            value={repeat}
            invalid={mismatch}
            onChange={(event) => setRepeat(event.target.value)}
          />
        </Field>
      </div>
      <Checkbox
        label="Sign out my other devices"
        description="Phones and tablets signed in as you will need the new password."
        checked={signOutOthers}
        onChange={(event) => setSignOutOthers(event.target.checked)}
      />
      <ErrorText>{error}</ErrorText>
    </FormCard>
  )
}

function AppearanceCard() {
  const { theme, setTheme } = useTheme()
  const options: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
  ]

  return (
    <Card>
      <CardHeader title="Appearance" description="For this device. Dark is easier on the eyes in a dim bar or kitchen." />
      <CardBody>
        <div className="bg-surface-muted inline-flex rounded-lg p-0.5" role="radiogroup" aria-label="Appearance">
          {options.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              onClick={() => setTheme(value)}
              className={cn(
                'flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors',
                theme === value ? 'bg-surface text-ink shadow-xs' : 'text-ink-muted hover:text-ink',
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}

function TeamCard({ sync }: { sync: SyncApi }) {
  return (
    <Card>
      <CardHeader title="Your team" description={`You’re in ${sync.team.name}.`} />
      <CardBody>
        <p className="text-ink-muted text-[13px]">
          The team code, changing it and leaving the team are in{' '}
          <Link to="/settings/manage?tab=staff" className="text-brand-700 dark:text-brand-300 font-semibold hover:underline">
            Settings → Team
          </Link>
          .
        </p>
      </CardBody>
    </Card>
  )
}

function AccountActionsCard({ sync }: { sync: SyncApi }) {
  const [dialog, setDialog] = useState<'sign-out' | 'everywhere' | 'delete' | null>(null)
  const close = () => setDialog(null)

  return (
    <Card>
      <CardHeader title="Account" />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-ink text-sm font-medium">Sign out of this device</p>
            <p className="text-ink-muted text-xs">Your other devices stay signed in.</p>
          </div>
          <Button onClick={() => setDialog('sign-out')} className="gap-1.5">
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
        <div className="border-line flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div className="min-w-0">
            <p className="text-ink text-sm font-medium">Sign out everywhere</p>
            <p className="text-ink-muted text-xs">For a lost phone, or a password someone else might know.</p>
          </div>
          <Button onClick={() => setDialog('everywhere')} className="gap-1.5">
            <LogOut className="size-4" />
            Sign out everywhere
          </Button>
        </div>
        <div className="border-line flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div className="min-w-0">
            <p className="text-ink text-sm font-medium">Delete account</p>
            <p className="text-ink-muted text-xs">Removes your login for good. The team keeps its records.</p>
          </div>
          <Button variant="danger" onClick={() => setDialog('delete')} className="gap-1.5">
            <Trash2 className="size-4" />
            Delete account
          </Button>
        </div>
      </CardBody>

      {dialog === 'sign-out' ? <SignOutModal sync={sync} onClose={close} /> : null}
      {dialog === 'everywhere' ? <SignOutModal sync={sync} onClose={close} everywhere /> : null}
      {dialog === 'delete' ? <DeleteAccountModal sync={sync} onClose={close} /> : null}
    </Card>
  )
}

function DeleteAccountModal({ sync, onClose }: { sync: SyncApi; onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { pending } = sync.status

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || busy || !password || pending > 0) return
    setBusy(true)
    setError(null)
    const check = await supabase.auth.signInWithPassword({ email: sync.email, password })
    if (check.error) {
      setBusy(false)
      setError(check.error.code === 'invalid_credentials' ? 'That password isn’t right.' : authErrorMessage(check.error))
      return
    }
    try {
      await sync.deleteAccount()
    } catch (failure) {
      setError(teamErrorMessage(failure))
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Delete your account?"
      description="This can’t be undone."
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="delete-account" variant="danger" disabled={busy || !password || pending > 0}>
            {busy ? 'Deleting…' : 'Delete account'}
          </Button>
        </>
      }
    >
      <form id="delete-account" onSubmit={confirm} className="space-y-3">
        <p className="text-ink-muted text-[13px]">
          {pending > 0
            ? `${pending} ${pending === 1 ? 'record hasn’t' : 'records haven’t'} synced yet. Connect to the internet and wait for sync to finish first, so ${sync.team.name} keeps ${pending === 1 ? 'it' : 'them'}.`
            : `You’ll leave ${sync.team.name} and won’t be able to sign in as ${sync.email} again. Everything you recorded stays with the team.`}
        </p>
        <Field label="Your password" hint="To confirm it’s you." htmlFor="delete-account-password">
          <TextInput
            id="delete-account-password"
            type="password"
            autoComplete="current-password"
            value={password}
            invalid={Boolean(error)}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <p role="alert" className="text-fail-600 dark:text-fail-500 text-sm empty:hidden">
          {error}
        </p>
      </form>
    </Modal>
  )
}

/** Your PIN for a shared kitchen device. */
function KitchenPinCard() {
  const { activeStaff } = useStore()
  const [open, setOpen] = useState(false)
  return (
    <Card>
      <CardHeader title="Kitchen PIN" description="For taking over a shared kitchen tablet, so what you record there is in your name." />
      <CardBody className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink text-sm">{activeStaff.pinHash ? 'Your PIN is set.' : 'You haven’t set a PIN.'}</p>
        <Button onClick={() => setOpen(true)}>{activeStaff.pinHash ? 'Change PIN' : 'Set PIN'}</Button>
      </CardBody>
      {open ? <SetPinModal person={activeStaff} onClose={() => setOpen(false)} /> : null}
    </Card>
  )
}
