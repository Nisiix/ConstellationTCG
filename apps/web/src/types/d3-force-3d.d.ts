declare module 'd3-force-3d' {
  export interface SimulationNode {
    index?: number
    x?: number
    y?: number
    z?: number
    vx?: number
    vy?: number
    vz?: number
    fx?: number | null
    fy?: number | null
    fz?: number | null
  }

  export interface SimulationLink<N extends SimulationNode = SimulationNode> {
    source: string | number | N
    target: string | number | N
    index?: number
  }

  export interface Force<N extends SimulationNode> {
    (alpha: number): void
    initialize?(nodes: N[], random?: () => number, numDimensions?: number): void
  }

  export interface Simulation<N extends SimulationNode> {
    restart(): this
    stop(): this
    tick(iterations?: number): this
    nodes(): N[]
    nodes(nodes: N[]): this
    alpha(): number
    alpha(alpha: number): this
    alphaMin(): number
    alphaMin(min: number): this
    alphaDecay(): number
    alphaDecay(decay: number): this
    alphaTarget(): number
    alphaTarget(target: number): this
    velocityDecay(): number
    velocityDecay(decay: number): this
    numDimensions(): number
    numDimensions(n: 1 | 2 | 3): this
    force(name: string): Force<N> | undefined
    force(name: string, force: Force<N> | null): this
    randomSource(source: () => number): this
    on(type: string, listener: ((this: Simulation<N>) => void) | null): this
  }

  export function forceSimulation<N extends SimulationNode>(
    nodes?: N[],
    numDimensions?: 1 | 2 | 3,
  ): Simulation<N>

  export interface LinkForce<N extends SimulationNode, L extends SimulationLink<N>> extends Force<N> {
    links(): L[]
    links(links: L[]): this
    id(fn: (node: N, i: number, nodes: N[]) => string | number): this
    distance(value: number | ((link: L, i: number, links: L[]) => number)): this
    strength(value: number | ((link: L, i: number, links: L[]) => number)): this
    iterations(n: number): this
  }

  export function forceLink<N extends SimulationNode, L extends SimulationLink<N>>(
    links?: L[],
  ): LinkForce<N, L>

  export interface ManyBodyForce<N extends SimulationNode> extends Force<N> {
    strength(value: number | ((node: N, i: number, nodes: N[]) => number)): this
    theta(value: number): this
    distanceMin(value: number): this
    distanceMax(value: number): this
  }

  export function forceManyBody<N extends SimulationNode>(): ManyBodyForce<N>

  export interface CollideForce<N extends SimulationNode> extends Force<N> {
    radius(value: number | ((node: N, i: number, nodes: N[]) => number)): this
    strength(value: number): this
    iterations(n: number): this
  }

  export function forceCollide<N extends SimulationNode>(
    radius?: number | ((node: N, i: number, nodes: N[]) => number),
  ): CollideForce<N>

  export interface RadialForce<N extends SimulationNode> extends Force<N> {
    radius(value: number | ((node: N, i: number, nodes: N[]) => number)): this
    strength(value: number | ((node: N, i: number, nodes: N[]) => number)): this
    x(value: number): this
    y(value: number): this
    z(value: number): this
  }

  export function forceRadial<N extends SimulationNode>(
    radius: number | ((node: N, i: number, nodes: N[]) => number),
    x?: number,
    y?: number,
    z?: number,
  ): RadialForce<N>

  export interface CenterForce<N extends SimulationNode> extends Force<N> {
    x(value: number): this
    y(value: number): this
    z(value: number): this
    strength(value: number): this
  }

  export function forceCenter<N extends SimulationNode>(x?: number, y?: number, z?: number): CenterForce<N>
}
