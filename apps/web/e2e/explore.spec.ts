import { expect, test, type APIRequestContext } from '@playwright/test'

async function charizardPrintingId(request: APIRequestContext): Promise<string> {
  const res = await request.get('/api/search?q=charizard&type=card_printing&limit=1')
  expect(res.ok()).toBeTruthy()
  const body = (await res.json()) as { results: Array<{ nodeId: string; title: string }> }
  expect(body.results[0]?.title).toBe('Charizard')
  return body.results[0]!.nodeId
}

test.describe('readable addresses', () => {
  test('a card slug and a source id both lead to the printing; a set slug to the set', async ({ request }) => {
    const bySlug = await request.get('/card/pokemon/charizard-base-set-4?depth=2&view=list', { maxRedirects: 0 })
    expect(bySlug.status()).toBe(302)
    const target = new URL(bySlug.headers()['location'] ?? '', 'http://127.0.0.1')
    expect(target.pathname).toBe('/explore')
    expect(target.searchParams.get('node')).toMatch(/^card_printing:/)
    expect(target.searchParams.get('depth')).toBe('2')
    expect(target.searchParams.get('view')).toBe('list')

    const byId = await request.get('/card/pokemon/base1-4', { maxRedirects: 0 })
    expect(new URL(byId.headers()['location'] ?? '', 'http://127.0.0.1').searchParams.get('node')).toBe(target.searchParams.get('node'))

    const set = await request.get('/set/pokemon/base-set', { maxRedirects: 0 })
    expect(new URL(set.headers()['location'] ?? '', 'http://127.0.0.1').searchParams.get('node')).toMatch(/^set:/)

    const missing = await request.get('/card/pokemon/nothing-here-9', { maxRedirects: 0 })
    const fallback = new URL(missing.headers()['location'] ?? '', 'http://127.0.0.1')
    expect(fallback.pathname).toBe('/explore')
    expect(fallback.searchParams.get('missing')).toBe('nothing-here-9')
  })

  test('the list view says when only the bundled set is loaded and shows element icons', async ({ page, request }) => {
    const universe = (await (await request.get('/api/graph/universe?game=pokemon')).json()) as { nodes: Array<{ nodeType: string }> }
    const sets = universe.nodes.filter((n) => n.nodeType === 'set').length
    await page.goto('/explore?view=list')
    // the note is there with the Base Set alone, and gone once a second set is loaded
    await expect(page.getByText(/Only the bundled Base Set is loaded/)).toHaveCount(sets === 1 ? 1 : 0)
    await page.getByRole('link', { name: /Base Set/ }).first().click()
    await page.getByRole('link', { name: /Charizard/ }).first().click()
    await expect(page.getByRole('region', { name: 'Details' }).locator('svg.el-fire')).toHaveCount(1)
  })
})

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
    // dates read dd-MM-yyyy everywhere, the universe included
    await expect(page.getByRole('link', { name: /Base Set · \d{2}-\d{2}-\d{4}$/ })).toBeVisible()
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
    // the set is a link in the details (no "Part of" group needed), the language has its flag,
    // and neither the "Imported" count nor the "Printing" chip is shown
    await expect(details.getByRole('link', { name: 'Base Set', exact: true })).toBeVisible()
    await expect(details.getByRole('img', { name: 'English' })).toBeVisible()
    await expect(details.getByText('EN', { exact: true })).toBeVisible()
    await expect(details.getByText('Imported')).toHaveCount(0)
    await expect(details.getByText('Printing', { exact: true })).toHaveCount(0)
    // connection groups
    await expect(page.getByRole('region', { name: 'Set' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Evolves from' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Artist' })).toBeVisible()
    // Connections are other cards, sets, the Pokémon and the artist; never an energy type, an
    // attack or an ability, not even when the Node type filter asks for attributes…
    await expect(page.getByRole('region', { name: 'Pokémon' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Type' })).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Attack' })).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Ability' })).toHaveCount(0)
    const here = new URL(page.url())
    here.searchParams.set('f.nodeType', 'card_printing,set,attribute')
    await page.goto(here.toString())
    await expect(page.getByRole('region', { name: 'Set' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Type' })).toHaveCount(0)
    // …which narrows the default instead: no Pokémon when only printings and sets are asked for.
    await expect(page.getByRole('region', { name: 'Pokémon' })).toHaveCount(0)
    here.searchParams.delete('f.nodeType')
    await page.goto(here.toString())
    // follow a connection
    await page.getByRole('region', { name: 'Set' }).getByRole('link', { name: /Base Set/ }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Base Set')
    await expect(page).toHaveURL(/node=set%3A/)
  })

  test('the cards of a set: a few in the list, every one on a page of its own, and Back returns', async ({ page, request }) => {
    const set = await request.get('/set/pokemon/base-set', { maxRedirects: 0 })
    const setUrl = new URL(set.headers()['location'] ?? '', 'http://127.0.0.1')
    setUrl.searchParams.set('view', 'list')
    await page.goto(setUrl.pathname + setUrl.search)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Base Set')
    const cards = page.getByRole('region', { name: 'Cards' })
    // No list grows in place: "Show all" opens a page with its own address.
    await expect(cards.getByText(/more$/)).toHaveCount(0)
    await cards.getByRole('link', { name: 'Show all 102 →' }).click()
    await expect(page).toHaveURL(/panel=list&rel=BELONGS_TO&dir=in/)
    const list = page.locator('#relationship-list')
    await expect(list.getByRole('heading', { level: 1 })).toHaveText('Base Set')
    // The first page, then the rest as the list scrolls.
    await expect(list.locator('button.row-link')).toHaveCount(60)
    await list.locator('button.row-link').last().scrollIntoViewIfNeeded()
    await page.locator('#relationship-list').evaluate((el) => el.scrollTo(0, el.scrollHeight))
    await expect(list.locator('button.row-link')).toHaveCount(102)
    await page.getByRole('button', { name: '← Back' }).click()
    await expect(page).not.toHaveURL(/panel=/)
    await expect(page.getByRole('region', { name: 'Cards' })).toBeVisible()
  })

  test('the connections API lists every connection of a kind, a page at a time', async ({ request }) => {
    const set = await request.get('/set/pokemon/base-set', { maxRedirects: 0 })
    const setId = new URL(set.headers()['location'] ?? '', 'http://127.0.0.1').searchParams.get('node') ?? ''
    const res = await request.get(`/api/graph/node/${encodeURIComponent(setId)}/connections?rel=BELONGS_TO&dir=in&offset=100&limit=60`)
    expect(res.ok()).toBeTruthy()
    const body = (await res.json()) as { total: number; items: Array<{ node: { metadata: { collectorNumber: string } } }> }
    expect(body.total).toBe(102)
    expect(body.items.map((i) => i.node.metadata.collectorNumber)).toEqual(['101', '102'])
    expect((await request.get(`/api/graph/node/${encodeURIComponent(setId)}/connections?rel=x;drop&dir=in`)).status()).toBe(400)
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
    // Two levels: Direct and Extended.
    expect(body.meta.depth).toBe(2)
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

test.describe('the sky (3D)', () => {
  // Regression: under the content security policy, the label text builder's worker and its font CDN
  // were blocked, and the exception blanked the whole sky.
  test('draws a card and its connections without a page error', async ({ page, request }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    const nodeId = await charizardPrintingId(request)
    await page.goto(`/explore?node=${encodeURIComponent(nodeId)}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Charizard')
    const webgl = await page.evaluate(() => Boolean(document.createElement('canvas').getContext('webgl2')))
    test.skip(!webgl, 'no WebGL in this browser: the explorer falls back to the list view')
    await expect(page.locator('canvas')).toHaveCount(1)
    // Labels are laid out on the main thread with the app's own font.
    await page.waitForResponse((r) => r.url().endsWith('/fonts/Figtree-Medium.ttf') && r.ok())
    await page.waitForTimeout(1500)
    expect(errors).toEqual([])
  })
})
