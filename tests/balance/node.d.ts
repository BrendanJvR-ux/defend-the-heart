// The few Node APIs the balance lab's scripts use (the project has no Node type package).
declare const process: { env: Record<string, string | undefined>; argv: string[] };
declare module 'node:fs' {
  export function readdirSync(dir: string): string[];
  export function readFileSync(path: string, enc: 'utf8'): string;
  export function writeFileSync(path: string, data: string): void;
  export function mkdirSync(dir: string, opts?: { recursive?: boolean }): void;
}
