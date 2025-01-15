/*! micro-should - MIT License (c) 2019 Paul Miller (paulmillr.com) */
/**
 * Micro testing framework with familiar syntax for browsers, node and others.
 * Supports fast mode (parallel), quiet mode (dot reporter), tree structures, CLI self-run auto-detection.
 */
export interface StackItem {
    message: string;
    test?: () => Promise<any> | any;
    skip?: boolean;
    only?: boolean;
    prefix?: string;
    childPrefix?: string;
    path?: StackItem[];
    beforeEach?: () => Promise<void> | void;
    afterEach?: () => Promise<void> | void;
    children: StackItem[];
}
export interface Options {
    PRINT_TREE: boolean;
    PRINT_MULTILINE: boolean;
    STOP_AT_ERROR: boolean;
    QUIET: boolean;
    FAST: number;
}
export interface DescribeFunction {
    (message: string, testFunctions: () => Promise<any> | any): void;
    skip: (message: string, test: () => Promise<any> | any) => void;
}
export interface TestFunction {
    (message: string, test: () => Promise<any> | any): void;
    /**
     * Registers test for "only" queue. When the queue is not empty,
     * it would ignore all other tests. Is limited to just one registered test.
     */
    only: (message: string, test: () => Promise<any> | any) => void;
    /** Registers test, but skips it while running. Can be used instead of commenting out the code. */
    skip: (message: string, test: () => Promise<any> | any) => void;
    /**
     * Runs all registered tests.
     * After run, allows to run new tests without duplication: old test queue is cleaned up.
     * @param forceSequential - when `true`, disables automatic parallelization even when MSHOULD_FAST=1.
     * @returns resolved promise, after all tests have finished
     */
    run: (forceSequential?: boolean) => Promise<number>;
    /**
     * Executes .run() when passed argument is equal to CLI-passed file name.
     * Consider a project with 3 test files: a.test.js, b.test.js, all.js.
     * all.js imports a.test.js and b.test.js.
     * User runs node a.test.js; then node all.js;
     * Writing `it.run()` everywhere would fail, because it would try to run same tests twice.
     * However, `it.runWhen(import.meta.url)` would succeed, because it detects whether
     * current file is launched from CLI and not imported.
     * @example
     * it.runWhen(import.meta.url)
     */
    runWhen: (importMetaUrl: string) => Promise<number | undefined>;
    /** Parallel version, using node:cluster. Auto-selected when env var MSHOULD_FAST=1 is set. */
    runParallel: () => Promise<number>;
    opts: Options;
}
export type EmptyFn = () => Promise<void> | void;
declare const describe: DescribeFunction;
declare function beforeEach(fn: EmptyFn): void;
declare function afterEach(fn: EmptyFn): void;
/**
 * Registers test for future running.
 * Would not auto-run, needs `it.run()` to be called at some point.
 * See {@link TestFunction} for methods.
 * @param message test title
 * @param test function, may be async
 */
declare const it: TestFunction;
export { it, describe, beforeEach, afterEach, it as should };
export default it;
