import { addDays, format, startOfWeek } from 'date-fns'
import { expect, test, type Page } from '@playwright/test'
import { openDemo, todayAt, visit } from './app.ts'
import { expectToFitScreen } from './layout.ts'

const HOUR_PX = 48

const button = (page: Page, name: string | RegExp) =>
  page.getByRole('button', { name }).filter({ visible: true }).first()

const timer = (page: Page) => page.getByRole('timer')

/** A day on the grid, by how far it is into this week (Monday is 0). */
const day = (page: Page, offset: number) =>
  page.getByRole('group', {
    name: format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), offset), 'EEEE d MMMM'),
  })

const dateOf = (offset: number) => format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), offset), 'yyyy-MM-dd')

/** The early hours, where the demo team has nothing on. */
async function scrollToMidnight(page: Page) {
  await page.getByRole('region', { name: 'Week grid' }).evaluate((grid) => {
    grid.scrollTop = 0
  })
}

async function clockIn(page: Page) {
  await button(page, 'Clock in').click()
  await page.getByRole('dialog').getByRole('button', { name: 'Clock in' }).click()
}

async function endShift(page: Page) {
  await button(page, 'End shift').click()
  return page.getByRole('dialog')
}

test.beforeEach(async ({ page }) => {
  await openDemo(page)
})

test.describe('the clock', () => {
  test.skip(({ viewport }) => ![360, 1440].includes(viewport?.width ?? 0), 'Once on a phone and once on a desktop')

  test('a shift can’t start before its start time', async ({ page }) => {
    await page.clock.install({ time: todayAt('07:30') })
    await visit(page, '/calendar')
    await expect(button(page, 'Clock in')).toBeDisabled()
    await expect(page.getByText(/You can clock in from 08:00/)).toBeVisible()

    await page.clock.fastForward('31:00')
    await expect(button(page, 'Clock in')).toBeEnabled()
  })

  test('a shift can start late, and says how late', async ({ page }) => {
    await page.clock.install({ time: todayAt('11:15') })
    await visit(page, '/calendar')
    await button(page, 'Clock in').click()
    await expect(page.getByRole('dialog').getByText('3h 15 after the scheduled start')).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: 'Clock in' }).click()
    await expect(timer(page)).toHaveText(/^00:00:/)
  })

  test('the timer replaces Clock in, and carries on after a reload', async ({ page }) => {
    await page.clock.install({ time: todayAt('09:00') })
    await visit(page, '/calendar')
    await clockIn(page)

    await expect(page.getByText('Clocked in', { exact: true })).toBeVisible()
    await expect(timer(page)).toHaveText(/^00:00:/)
    await expect(button(page, 'Break')).toBeVisible()
    await expect(button(page, 'End shift')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Clock in' })).toHaveCount(0)

    await page.clock.fastForward('01:30:00')
    await expect(timer(page)).toHaveText(/^01:30:/)
    await page.reload()
    await expect(timer(page)).toHaveText(/^01:30:/)
  })

  test('a break stops the time worked', async ({ page }) => {
    await page.clock.install({ time: todayAt('09:00') })
    await visit(page, '/calendar')
    await clockIn(page)
    await page.clock.fastForward('01:00:00')

    await button(page, /^Break$/).click()
    await expect(page.getByText('On break')).toBeVisible()
    await expect(page.getByText(/^Worked 01:00:/)).toBeVisible()
    await page.clock.fastForward('10:00')
    await expect(timer(page)).toHaveText(/^00:10:/)
    await expect(page.getByText(/^Worked 01:00:/)).toBeVisible()

    await button(page, 'End break').click()
    await expect(page.getByText('Clocked in', { exact: true })).toBeVisible()
    await expect(timer(page)).toHaveText(/^01:00:/)
  })

  test('a shift can end early', async ({ page }) => {
    await page.clock.install({ time: todayAt('09:00') })
    await visit(page, '/calendar')
    await clockIn(page)
    await page.clock.fastForward('01:00:00')

    const dialog = await endShift(page)
    await expect(dialog.getByText('6h 00 before the scheduled end')).toBeVisible()
    await dialog.getByRole('button', { name: 'End shift' }).click()
    await expect(page.getByText('Shift ended')).toBeVisible()
    await expect(page.getByText(/Shift complete, 1h 00 worked/)).toBeVisible()
  })

  test('a shift can end late', async ({ page }) => {
    await page.clock.install({ time: todayAt('15:00') })
    await visit(page, '/calendar')
    await clockIn(page)
    await page.clock.fastForward('02:30:00')

    const dialog = await endShift(page)
    await expect(dialog.getByText('1h 30 after the scheduled end')).toBeVisible()
    await dialog.getByRole('button', { name: 'End shift' }).click()
    await expect(page.getByText(/Shift complete, 2h 30 worked/)).toBeVisible()
  })

  test('ending a shift on a break ends the break too', async ({ page }) => {
    await page.clock.install({ time: todayAt('09:00') })
    await visit(page, '/calendar')
    await clockIn(page)
    await page.clock.fastForward('01:00:00')
    await button(page, /^Break$/).click()
    await page.clock.fastForward('30:00')

    const dialog = await endShift(page)
    await dialog.getByRole('button', { name: 'End shift' }).click()
    await expect(page.getByText(/Shift complete, 1h 00 worked/)).toBeVisible()

    await button(page, 'Calendar').click()
    await expect(page.getByText(/Break 0h 30/)).toBeVisible()
  })
})

