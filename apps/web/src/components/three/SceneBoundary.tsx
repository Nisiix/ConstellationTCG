'use client'

import { Component, type ReactNode } from 'react'

/**
 * Keeps a decorative part of the scene (labels, effects) from taking the whole sky down: if it
 * throws, it is left out and reported once, and the points and lines stay on screen.
 */
export class SceneBoundary extends Component<{ name: string; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  override componentDidCatch(error: unknown) {
    console.error(`[scene] ${this.props.name} failed and was left out`, error)
  }

  override render() {
    return this.state.failed ? null : this.props.children
  }
}
