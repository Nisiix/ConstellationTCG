import { expect, test } from '@playwright/test'

test.describe('site pages', () => {
  test('landing has the Home · Help · Explore menu and leads to the explorer', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Constellation TCG/)
    const nav = page.getByRole('navigation', { name: 'Main' })
    await expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
    await expect(nav.getByRole('link', { name: 'Help' })).toBeVisible()
    await nav.getByRole('link', { name: 'Explore' }).click()
    await expect(page).toHaveURL(/\/explore/)
  })

  test('help page explains the connections and lists shortcuts without a command palette', async ({ page }) => {
    await page.goto('/help')
    await expect(page.getByRole('heading', { name: 'Reading the connections' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Keyboard' })).toBeVisible()
    await expect(page.getByText('Commands', { exact: true })).toHaveCount(0)
  })

  test('the color mode toggle is remembered across pages', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark')
    await page.getByRole('button', { name: 'Switch to light mode' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'light')
    await page.goto('/help')
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'light')
  })
})
