export type IngestionStatus = 'running' | 'succeeded' | 'partial' | 'failed'
export type IngestionMode = 'full' | 'incremental' | 'fixture'

export interface IngestionRun {
  id: string
  sourceId: string
  mode: IngestionMode
  startedAt: string
  finishedAt: string | null
  status: IngestionStatus
  recordsSeen: number
  recordsCreated: number
  recordsUpdated: number
  recordsUnchanged: number
  recordsFailed: number
  durationMs: number | null
  errorSummary: string | null
}

export type IngestionErrorType =
  | 'source'
  | 'validation'
  | 'normalization'
  | 'identity_resolution'
  | 'printing_resolution'
  | 'database'
  | 'unknown'

export interface IngestionError {
  id: string
  runId: string | null
  sourceId: string
  recordId: string
  errorType: IngestionErrorType
  payload: unknown
  message: string
  retryCount: number
  resolved: boolean
  createdAt: string
}

export interface IngestionCounters {
  seen: number
  created: number
  updated: number
  unchanged: number
  failed: number
}

export function emptyCounters(): IngestionCounters {
  return { seen: 0, created: 0, updated: 0, unchanged: 0, failed: 0 }
}
