// Temporary diagnostic probe (not committed): opens explorer URLs, logs errors, takes screenshots.
import { chromium } from '@playwright/test'

const base = process.env.BASE ?? 'http://localhost:3123'
const out = process.env.OUT
const urls = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[console.${m.type()}]`, m.text().slice(0, 600)) })
page.on('pageerror', (e) => console.log('[pageerror]', e.message, '\n', (e.stack ?? '').split('\n').slice(0, 8).join('\n')))
page.on('requestfailed', (r) => console.log('[requestfailed]', r.url(), r.failure()?.errorText))
page.on('response', (r) => { if (r.status() >= 400) console.log('[http]', r.status(), r.url()) })
let i = 0
for (const u of urls) {
  console.log('=== ', u)
  await page.goto(base + u, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => console.log('[goto]', e.message))
  await page.waitForTimeout(Number(process.env.WAIT ?? 4000))
  const text = await page.locator('[role=alert], .error-state').allInnerTexts().catch(() => [])
  if (text.length) console.log('[alert]', text.join(' | '))
  const webgl = await page.evaluate(() => { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')) })
  console.log('[webgl]', webgl, '[canvas]', await page.locator('canvas').count())
  if (out) await page.screenshot({ path: `${out}/shot-${i++}.png` })
}
await browser.close()
