import { expect, test, type APIRequestContext } from '@playwright/test'

async function charizardPrintingId(request: APIRequestContext): Promise<string> {
  const res = await request.get('/api/search?q=charizard&type=card_printing&limit=1')
  expect(res.ok()).toBeTruthy()
  const body = (await res.json()) as { results: Array<{ nodeId: string; title: string }> }
  expect(body.results[0]?.title).toBe('Charizard')
  return body.results[0]!.nodeId
}

test.describe('exploring (list view, no WebGL needed)', () => {
  test('the universe lists the series and its sets, newest first', async ({ page, request }) => {
    const res = await request.get('/api/graph/universe?game=pokemon')
    expect(res.ok()).toBeTruthy()
    const universe = (await res.json()) as { nodes: Array<{ nodeType: string; label: string; metadata: Record<string, unknown> }> }
    const sets = universe.nodes.filter((n) => n.nodeType === 'set')
    const dates = sets.map((n) => String(n.metadata.releaseDate ?? ''))
    expect([...dates].sort().reverse()).toEqual(dates)

    await page.goto('/explore?view=list')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Pokémon/)
    await expect(page.getByRole('link', { name: /Base Set/ }).first()).toBeVisible()
  })

  test('search → focus a card → read its connections and other printings', async ({ page, request }) => {
    const nodeId = await charizardPrintingId(request)
    await page.goto(`/explore?view=list&node=${encodeURIComponent(nodeId)}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Charizard')
    await expect(page.getByText('Base Set · 4/102')).toBeVisible()
    // details: relationships and kinds, but no card statistics
    const details = page.getByRole('region', { name: 'Details' })
    await expect(details.getByText('Rare')).toBeVisible()
    await expect(details.getByText('HP', { exact: true })).toHaveCount(0)
    // connection groups
    await expect(page.getByRole('region', { name: 'Set' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Artist' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Evolves from' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Attack' })).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Ability' })).toHaveCount(0)
    // follow a connection
    await page.getByRole('region', { name: 'Set' }).getByRole('link', { name: /Base Set/ }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Base Set')
    await expect(page).toHaveURL(/node=set%3A/)
  })

  test('the search box finds cards, sets and artists', async ({ page }) => {
    await page.goto('/explore?view=list')
    const box = page.getByRole('combobox', { name: /Search a card/ })
    await box.fill('arita')
    const results = page.getByRole('listbox')
    await expect(results.getByRole('option', { name: /Mitsuhiro Arita/ })).toBeVisible()
    await box.fill('base set')
    await expect(results.getByRole('option', { name: /Base Set/ }).first()).toBeVisible()
  })

  test('the focus API bounds depth, reports a summary and is cached', async ({ request }) => {
    const nodeId = await charizardPrintingId(request)
    const res = await request.get(`/api/graph/focus/${encodeURIComponent(nodeId)}?depth=9`)
    expect(res.ok()).toBeTruthy()
    expect(res.headers()['cache-control']).toContain('public')
    expect(res.headers()['server-timing']).toContain('app;dur=')
    const body = (await res.json()) as { meta: { depth: number }; summary: Array<{ relationshipType: string }>; nodes: unknown[] }
    expect(body.meta.depth).toBe(3)
    expect(body.summary.some((s) => s.relationshipType === 'BELONGS_TO')).toBeTruthy()
    expect(body.summary.some((s) => s.relationshipType === 'HAS_ATTACK')).toBeFalsy()
    expect(body.summary.some((s) => s.relationshipType === 'HAS_ABILITY')).toBeFalsy()
  })

  test('the API answers 429 to a burst beyond the limit', async ({ request }) => {
    const statuses: number[] = []
    for (let i = 0; i < 80; i += 1) {
      const res = await request.get('/api/filters?game=pokemon')
      statuses.push(res.status())
    }
    expect(statuses).toContain(429)
    expect(statuses[0]).toBe(200)
  })
})
