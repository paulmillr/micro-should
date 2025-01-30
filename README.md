# micro-should

Micro testing framework with familiar syntax, multi-env ESM support & parallel execution.

- Syntax like in Mocha / Jest / Vitest
- Runs on node.js, deno, bun, cloudflare, browsers and others
- No "global" magic: `it.run()` in the end simplifies logic and browser runs
- Easily parallelized in node.js and bun
- Beautiful tree reporter, optional "quiet" dot reporter

Trusted by noble cryptography and [other packages](https://github.com/paulmillr/micro-should/network/dependents).

## Usage

> `npm install micro-should`

> `jsr add jsr:@paulmillr/micro-should`

Basic methods:

- `should(title, case)` or `it(title, case)` syntax to register a test function
- `should.run()` or `it.run()` must always be executed in the end

ENV variables:

- `MSHOULD_FAST=1` enables parallel execution in node.js and Bun. Values >1 will set worker count.
- `MSHOULD_QUIET=1` enables "quiet" dot reporter

Additional methods:

- `describe(prefix, cases)` for nested execution
- `beforeEacn(fn)` to execute code before a function in `describe` block
- `afterEach` to execute code after a function in `describe` block
- `should.only(title, case)` allows to limit tests to only one case
- `should.skip(title, case)` allows to skip functions instead of commenting them out
- `describe.skip(prefix, cases)` to skip describe()-s
- `should.runWhen(import.meta.url)` helper ensures CLI tests are not `run` twice if you're using many test files
  - Executes .run() when passed argument is equal to CLI-passed file name.
    Consider a project with 3 test files: a.test.js, b.test.js, all.js. all.js imports a.test.js and b.test.js.
    User runs node a.test.js; then node all.js;
  - Writing `it.run()` everywhere would fail, because it would try to run same tests twice.
  - However, `it.runWhen(import.meta.url)` would succeed, because it detects whether
    current file is launched from CLI and not imported.

![](https://raw.githubusercontent.com/paulmillr/micro-should/e60028e947f3158c46314ef105b51b2a2948c025/screenshot.png)

### Basic

To run the example in parallel / quiet setting, save it as a.test.js:

    MSHOULD_FAST=1 MSHOULD_QUIET=1 node a.test.js

```js
import { should } from 'micro-should';
import * as assert from 'node:assert'; // examples with node:assert
// you can use any assertion library, e.g. Chai or Expect.js

should('add two numbers together', () => {
  assert.equal(2 + 2, 4);
});

should('catch errors', () => {
  assert.throws(() => {
    throw new Error('invalid');
  });
});

should('produce correct promise result', async () => {
  const fs = await import('node:fs/promises');
  const data = await fs.readFile('README.md', 'utf-8');
  assert.ok(data.includes('Minimal testing'));
});
should.run();
```

### Nested

```js
describe('during any time of day', () => {
  describe('without hesitation', () => {
    should('multiply two numbers together', () => {
      assert.equal(2 * 2, 4);
    });

    should.skip('disable one test by using skip', () => {
      assert.ok(false); // would not execute
    });

    // should.only("execute only one test", () => {
    //   assert.ok(true);
    // });
  });
});

should.run();
```

### Auto-run with cli, do not run when imported

```js
// a.test.js
import { should } from 'micro-should';
should('2 + 2', () => {
  if (2 + 2 !== 4) throw new Error('invalid');
});
should.runWhen(import.meta.url);
```

```js
// b.test.js
import * from './a.test.js';
should.runWhen(import.meta.url);
```

### Options

Options which can be set via command line, as environment variables:

- `MSHOULD_FAST=1` enables parallel execution in node.js and Bun. Values >1 will set worker count.
- `MSHOULD_QUIET=1` enables "quiet" dot reporter

Options which can be set via code:

```js
import { should } from 'micro-should';
should.opts.STOP_AT_ERROR = false; // default=true
should.opts.MSHOULD_QUIET = true; // same as env var
```

## License

MIT (c) Paul Miller (https://paulmillr.com), see LICENSE file.
