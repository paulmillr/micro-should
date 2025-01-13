/**
 * Micro testing framework with familiar syntax for browsers, node and others.
 * Supports fast mode (parallel), quiet mode (dot reporter), tree structures, CLI self-run auto-detection.
 * @module
 * @example
```js
import { should } from 'micro-should';
should('2 + 2 is 4', () => {
  if (2 + 2 !== 4) throw new Error('invalid');
});
should.run();
```
 * @example
```js
import { should, describe, beforeEach } from 'micro-should';
describe('section', () => {
  let adder = 0;
  beforeEach(() => {
    adder = 1;
  });
  should('2 + 2 is 5', () => {
    if (adder + 2 + 2 !== 5) throw new Error('invalid');
  });
  should.skip('2 + 2 is 6', () => { });
});
describe.skip('section 2', () => { });
// instead of should.run(), launch file only when called directly from CLI
should.runWhen(import.meta.url);
```
 */
/*! micro-should - MIT License (c) 2019 Paul Miller (paulmillr.com) */

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
  MSHOULD_QUIET: boolean;
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

declare const process: any;
declare const console: any;

const stack: StackItem[] = [{ message: '', children: [] }];
const errorLog: string[] = [];
let onlyStack: StackItem | undefined;
let running = false;
const isCli = 'process' in globalThis;
const opts: Options = {
  PRINT_TREE: true,
  PRINT_MULTILINE: true,
  STOP_AT_ERROR: true,
  MSHOULD_QUIET: isCli && process.env.MSHOULD_QUIET,
};
function isQuiet() {
  return opts.MSHOULD_QUIET;
}

// String formatting utils
const _c = String.fromCharCode(27); // x1b, control code for terminal colors
const c = {
  // colors
  red: _c + '[31m',
  green: _c + '[32m',
  reset: _c + '[0m',
} as const;
// We can write 'pending' test name and then overwrite it with actual result by using ${up}.
// However, if test prints something to STDOUT, last line would get removed.
// We can wrap process.stdout also, but in that case there can be issues with non-node.js env.
// But we already use node modules for parallel cases, so maybe worth investigating.
// const up = _c + '[A';
const LEAF_N = '├─';
const LEAF_E = '│ ';
const LEAF_L = '└─';
const LEAF_S = '  ';
// With padding
// const LEAF_N = '├─ ';
// const LEAF_E = '│  ';
// const LEAF_L = '└─ ';
// const LEAF_S = '   ';

// Colorize string for terminal.
function color(colorName: keyof typeof c, title: string | number) {
  return isCli ? `${c[colorName]}${title}${c.reset}` : title.toString();
}

function log(...args: (string | undefined)[]) {
  if (isQuiet()) return logQuiet(false);
  // @ts-ignore
  console.log(...args);
}
function logQuiet(fail = false) {
  if (fail) {
    process.stderr.write(color('red', '!'));
  } else {
    process.stdout.write('.');
  }
}
function addToErrorLog(title = '', error: any): void {
  errorLog.push(`${title} ${error?.stack ? error.stack : error}`);
  // @ts-ignore
  if (!isQuiet()) console.error(error); // loud = show error now. quiet = show in the end
}

function formatPrefix(depth: number, prefix: string, isLast: boolean) {
  if (depth === 0) return { prefix: '', childPrefix: '' };
  return {
    prefix: `${prefix}${isLast ? LEAF_L : LEAF_N}`,
    childPrefix: `${prefix}${isLast ? LEAF_S : LEAF_E}`,
  };
}

function tdiff(start: number) {
  const sec = Math.round((Date.now() - start) / 1000);
  return sec < 60 ? `${sec} sec` : `${Math.floor(sec / 60)} min ${sec % 60} sec`;
}

