/*! micro-should - MIT License (c) 2019 Paul Miller (paulmillr.com) */
export const options = {
  printTree: true,
  printMultiline: true,
  stopAtError: true,
};

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  reset: '\x1b[0m',
};
// We can write 'pending' test name and then overwrite it with actual result by using ${up}.
// However, if test prints something to STDOUT, last line would get removed.
// We can wrap process.stdout also, but in that case there can be issues with non-node.js env.
// But we already use node modules for parallel cases, so maybe worth investigating.
const up = '\x1b[A';

const LEAF_N = '├─';
const LEAF_E = '│ ';
const LEAF_L = '└─';
const LEAF_S = '  ';
// With padding
// const LEAF_N = '├─ ';
// const LEAF_E = '│  ';
// const LEAF_L = '└─ ';
// const LEAF_S = '   ';

async function run(info, printTree = false, multiLine = false, stopAtError = true) {
  if (!printTree && multiLine) console.log();
  const output = info.message;
  if (printTree && info.only) {
    for (const parent of info.path) console.log(`${parent.prefix}${parent.message}`);
  }

  const path = `${info.path.map((i) => i.message).join('/')}/`;

  // Skip is always single-line
  if (multiLine && !info.skip) {
    console.log(printTree ? `${info.prefix}${output}: ☆` : `☆ ${path}${output}:`);
  } else if (info.skip) {
    console.log(printTree ? `${info.prefix}${output} (skip)` : `☆ ${path}${output} (skip)`);
    return true;
  }
  const printResult = (color: keyof typeof C, symbol) =>
    console.log(
      printTree
        ? `${info.childPrefix}${C[color]}${output}: ${symbol}${C.reset}`
        : `${C[color]}${symbol} ${path}${output}${C.reset}`
    );
  try {
    await info.test();
    printResult('green', '✓');
    return true;
  } catch (error) {
    printResult('red', '☓');
    if (stopAtError) {
      throw error;
    } else {
      console.error(`${C.red}ERROR:${C.reset}`, error);
      return false;
    }
  }
}

type Test = () => {};
type Info = { message?: string; test?: Test; skip?: boolean; children?: Info[]; prefix?: string };
type Item = { message: string; test: Test };
class Stack {
  stack: Info[];
  constructor() {
    this.setInitial();
  }
  setInitial() {
    const obj: { children: [] } = { children: [] };
    this.stack = [obj];
  }
  bottom() {
    return this.stack[0];
  }
  top() {
    return this.stack[this.stack.length - 1];
  }
  pop() {
    return this.stack.pop();
  }
  clean() {
    this.stack.splice(0, this.stack.length); // Remove all elements
    this.setInitial();
  }

  add(info: Info) {
    const item = Object.assign({}, info, { children: [] });
    this.top().children.push(item);
    this.stack.push(item);
  }

  flatten(elm: Info) {
    function formatPrefix(depth, prefix, isLast) {
      if (depth === 0) return { prefix: '', childPrefix: '' };
      return {
        prefix: `${prefix}${isLast ? LEAF_L : LEAF_N}`,
        childPrefix: `${prefix}${isLast ? LEAF_S : LEAF_E}`,
      };
    }
    const out: Info[] = [];
    const walk = (elm: Info, depth = 0, isLast = false, prevPrefix = '', path: any[] = []) => {
      const { prefix, childPrefix } = formatPrefix(depth, prevPrefix, isLast);
      const newElm = { ...elm, prefix, childPrefix, path };
      out.push(newElm);
      path = path.concat([newElm]); // Save prefixes so we can print path in 'only' case

      for (let i = 0; i < elm.children.length; i++)
        walk(elm.children[i], depth + 1, i === elm.children.length - 1, childPrefix, path);
    };
    // Skip root
    for (const child of elm.children) walk(child);
    return out;
  }
}

const S = new Stack();
let only;

export function describe(message: string, fn: Test) {
  S.add({ message });
  fn(); // Run function in the context of current stack path
  S.pop();
}

function enqueue(info: Item) {
  S.add(info);
  S.pop(); // remove from stack since there are no children
}

function addSingleTest(message: string, test: Test) {
  enqueue({ message, test });
}
function addSkippedTest(message: string, test: Test) {
  enqueue({ message, test, skip: true });
}
function addOnlyTest(message: string, test: Test) {
  only = { message, test, only: true }; // shared module variable
  enqueue(only);
}
function consumeQueue() {
  const queue = () => S.flatten(S.bottom());
  let items = queue().slice();
  if (only) items = items.filter((i) => i.test === only.test);
  S.clean(); // Remove all elements, so next call won't process them twice
  only = undefined;
  return items;
}
function runTests() {
  const items = consumeQueue();
  // Return promise, so we can wait before section is complete without breaking anything
  return (async () => {
    for (const test of items) {
      if (options.printTree && !test.test) console.log(`${test.prefix}${test.message}`);
      if (!test.test) continue;
      await run(test, options.printTree, options.printMultiline, options.stopAtError);
    }
  })();
}

export const should = (message: string, test: Test) => addSingleTest(message, test);
export const it = should;
should.consumeQueue = consumeQueue;
should.only = addOnlyTest;
should.skip = addSkippedTest;
should.run = runTests;
