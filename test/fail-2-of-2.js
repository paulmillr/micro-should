import { should } from '../index.js';
should('2 + 2', () => {
  throw new Error('1');
})
should('2 + 3', () => {
  throw new Error('2');
})
should.opts.STOP_ON_ERROR = true;
should.run()