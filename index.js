const red = '\x1b[31m';
const green = '\x1b[32m';
const reset = '\x1b[0m';

async function run({ message, test, skip, parallel }) {
  console.log();
  let output = `should ${message.replace(/^should\s+/, '')}`;
  if (!parallel) console.log(`☆ ${output}:`);
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

async function runParallel(tasks, cb) {
  // node.js / common.js-only
  const os = require('os');
  const cluster = require('cluster');

  const clusterId = cluster && cluster.worker ? `W${cluster.worker.id}` : 'M';
  let WORKERS = +process.env.WORKERS || os.cpus().length;
  // Workers
  if (!cluster.isMaster) {
    process.on('error', (err) => console.log('shit?'));
    let tasksDone = 0;
    for (let i = 0; i < tasks.length; i++) {
      if (cluster.worker.id - 1 !== i % WORKERS) continue;
      await cb({ parallel: true, ...tasks[i] });
      tasksDone++;
    }
    process.send({ name: 'parallelTests', worker: clusterId, tasksDone });
    process.exit();
  }
  // Master
  return await new Promise((resolve, reject) => {
    console.log(`Starting parallel tests with ${WORKERS} workers and ${tasks.length} tasks`);
    cluster.on('exit', (worker, code) => {
      if (!code) return;
      console.error(
        `${red}Worker W${worker.id} (pid: ${worker.process.pid}) died with code: ${code}${reset}`
      );
      reject(new Error('Test worker died in agony'));
    });
    let tasksDone = 0;
    let workersDone = 0;
    for (let i = 0; i < WORKERS; i++) {
      const worker = cluster.fork();
      worker.on('error', (err) => reject(err));
      worker.on('message', (msg) => {
        if (!msg || msg.name !== 'parallelTests') return;
        workersDone++;
        tasksDone += msg.tasksDone;
        if (workersDone === WORKERS) {
          if (tasksDone !== tasks.length) reject(new Error('Not all tasks finished.'));
          else resolve(tasksDone);
        }
      });
    }
  });
}

let prefix = '';
let only;
function addPrefix(message) {
  return [prefix, message].filter((a) => a).join(' ');
}
function enqueue(info) {
  const { test, skip } = info;
  should.queue.push({ message: addPrefix(info.message), test, skip });
}
const should = (message, test) => enqueue({ message, test });
should.queue = [];
should.only = (message, test) => (only = { message, test });
should.skip = (message, test) => enqueue({ message, test, skip: true });
should.run = () => {
  const items = only ? [only] : should.queue;
  should.queue = [];
  only = undefined;
  (async () => {
    for (const test of items) {
      await run(test);
    }
  })();
};
should.runParallel = () => {
  const items = only ? [only] : should.queue;
  should.queue = [];
  only = undefined;
  return runParallel(items, run);
};
function describe(_prefix, fn) {
  const old = prefix;
  prefix = [old, _prefix].filter((a) => a).join(' ');
  fn();
  prefix = old;
}
module.exports = { should, it: should, describe, default: should };
