import { CliAdapter } from './base.js';

const extra = (process.env.SKILLPORT_CURSOR_ARGS ?? '').split(' ').filter(Boolean);

export const cursorAdapter = new CliAdapter({
  id: 'cursor',
  displayName: 'Cursor Agent',
  bin: process.env.SKILLPORT_CURSOR_BIN ?? 'cursor-agent',
  taskArgs: (task) => (extra.length > 0 ? [...extra, task] : ['-p', task]),
  projectSkillDir: '.cursor/skills',
});
