type ShouldRunner = {
  (message: string, test: () => void | Promise<void>): void;
  only(message: string, test: () => void | Promise<void>): void;
  skip(message: string, test: () => void | Promise<void>): void;
  run(): void;
};
declare const should: ShouldRunner;
declare const it: ShouldRunner;
export function describe(prefix: string, fn: () => void): void;
export { should, it };
export default should;
