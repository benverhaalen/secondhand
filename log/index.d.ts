// Types for the parts of the logger that TypeScript callers use so far. Add a method here when the first TypeScript caller needs it.
export type Sink = (line: string) => void | Promise<void>;

export interface Log {
  session: string;
  call<T>(
    kind: string,
    name: string,
    input: unknown,
    fn: (link: { call: string; from: string }) => Promise<T> | T,
    describe?: (out: T) => Record<string, unknown>,
  ): Promise<T>;
  child(ids: Record<string, string>, src?: string): Log;
  error(where: string, e: unknown, fields?: Record<string, unknown>): void;
  event(name: string, fields?: Record<string, unknown>, level?: string): unknown;
  timed<T>(name: string, fn: () => T, fields?: Record<string, unknown>): T;
}

export function createLog(options: { src: string; build: string; sink: Sink; seed?: number; session?: string; from?: string; config?: Record<string, unknown> }): Log;
export const consoleSink: Sink;
export function memorySink(): Sink & { lines: string[]; text(): string };
