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
    await page.getByRole('option', { name: /^Pikachu Base Set · 58/ }).click()

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

/** Printings whose subtitle starts with the set's name ("Base Set 2 · 4/130"). */
async function printingIn(request: APIRequestContext, q: string, title: string, setName: string): Promise<string | null> {
  const res = await request.get(`/api/search?q=${encodeURIComponent(q)}&type=card_printing&limit=12`)
  const body = (await res.json()) as { results: Array<{ nodeId: string; title: string; subtitle?: string }> }
  const hit = body.results.find((r) => r.title === title && (r.subtitle ?? '').startsWith(`${setName} ·`))
  return hit?.nodeId ?? null
}

/**
 * Ticket 09: paths across sets need the Base Set 2 fixture, committed from a machine with network.
 * TCGdex numbers it `base4` (`base2` is Jungle, which has no reprint of Base Set).
 */
test.describe('paths across sets (Base Set + Base Set 2)', () => {
  test.beforeEach(async ({ request }) => {
    const universe = (await (await request.get('/api/graph/universe?game=pokemon')).json()) as { nodes: Array<{ nodeType: string; label: string }> }
    const sets = universe.nodes.filter((n) => n.nodeType === 'set').map((n) => n.label)
    test.skip(!sets.includes('Base Set 2'), 'Base Set 2 fixture not committed: pnpm --filter @constellation/adapter-pokemon fixture:refresh base4')
  })

  test('a reprint is one step: Charizard (Base Set) → Charizard (Base Set 2)', async ({ request }) => {
    const first = await printingIn(request, 'charizard', 'Charizard', 'Base Set')
    const reprint = await printingIn(request, 'charizard', 'Charizard', 'Base Set 2')
    expect(first && reprint).toBeTruthy()
    const res = await request.get(`/api/graph/path?from=${encodeURIComponent(first!)}&to=${encodeURIComponent(reprint!)}`)
    const path = (await res.json()) as { found: boolean; edges: Array<{ relationshipType: string }> }
    expect(path.found).toBe(true)
    expect(path.edges.map((e) => e.relationshipType)).toEqual(['REPRINT_OF'])
  })

  test('two cards of different sets: the path is found, readable and walkable', async ({ page, request }) => {
    const from = await printingIn(request, 'pikachu', 'Pikachu', 'Base Set')
    const to = await printingIn(request, 'blastoise', 'Blastoise', 'Base Set 2')
    expect(from && to).toBeTruthy()
    const started = Date.now()
    const res = await request.get(`/api/graph/path?from=${encodeURIComponent(from!)}&to=${encodeURIComponent(to!)}`)
    const elapsed = Date.now() - started
    const path = (await res.json()) as {
      found: boolean
      nodes: Array<{ id: string; label: string; subtitle: string | null }>
      edges: Array<{ sourceNodeId: string; targetNodeId: string }>
    }
    expect(path.found).toBe(true)
    expect(path.edges.length).toBeLessThanOrEqual(6)
    path.edges.forEach((edge, i) => {
      expect([edge.sourceNodeId, edge.targetNodeId].sort()).toEqual([path.nodes[i]!.id, path.nodes[i + 1]!.id].sort())
    })
    // accepted limit (ticket 09): 3 s cold, request included
    expect(elapsed).toBeLessThan(3000)

    await page.goto(`/thread/${encodeURIComponent(from!)}/${encodeURIComponent(to!)}?view=list`)
    const steps = page.getByRole('list', { name: 'Steps of the path' })
    await expect(steps.getByRole('button')).toHaveCount(path.nodes.length)
    await expect(page.getByTestId('path-step-label')).toHaveCount(path.edges.length)
    for (let i = 1; i < path.nodes.length; i += 1) {
      await page.keyboard.press('ArrowRight')
      await expect(steps.locator('[aria-current="step"]')).toContainText(path.nodes[i]!.label)
    }
    await expect(steps.locator('[aria-current="step"]')).toContainText('Blastoise')
  })
})

test.describe('the thread', () => {
  test('three moves, then back along the thread from the panel', async ({ page, request }) => {
    const charizard = await nodeId(request, 'charizard', 'card_printing', 'Charizard')
    await page.goto(`/explore?view=list&node=${encodeURIComponent(charizard)}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Charizard')

    // Charizard → its artist → one of the artist's cards → that card's set. Charmander is printed in
    // Base Set only and stays among the artist's first chips whether or not Base Set 2 is loaded
    // (with it, the artist has 38 illustrations and the list shows the first 24).
    await page.getByRole('link', { name: /Mitsuhiro Arita/ }).first().click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mitsuhiro Arita')
    await page.getByRole('link', { name: /^Charmander/ }).first().click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Charmander')
    await page.getByRole('link', { name: 'Base Set', exact: true }).first().click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Base Set')

    await page.getByRole('button', { name: 'Your thread · 4' }).click()
    const thread = page.getByRole('region', { name: 'Your thread' }).getByRole('listitem')
    await expect(thread).toHaveText([/Charizard/, /Mitsuhiro Arita/, /Charmander/, /Base Set/])

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

test.describe('walking the thread with the keyboard', () => {
  test('[ and ] move back and forth along the thread without adding steps', async ({ page, request }) => {
    const charizard = await nodeId(request, 'charizard', 'card_printing', 'Charizard')
    await page.goto(`/explore?view=list&node=${encodeURIComponent(charizard)}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Charizard')
    await page.getByRole('link', { name: /Mitsuhiro Arita/ }).first().click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mitsuhiro Arita')
    await page.getByRole('link', { name: /^Charmander/ }).first().click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Charmander')
    await expect(page.getByRole('button', { name: 'Your thread · 3' })).toBeVisible()

    await page.locator('body').click({ position: { x: 5, y: 300 } })
    await page.keyboard.press('[')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mitsuhiro Arita')
    await page.keyboard.press('[')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Charizard')
    // nowhere further back: the focus stays
    await page.keyboard.press('[')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Charizard')
    await expect(page.getByRole('button', { name: 'Your thread · 3' })).toBeVisible()

    await page.getByRole('button', { name: 'Your thread · 3' }).click()
    const steps = page.getByRole('region', { name: 'Your thread' })
    await expect(steps.locator('[aria-current="step"]')).toContainText('Charizard')

    await page.keyboard.press(']')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mitsuhiro Arita')
    await expect(steps.locator('[aria-current="step"]')).toContainText('Mitsuhiro Arita')
    await page.keyboard.press(']')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Charmander')
    await expect(page.getByRole('button', { name: 'Your thread · 3' })).toBeVisible()

    // A new focus after walking adds a step again.
    await page.getByRole('link', { name: 'Base Set', exact: true }).first().click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Base Set')
    await expect(page.getByRole('button', { name: 'Your thread · 4' })).toBeVisible()
  })
})
