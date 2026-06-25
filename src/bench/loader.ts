import path from 'node:path';
import fs from 'fs-extra';
import YAML from 'yaml';
import { listSupportedPlatforms } from '../adapters/index.js';
import type { Bench, BenchTask, BenchThresholds, PlatformId } from '../types.js';

const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export async function loadBench(benchFile: string): Promise<Bench> {
  const abs = path.resolve(benchFile);
  if (!(await fs.pathExists(abs))) {
    throw new Error(`Bench file not found: ${abs}`);
  }
  const raw = await fs.readFile(abs, 'utf8');
  let parsed: unknown;
  try {
    parsed = YAML.parse(raw);
  } catch (err) {
    throw new Error(`${abs} is not valid YAML: ${(err as Error).message}`);
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`${abs} is empty or not a mapping.`);
  }
  return validate(parsed as Record<string, unknown>, abs);
}

function validate(doc: Record<string, unknown>, abs: string): Bench {
  const name = req(doc, 'name', 'string', abs);
  if (!ID_RE.test(name)) {
    throw new Error(`bench name "${name}" must be 1-64 chars, lowercase letters/digits/hyphens.`);
  }
  const description = opt(doc, 'description', 'string', abs);
  const skillRel = req(doc, 'skill', 'string', abs);
  const skillPath = path.resolve(path.dirname(abs), skillRel);

  const platforms = optArrayOfPlatformIds(doc, 'platforms', abs);
  const baseline = optPlatformId(doc, 'baseline', abs);
  if (baseline && platforms && !platforms.includes(baseline)) {
    throw new Error(`baseline "${baseline}" must be one of platforms [${platforms.join(', ')}].`);
  }

  const defaultTimeoutMs = optPositiveInt(doc, 'default_timeout_ms', abs);
  const thresholds = parseThresholds(doc.thresholds, abs);
  const tasks = parseTasks(doc.tasks, abs);

  return {
    path: abs,
    name,
    description,
    skillPath,
    platforms,
    baseline,
    defaultTimeoutMs,
    thresholds,
    tasks,
  };
}

function parseThresholds(raw: unknown, abs: string): BenchThresholds | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== 'object') {
    throw new Error(`${abs}: thresholds must be a mapping.`);
  }
  const t = raw as Record<string, unknown>;
  const out: BenchThresholds = {};
  for (const key of ['composite', 'activation_rate', 'task_pass_rate'] as const) {
    if (key in t) {
      const v = t[key];
      if (typeof v !== 'number' || v < 0 || v > 1) {
        throw new Error(`${abs}: thresholds.${key} must be a number between 0 and 1.`);
      }
      const camel = key === 'activation_rate' ? 'activationRate' : key === 'task_pass_rate' ? 'taskPassRate' : 'composite';
      out[camel] = v;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function parseTasks(raw: unknown, abs: string): BenchTask[] {
  if (!Array.isArray(raw)) {
    throw new Error(`${abs}: tasks must be a non-empty array.`);
  }
  if (raw.length === 0) {
    throw new Error(`${abs}: tasks must contain at least one task.`);
  }
  const seen = new Set<string>();
  return raw.map((entry, i) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`${abs}: tasks[${i}] must be a mapping.`);
    }
    const t = entry as Record<string, unknown>;
    const id = req(t, 'id', 'string', `${abs} tasks[${i}]`);
    if (!ID_RE.test(id)) {
      throw new Error(`${abs}: tasks[${i}].id "${id}" must be 1-64 chars lowercase letters/digits/hyphens.`);
    }
    if (seen.has(id)) {
      throw new Error(`${abs}: tasks[${i}].id "${id}" is duplicated.`);
    }
    seen.add(id);
    const task = req(t, 'task', 'string', `${abs} tasks[${i}]`);
    const description = opt(t, 'description', 'string', `${abs} tasks[${i}]`);
    const expectedMarkers = optStringArray(t, 'expected_markers', `${abs} tasks[${i}]`);
    const unexpectedMarkers = optStringArray(t, 'unexpected_markers', `${abs} tasks[${i}]`);
    const timeoutMs = optPositiveInt(t, 'timeout_ms', `${abs} tasks[${i}]`);
    return { id, description, task, expectedMarkers, unexpectedMarkers, timeoutMs };
  });
}

function req(obj: Record<string, unknown>, key: string, type: 'string' | 'number', ctx: string): string {
  const v = obj[key];
  if (typeof v !== type) {
    throw new Error(`${ctx}: required field "${key}" must be a ${type}.`);
  }
  return v as string;
}

function opt(
  obj: Record<string, unknown>,
  key: string,
  type: 'string' | 'number',
  ctx: string
): string | undefined {
  const v = obj[key];
  if (v == null) return undefined;
  if (typeof v !== type) {
    throw new Error(`${ctx}: optional field "${key}" must be a ${type} when present.`);
  }
  return v as string;
}

function optPositiveInt(obj: Record<string, unknown>, key: string, ctx: string): number | undefined {
  const v = obj[key];
  if (v == null) return undefined;
  if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0) {
    throw new Error(`${ctx}: "${key}" must be a positive integer when present.`);
  }
  return v;
}

function optStringArray(obj: Record<string, unknown>, key: string, ctx: string): string[] | undefined {
  const v = obj[key];
  if (v == null) return undefined;
  if (!Array.isArray(v) || v.some((s) => typeof s !== 'string')) {
    throw new Error(`${ctx}: "${key}" must be an array of strings when present.`);
  }
  return v.length > 0 ? (v as string[]) : undefined;
}

function optArrayOfPlatformIds(obj: Record<string, unknown>, key: string, ctx: string): PlatformId[] | undefined {
  const v = obj[key];
  if (v == null) return undefined;
  if (!Array.isArray(v)) {
    throw new Error(`${ctx}: "${key}" must be an array of platform ids when present.`);
  }
  const supported = new Set(listSupportedPlatforms());
  const bad = v.filter((p) => typeof p !== 'string' || !supported.has(p as PlatformId));
  if (bad.length > 0) {
    throw new Error(
      `${ctx}: unknown platform(s) in "${key}": ${bad.join(', ')}. Supported: ${[...supported].join(', ')}.`
    );
  }
  return v as PlatformId[];
}

function optPlatformId(obj: Record<string, unknown>, key: string, ctx: string): PlatformId | undefined {
  const v = obj[key];
  if (v == null) return undefined;
  const supported = new Set(listSupportedPlatforms());
  if (typeof v !== 'string' || !supported.has(v as PlatformId)) {
    throw new Error(`${ctx}: "${key}" must be one of [${[...supported].join(', ')}].`);
  }
  return v as PlatformId;
}
