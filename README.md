# micro-should

Simplest zero-dependency testing framework, a drop-in replacement for Mocha.

Supports async cases. Works with any assertion library.

* `should(title, case)` (or `it(title, case)`) syntax
* `should.only(title, case)` allows to limit tests to only one case
* `should.skip(title, case)` allows to skip functions instead of commenting them out
* `describe(prefix, cases)` for nested execution
* `should.run()` must always be executed in the end
* `should.runParallel()` for CPU-intensive tasks, would ramp up threads equal to CPU count

> npm install micro-should

![](https://raw.githubusercontent.com/paulmillr/micro-should/e60028e947f3158c46314ef105b51b2a2948c025/screenshot.png)

## Usage

```js
const { should } = require('micro-should');
const assert = require('assert'); // You can use any assertion library (e.g. Chai or Expect.js), example uses built-in nodejs

should('add two numbers together', () => {
  assert.equal(2 + 2, 4);
});

should('catch errors', () => {
  assert.throws(() => {
    throw new Error('invalid');
  });
});

should('produce correct promise result', async () => {
  const fs = require('fs').promises;
  const data = await fs.readFile('README.md', 'utf-8');
  assert.ok(data.includes('Minimal testing'));
});

// should.only("execute only one test", () => {
//   assert.ok(true);
// });

// should.skip("disable one test by using skip", () => {
//   assert.ok(false); // would not execute
// })

// Nested
const { describe } = require('micro-should');
describe('during any time of day', () => {
  describe('without hesitation', () => {
    should('multiply two numbers together', () => {
      assert.equal(2 * 2, 4);
    });

    should('multiply three numbers together', () => {
      assert.equal(3 * 3 * 3, 27);
    });
  });
});

// Execute this at the end of a file.
should.run();
```

## License

MIT (c) Paul Miller (https://paulmillr.com), see LICENSE file.
