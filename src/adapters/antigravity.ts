import { CliAdapter } from './base.js';

const extra = (process.env.SKILLPORT_ANTIGRAVITY_ARGS ?? '').split(' ').filter(Boolean);

export const antigravityAdapter = new CliAdapter({
  id: 'antigravity',
  displayName: 'Antigravity',
  bin: process.env.SKILLPORT_ANTIGRAVITY_BIN ?? 'agy',
  taskArgs: (task) => (extra.length > 0 ? [...extra, task] : ['-p', task]),
  projectSkillDir: '.agents/skills',
});
