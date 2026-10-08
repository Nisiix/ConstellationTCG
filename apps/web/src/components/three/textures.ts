'use client'

import { useEffect, useState } from 'react'
import * as THREE from 'three'
import type { GraphNode } from '@constellation/domain'

/**
 * Small texture manager for node images: limited concurrency, an LRU with disposal, and
 * low-resolution variants so a set with 200 cards stays light.
 */
const MAX_CACHED = 420
const CONCURRENCY = 6

interface Entry {
  texture: THREE.Texture | null
  promise: Promise<THREE.Texture>
  lastUsed: number
}

const cache = new Map<string, Entry>()
const loader = new THREE.TextureLoader()
loader.setCrossOrigin('anonymous')
let inFlight = 0
const queue: Array<() => void> = []

function pump() {
  while (inFlight < CONCURRENCY && queue.length > 0) {
    const next = queue.shift()
    if (next) next()
  }
}

function evict() {
  if (cache.size <= MAX_CACHED) return
  const entries = [...cache.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed)
  for (const [url, entry] of entries.slice(0, cache.size - MAX_CACHED)) {
    entry.texture?.dispose()
    cache.delete(url)
  }
}

export function loadNodeTexture(url: string): Promise<THREE.Texture> {
  const existing = cache.get(url)
  if (existing) {
    existing.lastUsed = performance.now()
    return existing.promise
  }
  const promise = new Promise<THREE.Texture>((resolve, reject) => {
    queue.push(() => {
      inFlight += 1
      loader.load(
        url,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace
          texture.anisotropy = 2
          texture.generateMipmaps = true
          texture.minFilter = THREE.LinearMipmapLinearFilter
          const entry = cache.get(url)
          if (entry) entry.texture = texture
          inFlight -= 1
          pump()
          resolve(texture)
        },
        undefined,
        (error) => {
          cache.delete(url)
          inFlight -= 1
          pump()
          reject(error)
        },
      )
    })
    pump()
  })
  cache.set(url, { texture: null, promise, lastUsed: performance.now() })
  evict()
  return promise
}

/** The image to show inside a node's disc, at a size suited to a small circle. */
export function nodeDiscImageUrl(node: GraphNode): string | null {
  const url = node.imageUrl
  if (!url) return null
  if (url.endsWith('/high.webp')) return url.replace(/\/high\.webp$/, '/low.webp')
  return url
}

export function useNodeTexture(url: string | null): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(() => (url ? (cache.get(url)?.texture ?? null) : null))
  useEffect(() => {
    if (!url) {
      setTexture(null)
      return
    }
    let cancelled = false
    const cached = cache.get(url)?.texture
    if (cached) {
      setTexture(cached)
      return
    }
    loadNodeTexture(url)
      .then((t) => {
        if (!cancelled) setTexture(t)
      })
      .catch(() => {
        if (!cancelled) setTexture(null)
      })
    return () => {
      cancelled = true
    }
  }, [url])
  return texture
}

/** Is this a wide logo (sets, series) rather than a portrait card? */
export function isLogoNode(node: GraphNode): boolean {
  return node.nodeType === 'set' || node.nodeType === 'series' || node.nodeType === 'game'
}
