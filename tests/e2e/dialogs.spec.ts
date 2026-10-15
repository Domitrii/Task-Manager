import { expect, test, type Page } from '@playwright/test'
import { openDemo, openTab, visit } from './app.ts'
import { expectToFitScreen, watchForErrors } from './layout.ts'

/** The first one of these on screen: tables and their phone lists both exist, one hidden. */
const visible = (page: Page, name: string | RegExp) =>
  page.getByRole('button', { name }).filter({ visible: true }).first()

async function settingsTab(page: Page, tab: string) {
  await visit(page, '/settings')
  await openTab(page, tab)
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
    name: 'more menu',
    phonesOnly: true,
    open: async (page) => {
      await visit(page, '/')
      await visible(page, 'More').click()
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
      await visit(page, '/deliveries')
      await visible(page, 'Record delivery').click()
      await page.locator('#delivery-supplier').click()
      await expect(page.getByRole('listbox')).toBeVisible()
    },
  },
  {
    name: 'delivery details',
    open: async (page) => {
      await visit(page, '/deliveries')
      await page.locator('tbody tr, li > button').filter({ visible: true }).first().click()
    },
  },
  {
    name: 'log a reading',
    open: async (page) => {
      await visit(page, '/temperatures')
      await visible(page, 'Log a reading').click()
    },
  },
  {
    name: 'change a reading',
    open: async (page) => {
      await visit(page, '/temperatures')
      await openTab(page, 'History')
      await visible(page, 'Change this reading').click()
    },
  },
  {
    name: 'equipment QR code',
    open: async (page) => {
      await visit(page, '/temperatures')
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
      await visible(page, 'Raise an issue').click()
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
      await visit(page, '/stock')
      await visible(page, 'Count').click()
    },
  },
  {
    name: 'delete a stock item',
    open: async (page) => {
      await visit(page, '/stock')
      await visible(page, /^Delete /).click()
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
