// Metro's require.context (expo-router turns it on), used by fonts.ts to read the fonts folder without failing when it is empty.
declare namespace NodeJS {
  interface Require {
    context(directory: string, recursive?: boolean, filter?: RegExp): { keys(): string[]; (id: string): number };
  }
}
