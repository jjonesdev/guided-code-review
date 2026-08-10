export interface ProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ProcessRunner {
  run(argv: readonly string[], options: { cwd: string; signal?: AbortSignal; timeoutMs: number; env?: Record<string, string | undefined> }): Promise<ProcessResult>;
}

export class BunProcessRunner implements ProcessRunner {
  async run(argv: readonly string[], options: { cwd: string; signal?: AbortSignal; timeoutMs: number; env?: Record<string, string | undefined> }): Promise<ProcessResult> {
    const controller = new AbortController();
    const relay = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", relay, { once: true });
    const timer = setTimeout(() => controller.abort(new Error("Process timed out.")), options.timeoutMs);
    try {
      const proc = Bun.spawn([...argv], {
        cwd: options.cwd,
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
        env: options.env ?? process.env,
        signal: controller.signal,
      });
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      return { stdout, stderr, exitCode };
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", relay);
    }
  }
}
