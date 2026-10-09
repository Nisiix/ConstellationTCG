import { expect, test, type APIRequestContext } from '@playwright/test'

/** Phase 2 prototypes: the thread (07) and the path between two points (08), on the Base Set fixture. */

async function nodeId(request: APIRequestContext, q: string, type: string, title: string): Promise<string> {
  const res = await request.get(`/api/search?q=${encodeURIComponent(q)}&type=${type}&limit=5`)
  expect(res.ok()).toBeTruthy()
  const body = (await res.json()) as { results: Array<{ nodeId: string; title: string }> }
  const hit = body.results.find((r) => r.title === title)
  expect(hit, `${title} in the search results`).toBeTruthy()
  return hit!.nodeId
}

test.describe('the path between two points', () => {
  test('the API answers the shortest path, deterministically, and says when there is none', async ({ request }) => {
    const charizard = await nodeId(request, 'charizard', 'card_printing', 'Charizard')
    const pikachu = await nodeId(request, 'pikachu', 'card_printing', 'Pikachu')
    const res = await request.get(`/api/graph/path?from=${encodeURIComponent(charizard)}&to=${encodeURIComponent(pikachu)}`)
    expect(res.ok()).toBeTruthy()
    const path = (await res.json()) as { found: boolean; nodes: Array<{ label: string }>; edges: Array<{ relationshipType: string }> }
    expect(path.found).toBe(true)
    expect(path.nodes.map((n) => n.label)).toEqual(['Charizard', 'Mitsuhiro Arita', 'Pikachu'])
    expect(path.edges.map((e) => e.relationshipType)).toEqual(['ILLUSTRATED_BY', 'ILLUSTRATED_BY'])

    const game = await nodeId(request, 'pokemon trading card game', 'game', 'Pokémon Trading Card Game')
    const tooFar = await request.get(`/api/graph/path?from=${encodeURIComponent(game)}&to=${encodeURIComponent(pikachu)}&max=1`)
    expect(await tooFar.json()).toMatchObject({ found: false, reason: 'too-far', maxDepth: 1 })

    expect((await request.get('/api/graph/path?from=nonsense')).status()).toBe(400)
  })

  test('/thread/<a>/<b> opens the explorer on the path, carrying only the ends and the view', async ({ request }) => {
    const charizard = await nodeId(request, 'charizard', 'card_printing', 'Charizard')
    const pikachu = await nodeId(request, 'pikachu', 'card_printing', 'Pikachu')
    const res = await request.get(`/thread/${encodeURIComponent(charizard)}/${encodeURIComponent(pikachu)}?view=list&depth=3`, { maxRedirects: 0 })
    expect(res.status()).toBe(302)
    const target = new URL(res.headers()['location'] ?? '', 'http://127.0.0.1')
    expect(target.pathname).toBe('/explore')
    expect(target.searchParams.get('path')).toBe(`${charizard},${pikachu}`)
    expect(target.searchParams.get('node')).toBe(charizard)
    expect(target.searchParams.get('view')).toBe('list')
    expect(target.searchParams.get('depth')).toBeNull()
  })

  test('Connect to… → the whole path → walk it → explore from a step (list view)', async ({ page, request }) => {
    const charizard = await nodeId(request, 'charizard', 'card_printing', 'Charizard')
    await page.goto(`/explore?view=list&node=${encodeURIComponent(charizard)}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Charizard')

    await page.getByRole('button', { name: 'Connect to…' }).click()
    await page.getByRole('combobox', { name: 'Connect Charizard to…' }).fill('Pikachu')
    await page.getByRole('option', { name: /^Pikachu Base Set/ }).click()

    const steps = page.getByRole('list', { name: 'Steps of the path' })
    await expect(steps.getByRole('button')).toHaveCount(3)
    await expect(page.getByText('Charizard — illustrated by → Mitsuhiro Arita')).toBeVisible()
    await expect(page.getByText('Mitsuhiro Arita — illustrated → Pikachu')).toBeVisible()
    await expect(steps.locator('[aria-current="step"]')).toContainText('Charizard')

    await page.getByRole('button', { name: 'Next →' }).click()
    await expect(steps.locator('[aria-current="step"]')).toContainText('Mitsuhiro Arita')
    await page.keyboard.press('ArrowRight')
    await expect(steps.locator('[aria-current="step"]')).toContainText('Pikachu')
    await expect(page.getByRole('button', { name: 'Next →' })).toBeDisabled()

    await page.getByRole('button', { name: 'Explore from here' }).click()
    await expect(page).not.toHaveURL(/path=/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pikachu')

    // The steps walked joined the thread: Charizard, Arita, Pikachu.
    await page.getByRole('button', { name: /Your thread · \d+/ }).click()
    const thread = page.getByRole('region', { name: 'Your thread' }).getByRole('listitem')
    await expect(thread).toHaveText([/Charizard/, /Mitsuhiro Arita/, /Pikachu/])
  })

  test('no path within the depth: say so and offer to search further', async ({ page, request }) => {
    const game = await nodeId(request, 'pokemon trading card game', 'game', 'Pokémon Trading Card Game')
    const pikachu = await nodeId(request, 'pikachu', 'card_printing', 'Pikachu')
    await page.goto(`/explore?view=list&path=${encodeURIComponent(`${game},${pikachu}`)}&max=1`)
    await expect(page.getByText('No path within 1 step.')).toBeVisible()
    await page.getByRole('button', { name: /Search further/ }).click()
    await expect(page).toHaveURL(/max=8/)
    await expect(page.getByRole('list', { name: 'Steps of the path' }).getByRole('button')).toHaveText([
      /Pokémon Trading Card Game/,
      /Base/,
      /Base Set/,
      /Pikachu/,
    ])
  })
})

test.describe('the thread', () => {
  test('three moves, then back along the thread from the panel', async ({ page, request }) => {
    const charizard = await nodeId(request, 'charizard', 'card_printing', 'Charizard')
    await page.goto(`/explore?view=list&node=${encodeURIComponent(charizard)}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Charizard')

    // Charizard → its artist → one of the artist's cards → that card's set.
    await page.getByRole('link', { name: /Mitsuhiro Arita/ }).first().click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mitsuhiro Arita')
    await page.getByRole('link', { name: /^Pikachu/ }).first().click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pikachu')
    await page.getByRole('link', { name: /^Base Set/ }).first().click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Base Set')

    await page.getByRole('button', { name: 'Your thread · 4' }).click()
    const thread = page.getByRole('region', { name: 'Your thread' }).getByRole('listitem')
    await expect(thread).toHaveText([/Charizard/, /Mitsuhiro Arita/, /Pikachu/, /Base Set/])

    // Back to the first step: the focus returns there and the thread grows (it never resets).
    await thread.first().getByRole('button').click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Charizard')
    await expect(page.getByRole('button', { name: 'Your thread · 5' })).toBeVisible()

    // Depth and filters leave the thread alone.
    await page.getByRole('button', { name: 'Extended' }).click()
    await expect(page).toHaveURL(/depth=2/)
    await expect(page.getByRole('button', { name: 'Your thread · 5' })).toBeVisible()

    // It survives a reload of the tab (session only).
    await page.reload()
    await expect(page.getByRole('button', { name: 'Your thread · 5' })).toBeVisible()
  })
})
