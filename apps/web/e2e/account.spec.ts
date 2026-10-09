import { expect, test } from '@playwright/test'

/**
 * My Constellation without a Supabase project configured (the e2e server has no account env):
 * exploration is untouched, the account routes answer honestly, the panel explains itself.
 */
test.describe('accounts and ownership (unconfigured deployment)', () => {
  test('the account route reports the state and lists providers; private routes refuse politely', async ({
    request,
  }) => {
    const account = await request.get('/api/account')
    expect(account.ok()).toBe(true)
    const body = (await account.json()) as {
      configured: boolean
      user: unknown
      providers: Array<{ id: string; availability: { available: boolean } }>
    }
    expect(body.configured).toBe(false)
    expect(body.user).toBeNull()
    expect(body.providers.map((p) => p.id)).toEqual(['evm', 'solana', 'manual'])
    expect(body.providers.find((p) => p.id === 'evm')?.availability.available).toBe(true)

    const wallets = await request.get('/api/wallets')
    expect(wallets.status()).toBe(503)
    const ownership = await request.get('/api/ownership')
    expect(ownership.status()).toBe(503)
    const declare = await request.post('/api/ownership/manual', {
      data: { printing: 'card_printing:x' },
    })
    expect(declare.status()).toBe(503)
  })

  test('the My Constellation panel opens from the top bar and says accounts are not set up', async ({
    page,
  }) => {
    await page.goto('/explore?view=list')
    await page.getByRole('button', { name: /My Constellation/ }).click()
    const dialog = page.getByRole('dialog', { name: 'My Constellation' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Accounts are not set up on this deployment.')).toBeVisible()
    await expect(dialog.getByText(/no prices here/)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
  })
})
