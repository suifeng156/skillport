import { describe, expect, it } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { loadBench } from '../src/bench/loader.js';

const fixture = async (contents: string): Promise<string> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'skillport-bench-test-'));
  const file = path.join(dir, 'bench.yaml');
  await fs.writeFile(file, contents);
  return file;
};

describe('loadBench', () => {
  it('parses a minimal valid bench', async () => {
    const f = await fixture(
      `name: my-bench
skill: ./skill
tasks:
  - id: t1
    task: do the thing
`
    );
    const b = await loadBench(f);
    expect(b.name).toBe('my-bench');
    expect(b.tasks).toHaveLength(1);
    expect(b.tasks[0].id).toBe('t1');
    expect(b.skillPath).toBe(path.resolve(path.dirname(f), './skill'));
  });

  it('parses full schema with markers, thresholds, platforms, baseline', async () => {
    const f = await fixture(
      `name: full-bench
description: A complete example
skill: ./skill
platforms: [claude-code, codex]
baseline: claude-code
default_timeout_ms: 60000
thresholds:
  composite: 0.5
  activation_rate: 0.8
tasks:
  - id: alpha
    description: First task
    task: prompt one
    expected_markers: ["foo", "bar"]
    unexpected_markers: ["bad"]
    timeout_ms: 30000
`
    );
    const b = await loadBench(f);
    expect(b.description).toBe('A complete example');
    expect(b.platforms).toEqual(['claude-code', 'codex']);
    expect(b.baseline).toBe('claude-code');
    expect(b.defaultTimeoutMs).toBe(60000);
    expect(b.thresholds).toEqual({ composite: 0.5, activationRate: 0.8 });
    expect(b.tasks[0].expectedMarkers).toEqual(['foo', 'bar']);
    expect(b.tasks[0].unexpectedMarkers).toEqual(['bad']);
    expect(b.tasks[0].timeoutMs).toBe(30000);
  });

  it('rejects bad name', async () => {
    const f = await fixture(`name: Bad_Name\nskill: .\ntasks: [{id: t, task: x}]`);
    await expect(loadBench(f)).rejects.toThrow(/must be 1-64 chars/);
  });

  it('rejects empty tasks', async () => {
    const f = await fixture(`name: x\nskill: .\ntasks: []`);
    await expect(loadBench(f)).rejects.toThrow(/at least one task/);
  });

  it('rejects duplicate task ids', async () => {
    const f = await fixture(
      `name: x
skill: .
tasks:
  - id: a
    task: one
  - id: a
    task: two
`
    );
    await expect(loadBench(f)).rejects.toThrow(/duplicated/);
  });

  it('rejects unknown platform', async () => {
    const f = await fixture(`name: x\nskill: .\nplatforms: [no-such]\ntasks: [{id: t, task: x}]`);
    await expect(loadBench(f)).rejects.toThrow(/unknown platform/);
  });

  it('rejects baseline not in platforms', async () => {
    const f = await fixture(
      `name: x
skill: .
platforms: [codex]
baseline: claude-code
tasks: [{id: t, task: x}]`
    );
    await expect(loadBench(f)).rejects.toThrow(/baseline.*must be one of platforms/);
  });

  it('rejects out-of-range threshold', async () => {
    const f = await fixture(
      `name: x
skill: .
thresholds:
  composite: 1.5
tasks: [{id: t, task: x}]`
    );
    await expect(loadBench(f)).rejects.toThrow(/between 0 and 1/);
  });

  it('rejects missing required field', async () => {
    const f = await fixture(`skill: .\ntasks: [{id: t, task: x}]`);
    await expect(loadBench(f)).rejects.toThrow(/"name" must be a string/);
  });

  it('rejects non-existent bench file', async () => {
    await expect(loadBench('/nope/nope.yaml')).rejects.toThrow(/not found/);
  });
});
