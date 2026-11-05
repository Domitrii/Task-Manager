import { expect, test, type Page } from '@playwright/test'
import { openDemo, openTab, todayAt, visit } from './app.ts'
import { expectToFitScreen, watchForErrors } from './layout.ts'

/** The first one of these on screen: tables and their phone lists both exist, one hidden. */
const visible = (page: Page, name: string | RegExp) =>
  page.getByRole('button', { name }).filter({ visible: true }).first()

async function settingsTab(page: Page, tab: string) {
  await visit(page, '/settings/manage')
  await openTab(page, tab)
}

async function firstStockItem(page: Page) {
  await visit(page, '/stock')
  await page.locator('a[href^="/stock/"]').first().click()
  await expect(page.getByRole('heading', { name: 'Stock item' })).toBeVisible()
}

const DIALOGS: Array<{ name: string; open: (page: Page) => Promise<void>; phonesOnly?: boolean }> = [
  {
    name: 'quick log sheet',
    open: async (page) => {
      await visit(page, '/')
      await visible(page, /^Log( something)?$/).click()
    },
  },
  {
    name: 'search',
    open: async (page) => {
      await visit(page, '/')
      await page.keyboard.press('ControlOrMeta+k')
    },
  },
  {
    name: 'record a delivery, with the supplier list open',
    open: async (page) => {
      await visit(page, '/deliveries/records')
      await visible(page, 'Record delivery').click()
      await page.locator('#delivery-supplier').click()
      await expect(page.getByRole('listbox')).toBeVisible()
    },
  },
  {
    name: 'delivery details',
    open: async (page) => {
      await visit(page, '/deliveries/records')
      await openTab(page, 'All deliveries')
      // Past the orders waiting at the top, to the deliveries themselves.
      await page
        .locator('tbody tr, li > button')
        .filter({ visible: true })
        .filter({ hasNotText: /Due today|Overdue/ })
        .first()
        .click()
    },
  },
  {
    name: 'delivery checked in against an order, with discrepancies',
    open: async (page) => {
      await visit(page, '/deliveries/records')
      await openTab(page, 'All deliveries')
      await page.locator('tbody tr, li > button').filter({ visible: true }).filter({ hasText: 'Discrepancies' }).first().click()
    },
  },
  {
    name: 'check in an order',
    open: async (page) => {
      await visit(page, '/deliveries/records')
      await visible(page, /^Check in$/).click()
    },
  },
  {
    name: 'check in, with an item open and an extra added',
    open: async (page) => {
      await visit(page, '/deliveries/records')
      await visible(page, /^Check in$/).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByRole('button', { name: 'Mark all received' }).click()
      await dialog.getByRole('button', { name: /^Show details for/ }).first().click()
      await dialog.getByRole('button', { name: 'Add extra item' }).click()
    },
  },
  {
    name: 'move a delivery date',
    open: async (page) => {
      await visit(page, '/deliveries/records')
      await visible(page, 'Move delivery date').click()
    },
  },
  {
    name: 'cancel an order',
    open: async (page) => {
      await visit(page, '/deliveries/records')
      await visible(page, /^Cancel$/).click()
    },
  },
  {
    name: 'new order, with a remembered price',
    open: async (page) => {
      await visit(page, '/suppliers/orders')
      await visible(page, 'New order').click()
      const dialog = page.getByRole('dialog')
      await dialog.getByLabel('Supplier').selectOption({ label: 'Harrow & Sons Butchers' })
      await dialog.getByPlaceholder('e.g. Chicken breast, skin-on').fill('Beef mince 20%')
    },
  },
  {
    name: 'edit an order',
    open: async (page) => {
      await visit(page, '/suppliers/orders')
      await visible(page, 'Edit order').click()
    },
  },
  {
    name: 'repeat an order',
    open: async (page) => {
      await visit(page, '/suppliers/orders')
      await visible(page, 'Repeat this order').click()
    },
  },
  {
    name: 'order details',
    open: async (page) => {
      await visit(page, '/suppliers/orders')
      await visible(page, /^Delivered .*Discrepancies/).click()
    },
  },
  {
    name: 'a supplier’s past orders',
    open: async (page) => {
      await visit(page, '/suppliers/orders')
      await visible(page, /^All \d+ past orders/).click()
    },
  },
  {
    name: 'today’s progress',
    open: async (page) => {
      await visit(page, '/')
      await page.getByRole('button', { name: /Show who did what/ }).click()
    },
  },
  {
    name: 'log a reading',
    open: async (page) => {
      await visit(page, '/temperatures/records')
      await visible(page, 'Log a reading').click()
    },
  },
  {
    name: 'change a reading',
    open: async (page) => {
      await visit(page, '/temperatures/records')
      await openTab(page, 'History')
      await visible(page, 'Change this reading').click()
    },
  },
  {
    name: 'equipment QR code',
    open: async (page) => {
      await visit(page, '/temperatures/records')
      await visible(page, /^Show QR for/).click()
    },
  },
  {
    name: 'start a checklist',
    open: async (page) => {
      await visit(page, '/checklists')
      await visible(page, 'Start checklist').click()
    },
  },
  {
    name: 'new task',
    open: async (page) => {
      await visit(page, '/tasks')
      await visible(page, 'New task').click()
    },
  },
  {
    name: 'raise an issue',
    open: async (page) => {
      await visit(page, '/food-safety')
      await visible(page, 'Report issue').click()
    },
  },
  {
    name: 'add a stock item',
    open: async (page) => {
      await visit(page, '/stock')
      await visible(page, 'Add item').click()
    },
  },
  {
    name: 'count stock',
    open: async (page) => {
      await firstStockItem(page)
      await visible(page, 'Count').click()
    },
  },
  {
    name: 'delete a stock item',
    open: async (page) => {
      await firstStockItem(page)
      await visible(page, /^Delete /).click()
    },
  },
  {
    name: 'add an appliance, with its mistakes showing',
    open: async (page) => {
      await visit(page, '/temperatures')
      await visible(page, 'Add appliance').click()
      await visible(page, 'Save appliance').click()
    },
  },
  {
    name: 'add a stock item, with its mistakes showing',
    open: async (page) => {
      await visit(page, '/stock')
      await visible(page, 'Add item').click()
      await visible(page, 'Save item').click()
    },
  },
  {
    name: 'add a supplier, from the list',
    open: async (page) => {
      await visit(page, '/suppliers')
      await visible(page, 'Add supplier').click()
    },
  },
  {
    name: 'invite someone, with mistakes showing',
    open: async (page) => {
      await visit(page, '/team')
      await visible(page, 'Invite member').click()
      await visible(page, 'Send invitation').click()
    },
  },
  {
    name: 'check in from a delivery’s page',
    open: async (page) => {
      await visit(page, '/deliveries')
      await page.locator('a[href^="/deliveries/order/"]').first().click()
      await visible(page, /^Check in$/).click()
    },
  },
  {
    name: 'add unavailability',
    open: async (page) => {
      await visit(page, '/calendar')
      await visible(page, /^Calendar$/).click()
      await visible(page, 'Add unavailability').click()
    },
  },
  {
    name: 'clock in',
    open: async (page) => {
      await page.clock.install({ time: todayAt('12:00') })
      await visit(page, '/calendar')
      await visible(page, 'Clock in').click()
    },
  },
  {
    name: 'add a shift',
    open: async (page) => {
      await visit(page, '/calendar')
      await visible(page, 'Add shift').click()
    },
  },
  {
    name: 'create a group',
    open: async (page) => {
      await visit(page, '/tasks')
      await visible(page, 'More actions').click()
      await visible(page, 'Create new group').click()
    },
  },
  {
    name: 'add a supplier',
    open: async (page) => {
      await settingsTab(page, 'Suppliers')
      await visible(page, 'Add supplier').click()
    },
  },
  {
    name: 'edit a supplier',
    open: async (page) => {
      await settingsTab(page, 'Suppliers')
      await visible(page, 'Edit supplier').click()
    },
  },
  {
    name: 'add equipment',
    open: async (page) => {
      await settingsTab(page, 'Equipment')
      await visible(page, 'Add equipment').click()
    },
  },
  {
    name: 'edit equipment',
    open: async (page) => {
      await settingsTab(page, 'Equipment')
      await visible(page, 'Edit equipment').click()
    },
  },
]

test.describe('dialogs', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page)
  })

  for (const dialog of DIALOGS) {
    test(`${dialog.name} fits`, async ({ page, viewport }) => {
      test.skip(Boolean(dialog.phonesOnly) && (viewport?.width ?? 0) >= 1024, 'Only on phones and tablets')
      const errors = watchForErrors(page)
      await dialog.open(page)
      await expect(page.getByRole('dialog').last()).toBeVisible()
      await expectToFitScreen(page)
      expect(errors).toEqual([])
    })
  }

  test('person switcher fits', async ({ page }) => {
    await visit(page, '/')
    await page.getByRole('button', { name: /Switch person/ }).click()
    await expectToFitScreen(page)
  })
})
