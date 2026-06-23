import { describe, expect, it } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { loadSkill } from '../src/skill-loader.js';

const fixture = async (contents: string): Promise<string> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'skillport-test-'));
  await fs.writeFile(path.join(dir, 'SKILL.md'), contents);
  return dir;
};

describe('loadSkill', () => {
  it('parses a valid SKILL.md', async () => {
    const dir = await fixture(
      `---
name: test-skill
description: A test skill for unit testing the loader.
---

# Body
Some content.
`
    );
    const skill = await loadSkill(dir);
    expect(skill.name).toBe('test-skill');
    expect(skill.description).toBe('A test skill for unit testing the loader.');
    expect(skill.body).toContain('# Body');
  });

  it('rejects missing SKILL.md', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'skillport-test-'));
    await expect(loadSkill(dir)).rejects.toThrow(/No SKILL\.md/);
  });

  it('rejects invalid name', async () => {
    const dir = await fixture(
      `---
name: Invalid_Name
description: x
---

body`
    );
    await expect(loadSkill(dir)).rejects.toThrow(/1-64 chars/);
  });

  it('rejects missing frontmatter', async () => {
    const dir = await fixture('just markdown, no frontmatter\n');
    await expect(loadSkill(dir)).rejects.toThrow(/YAML frontmatter/);
  });

  it('rejects oversized description', async () => {
    const dir = await fixture(
      `---
name: x
description: ${'a'.repeat(1025)}
---

body`
    );
    await expect(loadSkill(dir)).rejects.toThrow(/1024/);
  });
});