async function runTest(
  info: StackItem,
  printTree: boolean = false,
  multiLine: boolean = false,
  stopAtError: boolean = true
): Promise<boolean | undefined> {
  if (!printTree && multiLine) log();
  let title = info.message;
  if (typeof info.test !== 'function') throw new Error('internal test error: invalid info.test');

  let messages: string[] = [];
  let onlyLogsToPrint: string[] = [];
  let beforeEachFns: Function[] = [];
  let afterEachFns: Function[] = []; // will be reversed
  for (const parent of info.path!) {
    messages.push(parent.message);
    if (printTree && info.only) onlyLogsToPrint.push(`${parent.prefix}${parent.message}`);
    if (parent.beforeEach) beforeEachFns.push(parent.beforeEach);
    if (parent.afterEach) afterEachFns.push(parent.afterEach);
  }
  afterEachFns.reverse();
  if (onlyLogsToPrint.length) onlyLogsToPrint.forEach((l) => log(l));

  const path = `${messages.join('/')}/`;
  const full = path + title;

  // Skip is always single-line
  if (multiLine && !info.skip) {
    log(printTree ? `${info.prefix}${title}: ☆` : `☆ ${full}:`);
  } else if (info.skip) {
    log(printTree ? `${info.prefix}${title} (skip)` : `☆ ${full} (skip)`);
    return true;
  }

  // variables influencing state / print output:
  // fail = true | false
  // quiet = true | false
  // printTree = true | false (true when fast mode)
  // stopAtError = true | false
  function logTaskDone(fail = false, suffix = '') {
    const symbol = fail ? '☓' : '✓';
    const clr = fail ? 'red' : 'green';
    const title_ = suffix ? [title, suffix].join('/') : title;
    const full_ = suffix ? [full, suffix].join('/') : full;
    log(
      printTree
        ? `${info.childPrefix}` + color(clr, `${title_}: ${symbol}`)
        : color(clr, `${symbol} ${full_}`)
    );
  }

  // Emit
  function logErrorStack(suffix: string) {
    if (isQuiet()) {
      // when quiet, either stop & log trace; or log !
      if (stopAtError) {
        // stop, log whole path and trace
        console.error();
        console.error(color('red', `☓ ${full}/${suffix}`));
      } else {
        // log !, continue
        logQuiet(true);
      }
    } else {
      // when loud, log (maybe formatted) tree structure
      logTaskDone(true, suffix);
    }
  }

  // Run beforeEach hooks from parent contexts
  for (const beforeFn of beforeEachFns) {
    try {
      await beforeFn();
    } catch (cause) {
      logErrorStack('beforeEach');
      // @ts-ignore
      if (stopAtError) throw cause;
      else addToErrorLog(`${full}/beforeEach`, cause);

      return false;
    }
  }

  // Run test task
  try {
    // possible to do let result = ... in the future to save test outputs
    await info.test();
  } catch (cause) {
    logErrorStack('');
    // @ts-ignore
    if (stopAtError) throw cause;
    else addToErrorLog(`${full}`, cause);
    return false;
  }

  // Run afterEach hooks from parent contexts (in reverse order)
  for (const afterFn of afterEachFns) {
    try {
      await afterFn();
    } catch (cause) {
      logErrorStack('afterEach');
      // @ts-ignore
      if (stopAtError) throw cause;
      else addToErrorLog(`${full}/afterEach`, cause);
      return false;
    }
  }
  logTaskDone();
  return true;
}

function stackTop() {
  return stack[stack.length - 1];
}
function stackPop() {
  return stack.pop();
}
function stackAdd(info: { message: any; skip?: boolean }) {
  const c = { ...info, children: [] };
  stackTop().children.push(c);
  stack.push(c);
}

function stackFlatten(elm: StackItem): StackItem[] {
  const out: StackItem[] = [];
  const walk = (
    elm: StackItem,
    depth = 0,
    isLast = false,
    prevPrefix = '',
    path: StackItem[] = []
  ) => {
    const { prefix, childPrefix } = formatPrefix(depth, prevPrefix, isLast);
    const newElm: StackItem = { ...elm, prefix, childPrefix, path };
    out.push(newElm);
    path = path.concat([newElm]); // Save prefixes so we can print path in 'only' case

    const chl = elm.children;
    for (let i = 0; i < chl.length; i++)
      walk(chl[i], depth + 1, i === chl.length - 1, childPrefix, path);
  };
  // Skip root
  for (const child of elm.children) walk(child);
  return out;
}

const describe: DescribeFunction = (message: any, fn: EmptyFn): void => {
  stackAdd({ message });
  fn(); // Run function in the context of current stack path
  stackPop();
};

function describeSkip(message: any, _fn: EmptyFn): void {
  stackAdd({ message, skip: true });
  // fn();
  stackPop();
}
describe.skip = describeSkip;

function beforeEach(fn: EmptyFn): void {
  stackTop().beforeEach = fn;
}

function afterEach(fn: EmptyFn): void {
  stackTop().afterEach = fn;
}

function register(info: StackItem) {
  stackAdd(info);
  stackPop(); // remove from stack since there are no children
}

function cloneAndReset() {
  let items = stackFlatten(stack[0]).slice();
  if (onlyStack) items = items.filter((i) => i.test === onlyStack!.test);
  stack.splice(0, stack.length);
  stack.push({ message: '', children: [] } as unknown as StackItem);
  onlyStack = undefined;
  return items;
}

// 123 tests (+quiet +fast-x8) started...
function begin(total: number, workers?: number | undefined) {
  const features = [isQuiet() ? '+quiet' : '', workers ? `+fast-x${workers}` : ''].filter((a) => a);
  const modes = features.length ? `(${features.join(' ')}) ` : '';
  // No need to log stats when tests fit on one screen
  if (total > 32) console.log(`${color('green', total.toString())} tests ${modes}started...`);
}

