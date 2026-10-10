import { expect, test, type APIRequestContext } from '@playwright/test'

/** The sky in time, the genealogy of a Pokémon and the landmarks, on the Base Set + Jungle fixtures. */

async function nodeId(request: APIRequestContext, q: string, type: string, title: string): Promise<string> {
  const res = await request.get(`/api/search?q=${encodeURIComponent(q)}&type=${type}&limit=5`)
  expect(res.ok()).toBeTruthy()
  const body = (await res.json()) as { results: Array<{ nodeId: string; title: string }> }
  const hit = body.results.find((r) => r.title === title)
  expect(hit, `${title} in the search results`).toBeTruthy()
  return hit!.nodeId
}

test.describe('genealogy', () => {
  test('the API answers the evolution line, the eras and the artists, from a Pokémon or from a card', async ({ request }) => {
    const charmeleon = await nodeId(request, 'charmeleon', 'pokemon', 'Charmeleon')
    const res = await request.get(`/api/graph/lineage/${encodeURIComponent(charmeleon)}`)
    expect(res.ok()).toBeTruthy()
    const lineage = (await res.json()) as {
      subject: { label: string }
      family: Array<{ node: { label: string }; stage: number }>
      eras: Array<{ sets: Array<{ set: { label: string } }> }>
      artists: Array<{ node: { label: string } }>
    }
    expect(lineage.subject.label).toBe('Charmeleon')
    expect(lineage.family.map((m) => m.node.label)).toEqual(['Charmander', 'Charmeleon', 'Charizard'])
    expect(lineage.eras[0]?.sets[0]?.set.label).toBe('Base Set')
    expect(lineage.artists.length).toBeGreaterThan(0)

    const card = await nodeId(request, 'charizard', 'card_printing', 'Charizard')
    const fromCard = (await (await request.get(`/api/graph/lineage/${encodeURIComponent(card)}`)).json()) as { subject: { label: string; nodeType: string } }
    expect(fromCard.subject).toMatchObject({ label: 'Charizard', nodeType: 'pokemon' })

    const set = await nodeId(request, 'base set', 'set', 'Base Set')
    expect((await request.get(`/api/graph/lineage/${encodeURIComponent(set)}`)).status()).toBe(400)
    expect((await request.get('/api/graph/lineage/nonsense')).status()).toBe(400)
  })

  test('Genealogy from a card → the line along time → another member → back to the sky (list view)', async ({ page, request }) => {
    const pikachu = await nodeId(request, 'pikachu', 'card_printing', 'Pikachu')
    await page.goto(`/explore?view=list&node=${encodeURIComponent(pikachu)}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pikachu')

    await page.getByRole('link', { name: 'Genealogy' }).click()
    await expect(page).toHaveURL(/lens=lineage/)
    const genealogy = page.locator('#lineage-page')
    await expect(genealogy.getByRole('heading', { level: 1 })).toHaveText('Pikachu')
    await expect(page.getByTestId('lineage-summary')).toContainText('2 printings in 2 expansions')
    // Newest first: Jungle, then Base Set.
    const sets = genealogy.getByRole('region', { name: 'Along time' }).locator('li a[data-node-id]')
    await expect(sets).toHaveCount(2)
    await expect(sets.nth(0)).toContainText('Jungle')
    await expect(sets.nth(1)).toContainText('Base Set')

    const line = genealogy.getByRole('region', { name: 'Who' }).getByRole('region', { name: 'Evolution line' })
    await expect(line.locator('[aria-current="true"]')).toHaveText(/Pikachu/)
    await line.getByRole('link', { name: /Raichu/ }).click()
    await expect(genealogy.getByRole('heading', { level: 1 })).toHaveText('Raichu')

    await genealogy.getByRole('button', { name: '← Back to the sky' }).first().click()
    await expect(page).not.toHaveURL(/lens=/)
    await expect(page.locator('#relationship-list')).toBeVisible()
  })
})

test.describe('landmarks', () => {
  test('the API names the landmarks with their reasons', async ({ request }) => {
    const res = await request.get('/api/graph/landmarks?game=pokemon')
    expect(res.ok()).toBeTruthy()
    const body = (await res.json()) as { categories: Array<{ id: string; items: Array<{ node: { label: string }; reason: string }> }> }
    const eras = body.categories.find((c) => c.id === 'eras')
    expect(eras?.items[0]?.node.label).toBe('Base Set')
    expect(eras?.items[0]?.reason).toMatch(/^Opened /)
    expect(body.categories.find((c) => c.id === 'subjects')?.items.map((i) => i.node.label)).toContain('Pikachu')
    expect((await request.get('/api/graph/landmarks?game=nope')).status()).toBe(404)
  })

  test('Landmarks from the bottom bar → a landmark → its sky (list view)', async ({ page }) => {
    await page.goto('/explore?view=list')
    await page.getByRole('button', { name: /Landmarks/ }).first().click()
    await expect(page).toHaveURL(/lens=landmarks/)
    const landmarks = page.locator('#landmarks-page')
    await expect(landmarks.getByRole('heading', { level: 1 })).toHaveText('Landmarks')
    const eras = landmarks.getByRole('region', { name: 'Where each era began' })
    await expect(eras.getByText(/Opened .+ in 1999/)).toBeVisible()
    await eras.getByRole('link', { name: /Base Set/ }).click()
    await expect(page).not.toHaveURL(/lens=/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Base Set')
  })
})

test.describe('the sky in time', () => {
  test('Time shows the sky at the end of a year, marks what is new, and goes back to all of time (list view)', async ({ page }) => {
    await page.goto('/explore?view=list')
    await expect(page.getByRole('region', { name: 'Series and sets' })).toBeVisible()
    await page.getByRole('button', { name: /^Time$/ }).click()
    await expect(page).toHaveURL(/year=1999/)
    const bar = page.getByRole('region', { name: 'Time', exact: true })
    await expect(bar.getByTestId('time-year')).toHaveText('1999')
    const fresh = page.getByRole('region', { name: 'New in 1999' })
    await expect(fresh.getByRole('link', { name: /Base Set/ })).toBeVisible()
    await expect(fresh.getByRole('link', { name: /Jungle/ })).toBeVisible()

    // Before anything came out, the sky is empty but for the game; a shared link carries the year.
    await page.goto('/explore?view=list&year=1995')
    await expect(page.getByRole('region', { name: 'New in 1995' })).toContainText('No new expansion that year.')
    await expect(page.getByRole('region', { name: 'Series and sets' }).getByRole('link', { name: /Base Set/ })).toHaveCount(0)

    await page.getByRole('button', { name: 'All of time' }).click()
    await expect(page).not.toHaveURL(/year=/)
    await expect(page.getByRole('region', { name: 'Time', exact: true })).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Series and sets' }).getByRole('link', { name: /Base Set/ }).first()).toBeVisible()
  })
})

test.describe('the dedicated views in the sky (3D)', () => {
  test('a genealogy and the landmarks are drawn in the sky, with their panel; T plays the years', async ({ page, request }) => {
    const charmeleon = await nodeId(request, 'charmeleon', 'pokemon', 'Charmeleon')
    await page.goto(`/explore?view=3d&lens=lineage&node=${encodeURIComponent(charmeleon)}`)
    const webgl = await page.evaluate(() => Boolean(document.createElement('canvas').getContext('webgl2')))
    test.skip(!webgl, 'no WebGL in this browser: the explorer falls back to the list view')
    await expect(page.locator('canvas')).toHaveCount(1)
    const panel = page.locator('#lineage-panel')
    await expect(panel.getByRole('heading', { level: 1 })).toHaveText('Charmeleon')
    await expect(panel.getByRole('region', { name: 'Evolution line' }).getByRole('link')).toHaveCount(3)

    await page.keyboard.press('t')
    await expect(page).toHaveURL(/year=1999/)
    await expect(page.getByRole('region', { name: 'Time', exact: true })).toBeVisible()
    await page.keyboard.press('t')
    await expect(page).not.toHaveURL(/year=/)

    await page.getByRole('button', { name: /Landmarks/ }).click()
    await expect(page.locator('#landmarks-panel').getByRole('heading', { level: 1 })).toHaveText('Landmarks')
    await expect(page.locator('canvas')).toHaveCount(1)
  })
})
