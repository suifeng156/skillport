import { CliAdapter } from './base.js';

const extra = (process.env.SKILLPORT_GEMINI_CLI_ARGS ?? '').split(' ').filter(Boolean);

export const geminiCliAdapter = new CliAdapter({
  id: 'gemini-cli',
  displayName: 'Gemini CLI',
  bin: process.env.SKILLPORT_GEMINI_CLI_BIN ?? 'gemini',
  taskArgs: (task) => (extra.length > 0 ? [...extra, task] : ['-p', task]),
  projectSkillDir: '.gemini/skills',
});
