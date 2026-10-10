import type { GraphEdge, GraphNeighborhood, GraphNode } from '@constellation/domain'
import type { Landmarks } from '@constellation/graph'
import type { Vec3 } from './layout'

export type { Landmark, LandmarkCategory, Landmarks } from '@constellation/graph'

/**
 * The landmarks as a sky: the game in the middle and each category a small constellation around
 * it, joined to the center by lines in the color of the relationship it stands for.
 */
export function landmarksNeighborhood(landmarks: Landmarks): GraphNeighborhood {
  const nodes = new Map<string, GraphNode>([[landmarks.game.id, landmarks.game]])
  const distances: Record<string, number> = { [landmarks.game.id]: 0 }
  const edges: GraphEdge[] = []
  for (const category of landmarks.categories) {
    for (const item of category.items) {
      if (!nodes.has(item.node.id)) {
        nodes.set(item.node.id, item.node)
        distances[item.node.id] = 1
      }
      edges.push({
        id: `landmark:${category.id}:${item.node.id}`,
        sourceNodeId: landmarks.game.id,
        targetNodeId: item.node.id,
        relationshipType: category.relationshipType,
        weight: 1,
        direction: 'undirected',
        metadata: { landmark: category.id, reason: item.reason },
      })
    }
  }
  const list = [...nodes.values()]
  return { focus: landmarks.game, nodes: list, edges, meta: { depth: 1, truncated: false, nodeCount: list.length, edgeCount: edges.length, distances } }
}

/** Categories on a ring around the game, each one's landmarks in a short arc (a point in two categories stays in the first). */
export function landmarksLayout(landmarks: Landmarks): Map<string, Vec3> {
  const positions = new Map<string, Vec3>([[landmarks.game.id, [0, 0, 0]]])
  const count = landmarks.categories.length
  const ring = 14
  landmarks.categories.forEach((category, k) => {
    const theta = Math.PI / 2 - (k * 2 * Math.PI) / Math.max(1, count)
    const center: Vec3 = [Math.cos(theta) * ring, Math.sin(theta) * ring, 0]
    const tangent: Vec3 = [-Math.sin(theta), Math.cos(theta), 0]
    const fresh = category.items.filter((item) => !positions.has(item.node.id))
    fresh.forEach((item, j) => {
      const offset = (j - (fresh.length - 1) / 2) * 3.4
      const depth = (j % 2 === 0 ? 1 : -1) * 1.2
      positions.set(item.node.id, [center[0] + tangent[0] * offset, center[1] + tangent[1] * offset, depth])
    })
  })
  return positions
}
