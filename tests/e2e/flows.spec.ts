import { expect, test, type Page } from '@playwright/test'
import { openDemo, visit } from './app.ts'

/** The first one of these on screen. */
const button = (page: Page, name: string | RegExp) =>
  page.getByRole('button', { name }).filter({ visible: true }).first()

const chips = (page: Page) => page.getByRole('group', { name: 'Show tasks' })

/** Device-only mode lets anyone on the staff list take over. */
async function switchTo(page: Page, person: string) {
  await visit(page, '/')
  await page.getByRole('button', { name: /Switch person/ }).click()
  await page.getByRole('button', { name: new RegExp(`^${person}`) }).click()
}

test.describe('with the demo venue', () => {
  test.skip(({ viewport }) => ![360, 1440].includes(viewport?.width ?? 0), 'Once on a phone and once on a desktop')

  test.beforeEach(async ({ page }) => {
    await openDemo(page)
  })

  test('clocking in and out of today’s shift', async ({ page }) => {
    await visit(page, '/calendar')
    await button(page, 'Clock in').click()
    await page.getByRole('dialog').getByRole('button', { name: 'Clock in' }).click()
    await expect(page.getByText('Clocked in', { exact: true })).toBeVisible()

    await button(page, 'Clock out').click()
    await page.getByRole('dialog').getByRole('button', { name: 'Clock out' }).click()
    await expect(page.getByText('Clocked out')).toBeVisible()
    await expect(page.getByText('Shift completed')).toBeVisible()
    await expect(page.getByText('No further shift today')).toBeVisible()

    await visit(page, '/team')
    await expect(page.getByText(/0 clocked in/)).toBeVisible()
  })

  test('unavailability can’t end before it starts, and shows on the week once saved', async ({ page }) => {
    await visit(page, '/calendar')
    await button(page, 'Add unavailability').click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('End date').fill('2020-01-01')
    await expect(dialog.getByText(/End date must be on or after/)).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Save unavailability' })).toBeDisabled()

    const start = await dialog.getByLabel('Start date').inputValue()
    await dialog.getByLabel('End date').fill(start)
    await dialog.getByRole('button', { name: 'Save unavailability' }).click()
    await expect(page.getByText('Unavailability saved')).toBeVisible()
    await expect(page.getByText(/^Unavailable · All day/).first()).toBeVisible()
  })

  test('a new section takes a new task, and deleting it takes the task too', async ({ page }) => {
    await visit(page, '/tasks')
    await button(page, 'More actions').click()
    await button(page, 'Create new group').click()
    await page.getByRole('dialog').getByRole('button', { name: 'Create group' }).click()
    await expect(page.getByText('Enter a group name.')).toBeVisible()
    await page.getByLabel('Group name').fill('Weekly deep clean')
    await page.getByRole('dialog').getByRole('button', { name: 'Create group' }).click()
    await expect(chips(page).getByRole('button', { name: 'Weekly deep clean' })).toHaveAttribute('aria-pressed', 'true')

    await button(page, 'New task').click()
    const form = page.getByRole('dialog')
    await form.getByRole('button', { name: 'Create task' }).click()
    await expect(form.getByText('Enter a task name.')).toBeVisible()
    await form.getByLabel(/Task name/).fill('Pull out the fryers')
    await form.getByRole('button', { name: 'Create task' }).click()
    await expect(page.getByRole('button', { name: 'Pull out the fryers' })).toBeVisible()

    await button(page, 'Edit Weekly deep clean').click()
    await button(page, 'Delete section').click()
    const alert = page.getByRole('alertdialog')
    await expect(alert).toContainText('its task')
    await alert.getByRole('button', { name: 'Delete section' }).click()
    await expect(chips(page).getByRole('button', { name: 'Weekly deep clean' })).toHaveCount(0)
    await expect(chips(page).getByRole('button', { name: 'All my tasks' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('Pull out the fryers')).toHaveCount(0)
  })

  test('a saved order stays after a reload', async ({ page }) => {
    await visit(page, '/tasks')
    await chips(page).getByRole('button', { name: 'Opening routine' }).click()
    const titles = () => page.getByRole('region', { name: 'Opening routine' }).locator('li button[aria-expanded]').allTextContents()
    const before = await titles()

    await button(page, 'More actions').click()
    await button(page, 'Reorder').click()
    await button(page, `Move ${before[0]} down`).click()
    await button(page, 'Save order').click()

    const expected = [before[1], before[0], ...before.slice(2)]
    await expect.poll(titles).toEqual(expected)
    await page.reload()
    await page.getByRole('heading', { level: 1 }).first().waitFor()
    await chips(page).getByRole('button', { name: 'Opening routine' }).click()
    await expect.poll(titles).toEqual(expected)
  })

  test('finishing a repeating task puts the next one on the list, once', async ({ page }) => {
    await visit(page, '/tasks')
    await chips(page).getByRole('button', { name: 'Closing routine' }).click()
    const name = 'Label and date all open food'
    const row = page.locator('li').filter({ hasText: name })
    await expect(row).toHaveCount(1)

    await row.getByRole('button', { name: 'Mark complete' }).click()
    await expect(row).toHaveCount(2)
    // The same task again, not the copy it made: that one's next is a different task.
    await row.getByRole('button', { name: 'Reopen task' }).click()
    await row.filter({ hasText: 'Due 21:45' }).getByRole('button', { name: 'Mark complete' }).click()
    await expect(row.getByRole('button', { name: 'Reopen task' })).toHaveCount(1)
    await expect(row).toHaveCount(2)
  })

  test('a task that needs a photo can’t be completed without one', async ({ page }) => {
    await visit(page, '/tasks')
    await chips(page).getByRole('button', { name: 'Opening routine' }).click()
    await page.locator('li').filter({ hasText: 'Sanitise prep surfaces' }).getByRole('button', { name: 'Add a photo and complete' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Complete task' }).click()
    await expect(dialog.getByText('Take a photo before completing this task.')).toBeVisible()
    await expect(dialog).toBeVisible()
  })

  test('marking everything read clears the bell, and turning a kind off hides it', async ({ page }) => {
    await visit(page, '/notifications')
    const bell = page.getByRole('link', { name: /^Notifications/ })
    await expect(bell).toHaveAccessibleName(/unread/)
    await expect(page.getByText('• Unread').first()).toBeVisible()

    await button(page, 'Mark all read').click()
    await expect(page.getByText('All notifications marked as read')).toBeVisible()
    await expect(bell).toHaveAccessibleName('Notifications')
    await expect(page.getByText('• Unread')).toHaveCount(0)

    await page.getByLabel('Search reminders').fill('nothing called this')
    await expect(page.getByText('No matching reminders')).toBeVisible()
    await button(page, 'Clear search').click()
    await expect(page.getByText('No matching reminders')).toHaveCount(0)

    await visit(page, '/settings/notifications')
    await page.getByRole('switch', { name: 'Checklist reminders' }).click()
    await visit(page, '/notifications')
    await expect(page.getByText('Update allergen matrix for new autumn menu')).toHaveCount(0)
  })

  test('an issue goes from in progress to resolved to signed off', async ({ page }) => {
    await visit(page, '/food-safety')
    await page.locator('a[href^="/food-safety/"]').filter({ hasText: 'In progress' }).first().click()
    await button(page, 'Mark as resolved').click()
    await page.getByLabel(/What was done/).fill('Engineer replaced the door seal.')
    await page.getByRole('dialog').getByRole('button', { name: 'Mark resolved' }).click()

    // Still open until a manager agrees, and Amara is one.
    await expect(page.getByText('Needs sign-off')).toBeVisible()
    await button(page, 'Sign off').click()
    await expect(page.getByText('Issue signed off')).toBeVisible()
    await expect(page.getByText(/^Signed off by Amara Okafor/)).toBeVisible()

    await visit(page, '/food-safety')
    await button(page, 'Closed').click()
    await expect(page.getByText(/Signed off by Amara Okafor/).first()).toBeVisible()
  })

  test('someone who isn’t a manager can’t sign an issue off', async ({ page }) => {
    await visit(page, '/')
    await page.getByRole('button', { name: /Switch person/ }).click()
    await page.getByRole('button', { name: /^LF Lena Ferreira/ }).click()
    await visit(page, '/food-safety')
    await page.locator('a[href^="/food-safety/"]').filter({ hasText: 'In progress' }).first().click()
    await button(page, 'Mark as resolved').click()
    await page.getByLabel(/What was done/).fill('Cleaned the seal.')
    await page.getByRole('dialog').getByRole('button', { name: 'Mark resolved' }).click()
    await expect(page.getByText('Waiting for a manager to sign this off.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign off' })).toHaveCount(0)
  })

  test('whoever resolved an issue can change their answer, and the old one is kept', async ({ page }) => {
    await switchTo(page, 'LF Lena Ferreira')
    await visit(page, '/food-safety')
    await page.locator('a[href^="/food-safety/"]').filter({ hasText: 'In progress' }).first().click()
    await button(page, 'Mark as resolved').click()
    await page.getByLabel(/What was done/).fill('Cleaned the seal.')
    await page.getByRole('dialog').getByRole('button', { name: 'Mark resolved' }).click()
    await expect(page.getByText(/^Resolved .* by Lena Ferreira$/)).toBeVisible()

    await button(page, 'Edit what was done').click()
    const sheet = page.getByRole('dialog')
    // Nothing to save until it says something different.
    await expect(sheet.getByRole('button', { name: 'Save changes' })).toBeDisabled()
    await sheet.getByLabel(/What was done/).fill('Replaced the seal.')
    await sheet.getByRole('button', { name: 'Save changes' }).click()

    await expect(page.getByText('Replaced the seal.')).toBeVisible()
    await expect(page.getByText('Before: Cleaned the seal.')).toBeVisible()
    await expect(page.getByText('Waiting for a manager to sign this off.')).toBeVisible()
    const url = new URL(page.url()).pathname

    // Someone else on the team can read it, but it isn't theirs to change.
    await switchTo(page, 'TW Tom')
    await visit(page, url)
    await expect(page.getByRole('button', { name: 'Edit what was done' })).toHaveCount(0)
    await expect(page.getByText('Only Lena Ferreira or a manager can change this.')).toBeVisible()
  })

  test('changing an answer after sign-off asks for sign-off again', async ({ page }) => {
    await visit(page, '/food-safety')
    await page.locator('a[href^="/food-safety/"]').filter({ hasText: 'In progress' }).first().click()
    await button(page, 'Mark as resolved').click()
    await page.getByLabel(/What was done/).fill('Engineer replaced the door seal.')
    await page.getByRole('dialog').getByRole('button', { name: 'Mark resolved' }).click()
    await expect(page.getByText('Needs sign-off')).toBeVisible()
    const issue = new URL(page.url()).pathname
    const title = await page.getByRole('heading', { level: 2 }).first().innerText()

    // Having read the first request mustn't hide the next one.
    await visit(page, '/notifications')
    await button(page, 'Mark all read').click()
    await expect(page.getByRole('button').filter({ hasText: title })).toContainText('Read')

    await visit(page, issue)
    await button(page, 'Sign off').click()
    await expect(page.getByText(/^Signed off by Amara Okafor/)).toBeVisible()

    await button(page, 'Edit what was done').click()
    const sheet = page.getByRole('dialog')
    await expect(sheet.getByText(/Saving reopens this issue/)).toBeVisible()
    await sheet.getByLabel(/What was done/).fill('Engineer replaced the seal and the hinge.')
    await sheet.getByRole('button', { name: 'Save changes' }).click()

    await expect(page.getByText('Needs sign-off')).toBeVisible()
    await expect(page.getByText('Issue signed off')).toHaveCount(0)
    await expect(page.getByText(/^Signed off by/)).toHaveCount(0)
    await expect(button(page, 'Sign off')).toBeVisible()

    await visit(page, '/notifications')
    await expect(page.getByRole('button').filter({ hasText: title })).toContainText('• Unread')

    await visit(page, '/food-safety')
    await expect(page.locator('a[href^="/food-safety/"]').filter({ hasText: title })).toBeVisible()
  })

  test('a new appliance needs a name and limits that make sense', async ({ page }) => {
    await visit(page, '/temperatures')
    await button(page, 'Add appliance').click()
    const form = page.getByRole('dialog')
    // Typed key by key: "-" alone isn't a number yet, and has to survive until the "1".
    const maximum = form.getByRole('textbox', { name: 'Target maximum' })
    await maximum.clear()
    await maximum.pressSequentially('-1')
    await expect(maximum).toHaveValue('-1')
    await form.getByRole('button', { name: 'Save appliance' }).click()
    await expect(form.getByText('Check 2 fields')).toBeVisible()
    await expect(form.getByText('Minimum must be below maximum')).toBeVisible()

    await form.getByLabel(/^Name/).fill('Fridge 9')
    await maximum.fill('5')
    await form.getByRole('button', { name: 'Save appliance' }).click()
    await expect(page.getByText('Appliance added')).toBeVisible()

    const card = page.getByRole('link', { name: /Fridge 9/ })
    await expect(card).toContainText('No reading yet')
    await card.click()
    await expect(page.getByText('Target 0–5°C · Fail above 8°C')).toBeVisible()
  })

  test('a stock item, a supplier and an invitation can each be added', async ({ page }) => {
    await visit(page, '/stock')
    await button(page, 'Add item').click()
    await page.getByRole('dialog').getByLabel(/^Name/).fill('Oat milk cartons')
    await page.getByRole('button', { name: 'Increase quantity' }).click()
    await button(page, 'Save item').click()
    await expect(page.getByRole('link', { name: /Oat milk cartons/ })).toContainText('1 pack')

    await visit(page, '/suppliers')
    await button(page, 'Add supplier').click()
    const supplier = page.getByRole('dialog')
    await supplier.getByLabel(/^Name/).fill('City Bakery')
    await supplier.getByLabel(/^Email/).fill('not an email')
    await supplier.getByRole('button', { name: 'Tue' }).click()
    await supplier.getByRole('button', { name: 'Save supplier' }).click()
    await expect(supplier.getByText('Enter a valid email address')).toBeVisible()
    await supplier.getByLabel(/^Email/).fill('orders@citybakery.example')
    await supplier.getByRole('button', { name: 'Save supplier' }).click()
    await expect(page.getByRole('link', { name: /City Bakery/ })).toContainText('Tue · Email available')

    await visit(page, '/team')
    await button(page, 'Invite member').click()
    const invite = page.getByRole('dialog')
    await invite.getByLabel(/^Email/).fill('new.starter@example.com')
    await invite.getByLabel(/^Role/).selectOption({ label: 'Kitchen porter' })
    await invite.getByRole('button', { name: 'Send invitation' }).click()
    await expect(page.getByText('Pending invitation')).toBeVisible()
    await expect(page.getByText('new.starter@example.com')).toBeVisible()
  })

  test('the pages replaced by the Figma ones are still reachable from them', async ({ page }) => {
    for (const [from, link, heading] of [
      ['/temperatures', 'Today’s checks and full history', 'Temperature checks'],
      ['/deliveries', 'All deliveries, rejections and use-by dates', 'Deliveries & goods receiving'],
      ['/suppliers', 'Orders and upcoming deliveries', 'Suppliers & orders'],
      ['/team', 'Join code, approvals and permissions', 'Venue, team and data'],
      ['/settings', /^Venue, team and data/, 'Venue, team and data'],
    ] as const) {
      await visit(page, from)
      await page.getByRole('link', { name: link }).click()
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
    }
  })
})
