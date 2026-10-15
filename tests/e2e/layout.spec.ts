import { expect, test } from '@playwright/test'
import { layoutProblems } from './layout.ts'

// The checker itself: if it stopped noticing problems, every other test would pass for nothing.
test.describe('the layout check', () => {
  test.skip(({ viewport }) => viewport?.width !== 360, 'Once, at phone size, is enough')

  const page = (body: string) => `<!doctype html><meta name="viewport" content="width=device-width"><body style="margin:0">${body}</body>`

  test('passes a page that fits', async ({ page: tab }) => {
    await tab.setContent(page('<p>Short</p><div class="scrollbar-none" style="overflow-x:auto"><div style="width:900px"><button>Chip</button></div></div>'))
    expect(await layoutProblems(tab)).toEqual([])
  })

  test('catches a page that scrolls sideways', async ({ page: tab }) => {
    await tab.setContent(page('<div style="width:900px">Too wide</div>'))
    const problems = await layoutProblems(tab)
    expect(problems.join('\n')).toContain('the page scrolls sideways')
    expect(problems.join('\n')).toContain('sticks out of the screen')
  })

  test('catches a button hidden in a sideways-scrolling table', async ({ page: tab }) => {
    await tab.setContent(page('<div style="overflow-x:auto"><table style="width:900px"><tr><td>Name</td><td style="text-align:right"><button>Edit</button></td></tr></table></div>'))
    expect((await layoutProblems(tab)).join('\n')).toMatch(/out of sight, e\.g\. <button> "Edit"/)
  })

  test('catches content cut off by a container', async ({ page: tab }) => {
    await tab.setContent(page('<section style="overflow:hidden"><div style="width:900px">Cut</div></section>'))
    expect((await layoutProblems(tab)).join('\n')).toContain('is cut off by')
  })

  test('lets text end in an ellipsis on purpose', async ({ page: tab }) => {
    await tab.setContent(page('<p style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + 'Long name '.repeat(40) + '</p>'))
    expect(await layoutProblems(tab)).toEqual([])
  })
})
