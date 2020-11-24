const red = "\x1b[31m";
const green = "\x1b[32m";
const reset = "\x1b[0m";

async function run({ message, test, skip }) {
  console.log();
  let output = `should ${message.replace(/^should\s+/, "")}`;
  console.log(`☆ ${output}:`);
  if (skip) {
    console.log(`(skip) ${output}`);
    return true;
  }
  try {
    let result = await test();
    console.log(`${green}✓ ${output}${reset}`);
    return true;
  } catch (error) {
    console.error(`${red}☓ ${output}${reset}`);
    throw error;
  }
}

let queue = [];
let only;
const should = (message, test) => queue.push({ message, test });
should.only = (message, test) => (only = { message, test });
should.skip = (message, test) => queue.push({ message, test, skip: true });
should.run = () => {
  const items = only ? [only] : queue;
  queue = [];
  only = undefined;
  (async () => {
    for (const test of items) {
      await run(test);
    }
  })();
};
exports.should = should;
exports.it = should;
exports.default = should;
