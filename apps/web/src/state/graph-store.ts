import type { GraphEdge, GraphNeighborhood, GraphNode, RelationshipSummary } from '@constellation/domain'
import { create } from 'zustand'
import { computeLayout, type Vec3 } from '@/lib/layout'

export type GraphStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface GraphStoreState {
  focusNodeId: string | null
  nodes: GraphNode[]
  edges: GraphEdge[]
  depth: number
  selectedNodeId: string | null
  distances: Record<string, number>
  truncated: boolean
  filtered: boolean
  summary: RelationshipSummary[]
  positions: Map<string, Vec3>
  status: GraphStatus
  error: string | null
  /** Increments on every neighborhood change; renderers use it to restart reveal animations. */
  revision: number
  isUniverse: boolean

  setLoading(): void
  setError(message: string): void
  setNeighborhood(
    neighborhood: GraphNeighborhood,
    extra?: { summary?: RelationshipSummary[]; filtered?: boolean; isUniverse?: boolean },
  ): void
  select(nodeId: string | null): void
  nodeById(id: string): GraphNode | undefined
}

export const useGraphStore = create<GraphStoreState>((set, get) => ({
  focusNodeId: null,
  nodes: [],
  edges: [],
  depth: 1,
  selectedNodeId: null,
  distances: {},
  truncated: false,
  filtered: false,
  summary: [],
  positions: new Map(),
  status: 'idle',
  error: null,
  revision: 0,
  isUniverse: false,

  setLoading: () => set({ status: 'loading', error: null }),
  setError: (message) => set({ status: 'error', error: message }),
  setNeighborhood: (neighborhood, extra = {}) => {
    const previous = get().positions
    const positions = computeLayout(
      neighborhood.nodes,
      neighborhood.edges,
      neighborhood.meta.distances,
      neighborhood.focus.id,
      previous,
    )
    set((state) => ({
      focusNodeId: neighborhood.focus.id,
      nodes: neighborhood.nodes,
      edges: neighborhood.edges,
      depth: neighborhood.meta.depth,
      distances: neighborhood.meta.distances,
      truncated: neighborhood.meta.truncated,
      filtered: extra.filtered ?? false,
      summary: extra.summary ?? [],
      positions,
      status: 'ready',
      error: null,
      revision: state.revision + 1,
      isUniverse: extra.isUniverse ?? false,
      selectedNodeId: null,
    }))
  },
  select: (nodeId) => set({ selectedNodeId: nodeId }),
  nodeById: (id) => get().nodes.find((n) => n.id === id),
}))
