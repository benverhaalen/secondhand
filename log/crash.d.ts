export type Entry = { ts: string; session: string; seq: number; src: string; level: string; event: string; route?: string; fatal?: boolean; error?: { type: string; msg: string; stack?: string }; componentStack?: string };
export type CrashEntry = Entry & { breadcrumbs: Entry[] };
export function parseLines(text: string): Entry[];
export function createCrashRecorder(options: {
  storage: { read(): string; append(line: string): void; sent(): string; acknowledge(line: string): void };
  build: string; print(line: string): void; origin(): string | null;
  fetch: typeof fetch;
}): {
  readCrashes(): CrashEntry[];
  recordError(error: unknown, fatal?: boolean, componentStack?: string): void;
  setRoute(path: string): void;
  upload(): Promise<void>;
  install(runtime: object, onState: (callback: (state: string) => void) => void): void;
  dispose(): void;
};
