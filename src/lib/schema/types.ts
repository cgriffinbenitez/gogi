export type SchemaMode =
  | 'topic_primer'
  | 'context_builder'
  | 'task_framing'

export interface SchemaPayload {
  schemaMode: SchemaMode
  topicFrame: string             // max 180 chars
  knowledgeAnchors: string[]     // 3 items, max 140 chars each
  analogyOrBridge: string        // max 180 chars
  misconceptionGuardrail: string // max 140 chars
  readingLens: string            // max 160 chars
  predictionPrompt: string       // max 160 chars
}

export interface SchemaGenerateRequest {
  sessionId: string
  studentId: string
  questionId: string
  standardId: string
  standardCode: string
  schemaModeOverride?: SchemaMode
}

export interface SchemaGenerateResponse {
  interventionId: string
  payload: SchemaPayload
  cached: boolean
}

export interface SchemaSubmitRequest {
  schemaInterventionId: string
  studentId: string
  responseText: string
}

export interface SchemaSubmitResponse {
  unlockPassage: boolean
  readinessScore: number
  microFeedback: string
}
