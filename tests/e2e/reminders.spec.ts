import { format } from 'date-fns'
import { expect, test, type Page } from '@playwright/test'
import { openDemo, todayAt, visit } from './app.ts'
import { expectToFitScreen } from './layout.ts'

const button = (page: Page, name: string | RegExp) =>
  page.getByRole('button', { name }).filter({ visible: true }).first()

const SETTINGS = '/settings/notifications'
const TITLE = 'Check all the details'

/** The reminder's card in the bell's list. */
const card = (page: Page, title = TITLE) => page.getByRole('button').filter({ hasText: title })

async function addReminder(page: Page, time: string, fill?: (form: ReturnType<Page['getByRole']>) => Promise<void>) {
  await button(page, 'Add reminder').click()
  const form = page.getByRole('dialog')
  await form.getByLabel('Time (24h)').fill(time)
  await fill?.(form)
  await form.getByRole('button', { name: 'Save reminder' }).click()
  await expect(form).toHaveCount(0)
}

/**
 * Stands in for the browser's Notification. The ones shown are kept in
 * `sessionStorage`, so a reload can't hide one that was shown twice.
 */
async function fakeNotifications(page: Page, permission: NotificationPermission) {
  await page.addInitScript((permission) => {
    class Fake {
      static permission = permission
      static requestPermission = async () => (Fake.permission = 'granted')
      onclick: (() => void) | null = null
      constructor(title: string, options: NotificationOptions) {
        const shown = JSON.parse(sessionStorage.getItem('notifications') ?? '[]')
        sessionStorage.setItem('notifications', JSON.stringify([...shown, { title, body: options.body }]))
        Object.assign(window, { lastNotification: this })
      }
      close() {}
    }
    Object.assign(window, { Notification: Fake })
  }, permission)
}

const shownNotifications = (page: Page) =>
  page.evaluate(() => JSON.parse(sessionStorage.getItem('notifications') ?? '[]') as Array<{ title: string; body: string }>)

test.beforeEach(async ({ page }) => {
  await openDemo(page)
})

