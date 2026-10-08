/**
 * Typed errors, one per layer. Every layer throws its own error class so that failures can be
 * classified (and recorded in `ingestion_errors`) without string matching.
 */

export abstract class ConstellationError extends Error {
  abstract readonly layer: string
  readonly details: Record<string, unknown>

  constructor(
    message: string,
    details: Record<string, unknown> = {},
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = new.target.name
    this.details = details
  }
}

export class SourceError extends ConstellationError {
  readonly layer = 'source'
}

export class ValidationError extends ConstellationError {
  readonly layer = 'validation'
}

export class NormalizationError extends ConstellationError {
  readonly layer = 'normalization'
}

export class IdentityResolutionError extends ConstellationError {
  readonly layer = 'identity_resolution'
}

export class PrintingResolutionError extends ConstellationError {
  readonly layer = 'printing_resolution'
}

export class GraphError extends ConstellationError {
  readonly layer = 'graph'
}

export class ResolverError extends ConstellationError {
  readonly layer = 'resolver'
}

export class ProviderError extends ConstellationError {
  readonly layer = 'provider'
}

export class DatabaseError extends ConstellationError {
  readonly layer = 'database'
}

export function isConstellationError(value: unknown): value is ConstellationError {
  return value instanceof ConstellationError
}
