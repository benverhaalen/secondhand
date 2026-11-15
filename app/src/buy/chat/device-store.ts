// On web the browser's localStorage is already there; expo-sqlite's web build needs a wasm worker, so it is not loaded.
// The phone loads device-store.native.ts instead, which installs SQLite-backed localStorage.
export {};