function finalize(total: number, startTime: number) {
  console.log();
  if (isQuiet()) console.log();
  const totalFailed = errorLog.length;
  if (totalFailed) {
    console.error();
    console.error(`${color('red', totalFailed)} tests failed`);
    if (isQuiet()) {
      errorLog.forEach((err) => console.error(err));
    }
  } else {
    console.log(`${color('green', total)} tests passed in ${tdiff(startTime)}`);
  }
}

async function runTests(forceSequential = false) {
  if (running) throw new Error('should.run() has already been called, wait for end');
  if (!forceSequential && isCli && !!process?.env?.MSHOULD_FAST) return runTestsInParallel();
  running = true;
  const tasks = cloneAndReset();
  const total = tasks.filter((i) => !!i.test).length;
  begin(total);
  const startTime = Date.now();
  for (const test of tasks) {
    if (opts.PRINT_TREE && !test.test) log(`${test.prefix}${test.message}`);
    if (!test.test) continue;
    await runTest(test, opts.PRINT_TREE, opts.PRINT_MULTILINE, opts.STOP_AT_ERROR);
  }
  finalize(total, startTime);
  running = false;
  return total;
}

async function runTestsWhen(importMetaUrl: string) {
  if (!isCli) throw new Error('cannot be used outside of CLI');
  // @ts-ignore
  const url = await import('node:url');
  return importMetaUrl === url.pathToFileURL(process.argv[1]).href ? runTests() : undefined;
}

// Doesn't support tree and multiline
// TODO: support beforeEach, afterEach
async function runTestsInParallel(): Promise<number> {
  if (!isCli) throw new Error('must run in cli');
  if ('deno' in process.versions) return runTests(true);
  const tasks = cloneAndReset().filter((i) => !!i.test); // Filter describe elements
  const total = tasks.length;
  const startTime = Date.now();
  const runTestPar = (info: StackItem) => runTest(info, false, false, opts.STOP_AT_ERROR);

  let cluster: any, err: any;
  let totalW = Number.parseInt(process.env.MSHOULD_FAST, 10);
  if (totalW === 1) totalW = 0;
  try {
    // @ts-ignore
    cluster = (await import('node:cluster')).default;
    // @ts-ignore
    if (!totalW) totalW = (await import('node:os')).cpus().length;
  } catch (error) {
    err = error;
  }
  if (!cluster || !totalW!) throw new Error('parallel tests are not supported: ' + err);

  // the code is ran in workers
  if (!cluster.isPrimary) {
    process.on('error', (err: any) => console.log('internal error:', 'child crashed?', err));
    let tasksDone = 0;
    const id = cluster.worker.id;
    const strId = 'W' + id;
    for (let i = 0; i < tasks.length; i++) {
      if (i % totalW !== id - 1) continue;
      await runTestPar(tasks[i]);
      tasksDone++;
    }
    process.send({ name: 'parallelTests', worker: strId, tasksDone, errorLog });
    process.exit();
  }

  // the code is ran in primary process
  return await new Promise((resolve, reject) => {
    begin(total, totalW);
    console.log();
    const workers: any[] = [];
    let tasksDone = 0;
    let workersDone = 0;

    cluster.on('exit', (worker: { id: any; process: { pid: any } }, code: any) => {
      if (!code) return;
      const msg = `Worker W${worker.id} (pid: ${worker.process.pid}) crashed with code: ${code}`;
      // @ts-ignore
      console.error(color('red', msg));
      workers.forEach((w) => w.kill()); // Shutdown other workers
      reject(new Error(msg));
    });
    for (let i = 0; i < totalW; i++) {
      const worker = cluster.fork();
      workers.push(worker);
      worker.on('error', (err: any) => reject(err));
      worker.on('message', (msg: { name: string; tasksDone: number; errorLog: string[] }) => {
        if (!msg || msg.name !== 'parallelTests') return;
        workersDone++;
        tasksDone += msg.tasksDone;
        msg.errorLog.forEach((item) => errorLog.push(item));
        if (workersDone === totalW) {
          if (tasksDone === total) {
            finalize(total, startTime);
            resolve(tasksDone);
          } else {
            reject(new Error('internal error: not all tasks have been completed'));
          }
        }
      });
    }
  });
}

/**
 * Registers test for future running.
 * Would not auto-run, needs `it.run()` to be called at some point.
 * See {@link TestFunction} for methods.
 * @param message test title
 * @param test function, may be async
 */
const it: TestFunction = (message, test) => register({ message, test, children: [] });
it.only = (message, test) => register((onlyStack = { message, test, children: [], only: true }));
it.skip = (message, test) => register({ message, test, children: [], skip: true });
it.run = runTests;
it.runWhen = runTestsWhen;
it.runParallel = runTestsInParallel;
it.opts = opts;

export { it, describe, beforeEach, afterEach, it as should };
export default it;