test('the timer fits at every width, working and on a break', async ({ page }) => {
  await page.clock.install({ time: todayAt('09:00') })
  await visit(page, '/calendar')
  await clockIn(page)
  await expect(timer(page)).toBeVisible()
  await expectToFitScreen(page)
  await button(page, /^Break$/).click()
  await expect(page.getByText('On break')).toBeVisible()
  await expectToFitScreen(page)
})

test.describe('the schedule', () => {
  test.skip(({ viewport }) => ![360, 1440].includes(viewport?.width ?? 0), 'Once on a phone and once on a desktop')

  test('someone who isn’t a manager only gets their own week', async ({ page }) => {
    await visit(page, '/')
    await page.getByRole('button', { name: /Switch person/ }).click()
    await page.getByRole('button', { name: /^TW Tom/ }).click()
    await visit(page, '/calendar')
    await expect(page.getByRole('button', { name: 'Calendar', exact: true }).filter({ visible: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Schedule' })).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Week grid' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Add shift' })).toHaveCount(0)
  })

  test('picking a time adds a shift for whoever’s chosen', async ({ page, isMobile }) => {
    await visit(page, '/calendar')
    await scrollToMidnight(page)
    const target = day(page, 2)
    const position = { x: 20, y: 2 * HOUR_PX }
    if (isMobile) await target.tap({ position })
    else await target.click({ position })

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByLabel('Date')).toHaveValue(dateOf(2))
    await expect(dialog.getByLabel('Start')).toHaveValue('02:00')
    await expect(dialog.getByLabel('End')).toHaveValue('10:00')
    await dialog.getByLabel('Person').selectOption({ label: 'Tom Whitfield' })
    await dialog.getByRole('button', { name: 'Add shift' }).click()

    await expect(target.getByRole('button', { name: /^Tom Whitfield, 02:00–10:00/ })).toBeVisible()
  })

  test('a shift over midnight shows on both days', async ({ page }) => {
    await visit(page, '/calendar')
    await button(page, 'Add shift').click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Person').selectOption({ label: 'Tom Whitfield' })
    await dialog.getByLabel('Date').fill(dateOf(1))
    await dialog.getByLabel('Start').fill('23:00')
    await dialog.getByLabel('End').fill('02:00')
    await expect(dialog.getByText('Ends the next day.')).toBeVisible()
    await dialog.getByRole('button', { name: 'Add shift' }).click()

    const block = /^Tom Whitfield, 23:00–02:00/
    await expect(day(page, 1).getByRole('button', { name: block })).toHaveCount(1)
    await expect(day(page, 2).getByRole('button', { name: block })).toHaveCount(1)
  })

  test('a started shift can’t be rescheduled, and opens on its own page', async ({ page }) => {
    await page.clock.install({ time: todayAt('09:00') })
    await visit(page, '/calendar')
    await clockIn(page)
    await page.getByRole('button', { name: /^Amara Okafor, 08:00–16:00, Clocked in/ }).click()
    await expect(page.getByRole('heading', { name: 'Shift detail' })).toBeVisible()
    await expect(timer(page)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remove shift' })).toHaveCount(0)
  })
})

test.describe('dragging on the schedule', () => {
  test.skip(({ viewport }) => viewport?.width !== 1440, 'Needs a mouse')

  /** Drags in a straight line, in small steps like a hand would. */
  async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 6 })
    await page.mouse.up()
  }

  async function addShiftByDrag(page: Page) {
    await visit(page, '/calendar')
    await scrollToMidnight(page)
    const monday = await day(page, 0).boundingBox()
    if (!monday) throw new Error('No grid')
    const x = monday.x + 40
    await drag(page, { x, y: monday.y + HOUR_PX }, { x, y: monday.y + 3.5 * HOUR_PX })

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByLabel('Start')).toHaveValue('01:00')
    await expect(dialog.getByLabel('End')).toHaveValue('03:30')
    await dialog.getByLabel('Person').selectOption({ label: 'Tom Whitfield' })
    await dialog.getByRole('button', { name: 'Add shift' }).click()
    return monday
  }

  test('dragging on an empty day picks the shift’s hours', async ({ page }) => {
    await addShiftByDrag(page)
    await expect(day(page, 0).getByRole('button', { name: /^Tom Whitfield, 01:00–03:30/ })).toBeVisible()
  })

  test('dragging a shift moves it to another day and time, keeping its length', async ({ page }) => {
    const monday = await addShiftByDrag(page)
    const tuesday = await day(page, 1).boundingBox()
    if (!tuesday) throw new Error('No grid')
    const y = monday.y + 2 * HOUR_PX
    await drag(page, { x: monday.x + 40, y }, { x: tuesday.x + 40, y: y + HOUR_PX })

    await expect(day(page, 1).getByRole('button', { name: /^Tom Whitfield, 02:00–04:30/ })).toBeVisible()
    await expect(day(page, 0).getByRole('button', { name: /^Tom Whitfield, 01:00–03:30/ })).toHaveCount(0)
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('dragging a shift’s bottom edge changes when it ends', async ({ page }) => {
    const monday = await addShiftByDrag(page)
    const edge = monday.y + 3.5 * HOUR_PX - 4
    await drag(page, { x: monday.x + 40, y: edge }, { x: monday.x + 40, y: edge + HOUR_PX })

    await expect(day(page, 0).getByRole('button', { name: /^Tom Whitfield, 01:00–04:30/ })).toBeVisible()
  })

  test('Escape drops a drag', async ({ page }) => {
    const monday = await addShiftByDrag(page)
    await page.mouse.move(monday.x + 40, monday.y + 2 * HOUR_PX)
    await page.mouse.down()
    await page.mouse.move(monday.x + 40, monday.y + 5 * HOUR_PX, { steps: 4 })
    await page.keyboard.press('Escape')
    await page.mouse.up()
    await expect(day(page, 0).getByRole('button', { name: /^Tom Whitfield, 01:00–03:30/ })).toBeVisible()
  })

  test('clicking a shift opens it to change or remove', async ({ page }) => {
    await addShiftByDrag(page)
    await day(page, 0).getByRole('button', { name: /^Tom Whitfield, 01:00–03:30/ }).click()

    const dialog = page.getByRole('dialog', { name: 'Edit shift' })
    await dialog.getByLabel('End').fill('05:00')
    await dialog.getByRole('button', { name: 'Save shift' }).click()
    await expect(day(page, 0).getByRole('button', { name: /^Tom Whitfield, 01:00–05:00/ })).toBeVisible()

    await day(page, 0).getByRole('button', { name: /^Tom Whitfield, 01:00–05:00/ }).click()
    await dialog.getByRole('button', { name: 'Remove shift' }).click()
    await expect(day(page, 0).getByRole('button', { name: /^Tom Whitfield, 01:00–05:00/ })).toHaveCount(0)
  })
})
