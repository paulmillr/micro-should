const { should } = require('.');
const assert = require('assert'); // built-in node.js assertion

should('add two numbers together', () => {
  assert.equal(2 + 2, 4);
});

should('catch errors', () => {
  assert.throws(() => {
    throw new Error('invalid');
  });
  // throw new Error("invalid");
});

should('produce correct promise result', async () => {
  const fs = require('fs').promises;
  const data = await fs.readFile('README.md', 'utf-8');
  assert.ok(data.includes('Minimal testing'));
});

const { describe } = require('.');

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
