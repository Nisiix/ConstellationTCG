import { createHash } from 'node:crypto'
import { stableStringify } from '@constellation/domain'

/** SHA-256 of the stable JSON form of a value. Used as provenance / change-detection hash. */
export function contentHash(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex')
}
