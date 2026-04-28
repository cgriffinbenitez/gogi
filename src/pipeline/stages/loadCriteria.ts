import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { CriteriaConfig } from '../types';

// ─── In-process cache ────────────────────────────────────────────────────────
// Criteria files don't change at runtime — load once per process.
const cache = new Map<string, CriteriaConfig>();

// ─── Path resolution ─────────────────────────────────────────────────────────
// Resolved relative to the project root (cwd) so it works from any entry point.
function criteriaPath(classification: string): string {
  return resolve(process.cwd(), 'src/pipeline/criteria', `${classification}.json`);
}

// ─── Required fields ─────────────────────────────────────────────────────────
const REQUIRED_FIELDS: Array<keyof CriteriaConfig> = [
  'classification',
  'targetSkill',
  'mustHave',
  'mustNotHave',
  'tierSignals',
];

function validate(raw: unknown, classification: string): CriteriaConfig {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`loadCriteria: ${classification}.json is not a JSON object`);
  }
  const obj = raw as Record<string, unknown>;

  for (const field of REQUIRED_FIELDS) {
    if (!(field in obj)) {
      throw new Error(
        `loadCriteria: ${classification}.json missing required field "${field}"`,
      );
    }
  }

  const ts = obj.tierSignals as Record<string, unknown>;
  for (const tier of ['tier1', 'tier2', 'tier3'] as const) {
    // Accept either a plain string (legacy simple signals) or a structured object
    // (rich signals with name/description/identifyingFeatures/thresholds).
    const val = ts[tier];
    if (typeof val !== 'string' && (typeof val !== 'object' || val === null)) {
      throw new Error(
        `loadCriteria: ${classification}.json missing tierSignals.${tier}`,
      );
    }
  }

  return raw as CriteriaConfig;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Load and return the CriteriaConfig for a classification.
 *
 * Results are cached in-process — subsequent calls for the same classification
 * return the same object without re-reading the filesystem.
 *
 * @throws if the criteria file does not exist or is missing required fields.
 */
export function loadCriteria(classification: string): CriteriaConfig {
  const cached = cache.get(classification);
  if (cached) return cached;

  const path = criteriaPath(classification);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('ENOENT') || msg.includes('no such file')) {
      throw new Error(
        `loadCriteria: no criteria file found for classification "${classification}" (expected ${path})`,
      );
    }
    throw new Error(`loadCriteria: failed to parse ${classification}.json — ${msg}`);
  }

  const config = validate(raw, classification);
  cache.set(classification, config);
  return config;
}

/** Clear the in-process cache. Intended for test isolation only. */
export function clearCriteriaCache(): void {
  cache.clear();
}
