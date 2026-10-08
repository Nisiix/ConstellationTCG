import type { GraphEdge, GraphNode } from './graph'

export interface GraphState {
  focusNodeId: string | null
  nodes: GraphNode[]
  edges: GraphEdge[]
  depth: number
  selectedNodeId: string | null
}

export type CameraMode = 'free' | 'focus' | 'follow'
export type CameraTransition = 'idle' | 'moving'

export interface CameraState {
  targetNodeId: string | null
  mode: CameraMode
  transition: CameraTransition
}

export interface OwnershipState {
  connected: boolean
  ownedNodeIds: Set<string>
  lastSyncedAt?: string
}
