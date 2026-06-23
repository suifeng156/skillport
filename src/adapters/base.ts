import path from 'node:path';
import { execa } from 'execa';
import fs from 'fs-extra';
import type { PlatformId, RunResult, RunOptions, Skill } from '../types.js';

export interface Adapter {
  id: PlatformId;
  displayName: string;
  /** Is the platform CLI installed and runnable? */
  isInstalled(): Promise<boolean>;
  /** Install the skill into projectRoot's platform-specific skills directory. */
  installSkill(skill: Skill, projectRoot: string): Promise<void>;
  /** Best-effort removal of the installed skill. */
  uninstallSkill(skill: Skill, projectRoot: string): Promise<void>;
  /** Run the task non-interactively and capture stdout. */
  run(task: string, options: RunOptions): Promise<RunResult>;
}

export interface CliAdapterConfig {
  id: PlatformId;
  displayName: string;
  /** Executable name; can be overridden by an env var at call sites. */
  bin: string;
  /** Build argv for non-interactive task execution. */
  taskArgs: (task: string) => string[];
  /** Path inside the project root where SKILL.md folders live, e.g. ".claude/skills". */
  projectSkillDir: string;
  /** Args used to probe whether the CLI is installed. Defaults to ["--version"]. */
  versionArgs?: string[];
}

export class CliAdapter implements Adapter {
  readonly id: PlatformId;
  readonly displayName: string;
  protected readonly bin: string;
  protected readonly taskArgs: (task: string) => string[];
  protected readonly projectSkillDir: string;
  protected readonly versionArgs: string[];

  constructor(cfg: CliAdapterConfig) {
    this.id = cfg.id;
    this.displayName = cfg.displayName;
    this.bin = cfg.bin;
    this.taskArgs = cfg.taskArgs;
    this.projectSkillDir = cfg.projectSkillDir;
    this.versionArgs = cfg.versionArgs ?? ['--version'];
  }

  private installPath(skill: Skill, projectRoot: string): string {
    return path.join(projectRoot, this.projectSkillDir, skill.name);
  }

  async isInstalled(): Promise<boolean> {
    try {
      await execa(this.bin, this.versionArgs, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async installSkill(skill: Skill, projectRoot: string): Promise<void> {
    const target = this.installPath(skill, projectRoot);
    await fs.ensureDir(path.dirname(target));
    await fs.remove(target);
    await fs.copy(skill.path, target);
  }

  async uninstallSkill(skill: Skill, projectRoot: string): Promise<void> {
    await fs.remove(this.installPath(skill, projectRoot)).catch(() => {});
  }

  async run(task: string, opts: RunOptions): Promise<RunResult> {
    const started = Date.now();
    try {
      const res = await execa(this.bin, this.taskArgs(task), {
        cwd: opts.cwd,
        timeout: opts.timeoutMs,
        reject: false,
        env: { ...process.env, ...opts.env },
      });
      const durationMs = Date.now() - started;
      return {
        platform: this.id,
        invoked: true,
        activated: false,
        output: res.stdout ?? '',
        durationMs,
        exitCode: res.exitCode ?? undefined,
        ...(typeof res.exitCode === 'number' && res.exitCode !== 0
          ? { error: (res.stderr ?? '').slice(0, 500) }
          : {}),
      };
    } catch (err) {
      return {
        platform: this.id,
        invoked: false,
        activated: false,
        output: '',
        durationMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
