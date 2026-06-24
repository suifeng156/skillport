import type { PlatformId } from '../types.js';
import type { Adapter } from './base.js';
import { antigravityAdapter } from './antigravity.js';
import { claudeCodeAdapter } from './claude-code.js';
import { codexAdapter } from './codex.js';
import { cursorAdapter } from './cursor.js';

export { CliAdapter } from './base.js';
export type { Adapter } from './base.js';

const ALL: Adapter[] = [claudeCodeAdapter, codexAdapter, cursorAdapter, antigravityAdapter];

export function getAdapters(ids?: PlatformId[]): Adapter[] {
  if (!ids || ids.length === 0) return ALL;
  const set = new Set(ids);
  const matched = ALL.filter((a) => set.has(a.id));
  const missing = ids.filter((id) => !ALL.find((a) => a.id === id));
  if (missing.length > 0) {
    throw new Error(
      `Unknown platform(s): ${missing.join(', ')}. Supported: ${ALL.map((a) => a.id).join(', ')}.`
    );
  }
  return matched;
}

export function listSupportedPlatforms(): PlatformId[] {
  return ALL.map((a) => a.id);
}