test.describe('going off', () => {
  test.skip(({ viewport }) => ![360, 1440].includes(viewport?.width ?? 0), 'Once on a phone and once on a desktop')

  test('reaches the bell at its time, saying what’s waiting', async ({ page }) => {
    await page.clock.install({ time: todayAt('14:00') })
    await visit(page, SETTINGS)
    await addReminder(page, '14:30')
    await expect(page.getByText('Every day')).toBeVisible()

    await visit(page, '/notifications')
    await expect(page.getByRole('heading', { name: 'Your reminders' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Mark all read' }).click()
    const bell = page.getByRole('link', { name: /^Notifications/ })
    await expect(bell).toHaveAccessibleName('Notifications')

    await page.clock.fastForward('31:00')
    await expect(page.getByRole('heading', { name: 'Your reminders' })).toBeVisible()
    await expect(bell).toHaveAccessibleName('Notifications: 1 unread')
    await expect(card(page)).toContainText('Reminder · 14:30')
    await expect(card(page)).toContainText('• Unread')
    await expect(card(page)).toContainText(/\d+ (missed|overdue|coming soon|to look at)/)

    await card(page).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(bell).toHaveAccessibleName('Notifications')
  })

  test('uses its own words when it has them', async ({ page }) => {
    await page.clock.install({ time: todayAt('14:00') })
    await visit(page, SETTINGS)
    await addReminder(page, '14:30', (form) => form.getByLabel('What to check').fill('Walk-in fridge seals'))
    await visit(page, '/notifications')
    await page.clock.fastForward('31:00')
    await expect(card(page, 'Walk-in fridge seals')).toContainText('Reminder · 14:30')
  })

  test('a time already past waits until tomorrow', async ({ page }) => {
    await page.clock.install({ time: todayAt('16:00') })
    await visit(page, SETTINGS)
    await addReminder(page, '15:00')
    await visit(page, '/notifications')
    await expect(card(page)).toHaveCount(0)

    await page.clock.fastForward('24:00:00')
    await expect(card(page)).toContainText('Reminder · 15:00')
  })

  test('only goes off on the days chosen', async ({ page }) => {
    await page.clock.install({ time: todayAt('14:00') })
    await visit(page, SETTINGS)
    await addReminder(page, '14:30', async (form) => {
      await form.getByLabel('Repeat').selectOption('days')
      await form.getByRole('button', { name: format(new Date(), 'EEE') }).click()
    })
    await visit(page, '/notifications')
    await page.clock.fastForward('01:00:00')
    await expect(card(page)).toHaveCount(0)

    await page.clock.fastForward('24:00:00')
    await expect(card(page)).toBeVisible()
  })

  test('needs at least one day', async ({ page }) => {
    await visit(page, SETTINGS)
    await button(page, 'Add reminder').click()
    const form = page.getByRole('dialog')
    await form.getByLabel('Repeat').selectOption('days')
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) await form.getByRole('button', { name: day }).click()
    await expect(form.getByText('Choose at least one day.')).toBeVisible()
    await expect(form.getByRole('button', { name: 'Save reminder' })).toBeDisabled()
  })

  test('just once goes off once, then leaves the list', async ({ page }) => {
    await page.clock.install({ time: todayAt('14:00') })
    await visit(page, SETTINGS)
    await button(page, 'Add reminder').click()
    const form = page.getByRole('dialog')
    await form.getByLabel('Time (24h)').fill('13:00')
    await form.getByLabel('Repeat').selectOption('once')
    await expect(form.getByText('Choose a date and time still to come.')).toBeVisible()
    await expect(form.getByRole('button', { name: 'Save reminder' })).toBeDisabled()

    await form.getByLabel('Time (24h)').fill('14:30')
    await form.getByRole('button', { name: 'Save reminder' }).click()
    const row = page.getByRole('button', { name: 'Change reminder at 14:30' })
    await expect(row).toContainText('Once ·')

    await page.clock.fastForward('31:00')
    await expect(row).toHaveCount(0)
    await visit(page, '/notifications')
    await expect(card(page)).toBeVisible()

    await page.clock.fastForward('24:00:00')
    await expect(card(page)).toHaveCount(0)
  })

  test('switched off stays quiet, and can be switched back on', async ({ page }) => {
    await page.clock.install({ time: todayAt('14:00') })
    await visit(page, SETTINGS)
    await addReminder(page, '14:30')
    const toggle = page.getByRole('switch', { name: 'Reminder at 14:30' })
    await toggle.click()
    await visit(page, '/notifications')
    await expect(page.getByText('Choose a time to check everything')).toBeVisible()
    await page.clock.fastForward('31:00')
    await expect(card(page)).toHaveCount(0)

    await page.clock.fastForward('23:00:00')
    await visit(page, SETTINGS)
    await toggle.click()
    await visit(page, '/notifications')
    await expect(page.getByText('1 set')).toBeVisible()
    await page.clock.fastForward('01:00:00')
    await expect(card(page)).toBeVisible()
  })

  test('moved later today, it goes off again; deleted, it’s gone', async ({ page }) => {
    await page.clock.install({ time: todayAt('14:00') })
    await visit(page, SETTINGS)
    await addReminder(page, '14:30')
    await visit(page, '/notifications')
    await page.clock.fastForward('31:00')
    await page.getByRole('button', { name: 'Mark all read' }).click()
    await expect(card(page)).toContainText('Read')

    await visit(page, SETTINGS)
    await page.getByRole('button', { name: 'Change reminder at 14:30' }).click()
    const form = page.getByRole('dialog')
    await expect(form.getByLabel('Time (24h)')).toHaveValue('14:30')
    await form.getByLabel('Time (24h)').fill('16:00')
    await form.getByRole('button', { name: 'Save reminder' }).click()

    await visit(page, '/notifications')
    await expect(card(page)).toHaveCount(0)
    await page.clock.fastForward('01:30:00')
    await expect(card(page)).toContainText('Reminder · 16:00')
    await expect(card(page)).toContainText('• Unread')

    await visit(page, SETTINGS)
    await page.getByRole('button', { name: 'Change reminder at 16:00' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete reminder' }).click()
    await expect(page.getByText('Choose a time to be reminded')).toBeVisible()
    await visit(page, '/notifications')
    await expect(card(page)).toHaveCount(0)
  })

  test('survives a reload', async ({ page }) => {
    await visit(page, SETTINGS)
    await addReminder(page, '14:30')
    await page.reload()
    await expect(page.getByRole('button', { name: 'Change reminder at 14:30' })).toBeVisible()
  })
})

test.describe('on the device', () => {
  test.skip(({ viewport }) => ![360, 1440].includes(viewport?.width ?? 0), 'Once on a phone and once on a desktop')

  test('pops up once, and a reload doesn’t repeat it', async ({ page }) => {
    await fakeNotifications(page, 'granted')
    await page.clock.install({ time: todayAt('14:00') })
    await visit(page, SETTINGS)
    await expect(page.getByText('Notifications are on.')).toBeVisible()
    await addReminder(page, '14:30')

    await page.clock.fastForward('31:00')
    await expect.poll(() => shownNotifications(page)).toHaveLength(1)
    const [notification] = await shownNotifications(page)
    expect(notification.title).toBe(TITLE)
    expect(notification.body).toMatch(/\d+ (missed|overdue|coming soon|to look at)/)

    await page.reload()
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await page.clock.fastForward('02:00')
    await expect.poll(() => shownNotifications(page)).toHaveLength(1)
  })

  test('tapping it opens the bell’s list', async ({ page }) => {
    await fakeNotifications(page, 'granted')
    await page.clock.install({ time: todayAt('14:00') })
    await visit(page, SETTINGS)
    await addReminder(page, '14:30')
    await page.clock.fastForward('31:00')
    await expect.poll(() => shownNotifications(page)).toHaveLength(1)

    await page.evaluate(() => (window as unknown as { lastNotification: { onclick: () => void } }).lastNotification.onclick())
    await expect(page.getByRole('heading', { level: 1, name: 'Notifications' })).toBeVisible()
    await expect(card(page)).toBeVisible()
  })

  test('without permission it shows in the app instead', async ({ page }) => {
    await fakeNotifications(page, 'denied')
    await page.clock.install({ time: todayAt('14:00') })
    await visit(page, SETTINGS)
    await expect(page.getByText(/Notifications are blocked/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Turn on' })).toHaveCount(0)
    await addReminder(page, '14:30')

    await page.clock.fastForward('31:00')
    await expect(page.getByRole('status').filter({ hasText: TITLE })).toBeVisible()
    expect(await shownNotifications(page)).toHaveLength(0)
  })

  test('opening the app long after the time doesn’t pop up late', async ({ page }) => {
    await fakeNotifications(page, 'granted')
    await page.clock.install({ time: todayAt('14:00') })
    await visit(page, SETTINGS)
    await addReminder(page, '14:30')
    await page.goto('about:blank')
    await page.clock.fastForward('02:00:00')

    await visit(page, '/more')
    await expect(page.getByRole('status').filter({ hasText: TITLE })).toBeVisible()
    await expect(page.getByRole('link', { name: /^Notifications/ })).toHaveAccessibleName(/unread/)
    expect(await shownNotifications(page)).toHaveLength(0)
  })

  test('saving a reminder asks for permission', async ({ page }) => {
    await fakeNotifications(page, 'default')
    await visit(page, SETTINGS)
    await expect(page.getByText(/Turn on notifications/)).toBeVisible()
    await addReminder(page, '14:30')
    await expect(page.getByText('Notifications are on.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Turn on' })).toHaveCount(0)
  })

  test('the Turn on button asks for permission', async ({ page }) => {
    await fakeNotifications(page, 'default')
    await visit(page, SETTINGS)
    await page.getByRole('button', { name: 'Turn on' }).click()
    await expect(page.getByText('Notifications are on.')).toBeVisible()
  })

  test('a browser without notifications says so', async ({ page }) => {
    await page.addInitScript(() => {
      delete (window as unknown as { Notification?: unknown }).Notification
    })
    await visit(page, SETTINGS)
    await expect(page.getByText(/This browser can’t show notifications/)).toBeVisible()
  })
})

test('the bell links to reminders, and the pages fit the screen', async ({ page }) => {
  await visit(page, '/notifications')
  await page.getByRole('link', { name: /Set a reminder/ }).click()
  await expect(page.getByRole('heading', { name: 'Your reminders' })).toBeVisible()
  await addReminder(page, '09:30', async (form) => {
    await form.getByLabel('Repeat').selectOption('days')
    await form.getByRole('button', { name: 'Sun' }).click()
    await form.getByLabel('What to check').fill('A very long note about what needs looking at when this goes off in the morning')
  })
  await expect(page.getByText('Mon, Tue, Wed, Thu, Fri, Sat')).toBeVisible()
  await expectToFitScreen(page)

  await page.getByRole('button', { name: 'Change reminder at 09:30' }).click()
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Sun' })).toHaveAttribute('aria-pressed', 'false')
  await expectToFitScreen(page)
})
