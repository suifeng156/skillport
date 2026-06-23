import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import type { Adapter } from './adapters/base.js';
import { detectActivation } from './compare.js';
import type { RunResult, Skill } from './types.js';

export interface RunAcrossOptions {
  timeoutMs: number;
  /** Receive per-adapter status updates as the run progresses. */
  onStatus?: (id: string, status: 'starting' | 'no-cli' | 'installing' | 'running' | 'done' | 'error') => void;
}

export async function runAcrossPlatforms(
  skill: Skill,
  task: string,
  adapters: Adapter[],
  options: RunAcrossOptions
): Promise<RunResult[]> {
  return Promise.all(
    adapters.map(async (adapter) => runOne(adapter, skill, task, options))
  );
}

async function runOne(
  adapter: Adapter,
  skill: Skill,
  task: string,
  options: RunAcrossOptions
): Promise<RunResult> {
  const emit = (s: Parameters<NonNullable<RunAcrossOptions['onStatus']>>[1]) =>
    options.onStatus?.(adapter.id, s);
  emit('starting');

  const installed = await adapter.isInstalled();
  if (!installed) {
    emit('no-cli');
    return {
      platform: adapter.id,
      invoked: false,
      activated: false,
      output: '',
      durationMs: 0,
      error: `${adapter.displayName} not found on PATH. Install it or set SKILLPORT_${envName(adapter.id)}_BIN.`,
    };
  }

  const sandbox = await fs.mkdtemp(
    path.join(os.tmpdir(), `skillport-${adapter.id}-`)
  );
  try {
    emit('installing');
    await adapter.installSkill(skill, sandbox);
    emit('running');
    const result = await adapter.run(task, {
      cwd: sandbox,
      timeoutMs: options.timeoutMs,
    });
    result.activated = detectActivation(result, skill);
    emit(result.invoked ? 'done' : 'error');
    return result;
  } finally {
    await adapter.uninstallSkill(skill, sandbox).catch(() => {});
    await fs.remove(sandbox).catch(() => {});
  }
}

function envName(id: string): string {
  return id.toUpperCase().replace(/-/g, '_');
}
