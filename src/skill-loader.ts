import path from 'node:path';
import fs from 'fs-extra';
import YAML from 'yaml';
import type { Skill } from './types.js';

const FRONTMATTER_RE = /^---\r?\n([\s\S]+?)\r?\n---\r?\n?([\s\S]*)$/;
const NAME_RE = /^[a-z0-9-]{1,64}$/;
const MAX_DESCRIPTION = 1024;

export async function loadSkill(skillDir: string): Promise<Skill> {
  const abs = path.resolve(skillDir);
  const skillPath = path.join(abs, 'SKILL.md');
  if (!(await fs.pathExists(skillPath))) {
    throw new Error(`No SKILL.md found in ${abs}`);
  }
  const raw = await fs.readFile(skillPath, 'utf8');
  const m = raw.match(FRONTMATTER_RE);
  if (!m) {
    throw new Error('SKILL.md is missing YAML frontmatter (--- block at top).');
  }
  let parsed: unknown;
  try {
    parsed = YAML.parse(m[1]);
  } catch (err) {
    throw new Error(`SKILL.md frontmatter is not valid YAML: ${(err as Error).message}`);
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('SKILL.md frontmatter is empty or not a mapping.');
  }
  const { name, description } = parsed as { name?: unknown; description?: unknown };
  if (typeof name !== 'string') {
    throw new Error('SKILL.md frontmatter is missing required field: name');
  }
  if (typeof description !== 'string') {
    throw new Error('SKILL.md frontmatter is missing required field: description');
  }
  if (!NAME_RE.test(name)) {
    throw new Error(
      `Skill name "${name}" must be 1-64 chars, lowercase letters / digits / hyphens (agentskills.io spec).`
    );
  }
  if (description.length > MAX_DESCRIPTION) {
    throw new Error(
      `Skill description is ${description.length} chars; spec maximum is ${MAX_DESCRIPTION}.`
    );
  }
  return {
    path: abs,
    name,
    description,
    body: m[2] ?? '',
    raw,
  };
}
