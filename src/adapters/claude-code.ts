import { CliAdapter } from './base.js';

export const claudeCodeAdapter = new CliAdapter({
  id: 'claude-code',
  displayName: 'Claude Code',
  bin: process.env.SKILLPORT_CLAUDE_CODE_BIN ?? 'claude',
  taskArgs: (task) => ['-p', task],
  projectSkillDir: '.claude/skills',
});
