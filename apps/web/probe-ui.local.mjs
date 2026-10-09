// Temporary UI probe (not committed): Show all → list page → scroll → Back, in 3D and list views.
import { chromium } from '@playwright/test'

const base = process.env.BASE ?? 'http://localhost:3124'
const out = process.env.OUT
const set = process.argv[2]
const card = process.argv[3]
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)) })
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
const shot = async (name) => { if (out) await page.screenshot({ path: `${out}/ui-${name}.png` }) }
const step = (msg) => console.log(`• ${msg}`)

// 3D: set focus, Show all
await page.goto(`${base}/explore?node=${encodeURIComponent(set)}`, { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)
const groups = await page.locator('#focus-panel section h3').allInnerTexts()
step(`3D panel groups: ${groups.map((g) => g.replace(/\s+/g, ' ')).join(' | ')}`)
await shot('set-panel')
await page.getByRole('button', { name: /Show all 102/ }).click()
await page.waitForURL(/panel=list/)
step(`after Show all: ${new URL(page.url()).search}`)
await page.waitForTimeout(1200)
let rows = await page.locator('#focus-panel li button.row-link').count()
step(`list rows before scroll: ${rows}`)
await page.locator('#focus-panel').evaluate((el) => el.scrollTo(0, el.scrollHeight))
await page.waitForTimeout(1500)
rows = await page.locator('#focus-panel li button.row-link').count()
step(`list rows after scroll: ${rows}`)
await shot('set-list')
await page.getByRole('button', { name: '← Back' }).click()
await page.waitForURL((u) => !u.search.includes('panel='))
step(`after Back: ${new URL(page.url()).search}`)

// browser back/forward
await page.goBack()
await page.waitForTimeout(500)
step(`browser back → ${new URL(page.url()).search}`)

// 3D: card details page
await page.goto(`${base}/explore?node=${encodeURIComponent(card)}`, { waitUntil: 'networkidle' })
await page.waitForTimeout(2000)
step(`card groups: ${(await page.locator('#focus-panel section h3').allInnerTexts()).map((g) => g.replace(/\s+/g, ' ')).join(' | ')}`)
await shot('card-panel')
await page.getByRole('button', { name: 'Details' }).click()
await page.waitForURL(/panel=details/)
step(`details: ${new URL(page.url()).search}`)
await page.getByRole('button', { name: '← Back' }).click()
await page.waitForURL((u) => !u.search.includes('panel='))
step(`details back: ${new URL(page.url()).search}`)

// Extended depth on the card: what is two steps away
await page.getByRole('button', { name: 'Extended' }).click()
await page.waitForTimeout(2500)
await shot('card-extended')
step(`HUD depth buttons: ${(await page.getByRole('button', { name: /^(Direct|Extended|Deep)$/ }).allInnerTexts()).join(', ')}`)

// list view
await page.goto(`${base}/explore?node=${encodeURIComponent(card)}&view=list&depth=2`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
step(`list view sections: ${(await page.locator('#relationship-list h3, #relationship-list h4').allInnerTexts()).map((g) => g.replace(/\s+/g, ' ')).join(' | ')}`)
await shot('card-listview')
const showAll = page.locator('#relationship-list a', { hasText: /Show all/ }).first()
if (await showAll.count()) {
  const label = await showAll.innerText()
  await showAll.click()
  await page.waitForURL(/panel=list/)
  await page.waitForTimeout(1200)
  step(`list view "${label}" → ${new URL(page.url()).search} rows=${await page.locator('#relationship-list li button.row-link').count()}`)
  await shot('listview-page')
  await page.getByRole('button', { name: '← Back' }).click()
  await page.waitForURL((u) => !u.search.includes('panel='))
  step(`list view back: ${new URL(page.url()).search}`)
} else step('list view: no Show all link')

step(`console errors: ${errors.length}`)
for (const e of [...new Set(errors)].slice(0, 10)) console.log('   ', e)
await browser.close()
