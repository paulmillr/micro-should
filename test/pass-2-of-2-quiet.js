import { should } from '../index.js';
should('2 + 2', () => {});
should('2 + 3', () => {});
should.opts.QUIET = true;
should.opts.FAST = 0;
should.run();
