import { CliAdapter } from './base.js';

const extra = (process.env.SKILLPORT_CODEX_ARGS ?? '').split(' ').filter(Boolean);

export const codexAdapter = new CliAdapter({
  id: 'codex',
  displayName: 'Codex CLI',
  bin: process.env.SKILLPORT_CODEX_BIN ?? 'codex',
  taskArgs: (task) => (extra.length > 0 ? [...extra, task] : ['exec', task]),
  projectSkillDir: '.codex/skills',
});
