import { createCrashRecorder } from './crash.js';
export function createNativeRecorder(platform: { Constants: unknown; File: unknown; Paths: unknown; AppState: unknown; Platform: unknown }): ReturnType<typeof createCrashRecorder>;
