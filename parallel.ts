import { cpus } from 'os';
import * as cluster from 'cluster';
const CPUS = cpus().length;

async function runParallel2(tasks, cb) {
  tasks = tasks.filter((i) => !!i.test); // Filter describe elements

  const clusterId = cluster && cluster.worker ? `W${cluster.worker.id}` : 'M';
  let WORKERS = +process.env.WORKERS || CPUS;
  // Workers
  if (!cluster.isMaster) {
    process.on('error', (err) => console.log('Error (child crashed?):', err));
    let tasksDone = 0;
    for (let i = 0; i < tasks.length; i++) {
      if (cluster.worker.id - 1 !== i % WORKERS) continue;
      await cb(tasks[i], false, false);
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

// Doesn't support tree and multiline
export const runParallel = () =>
  runParallel2(should.consumeQueue(), (info) => run(info, false, false, should.STOP_AT_ERROR));
