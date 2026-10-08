/**
 * Identifier conventions.
 *
 * Database rows use UUIDs. Graph nodes use a stable, URL-safe composite id of the form
 * `<node_type>:<entity_id>` so that every focus is addressable (`/explore?node=card_printing:...`).
 */
import type { NodeType } from './graph'
import { NODE_TYPES } from './graph'

export type NodeId = `${NodeType}:${string}`

export function makeNodeId(type: NodeType, entityId: string): NodeId {
  return `${type}:${entityId}`
}

export interface ParsedNodeId {
  type: NodeType
  entityId: string
}

export function parseNodeId(value: string): ParsedNodeId | null {
  const idx = value.indexOf(':')
  if (idx <= 0) return null
  const type = value.slice(0, idx)
  const entityId = value.slice(idx + 1)
  if (!entityId) return null
  if (!(NODE_TYPES as readonly string[]).includes(type)) return null
  return { type: type as NodeType, entityId }
}

export function isNodeId(value: unknown): value is NodeId {
  return typeof value === 'string' && parseNodeId(value) !== null
}
