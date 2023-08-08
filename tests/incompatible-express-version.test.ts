import express from 'express'
import { trail } from '../index';

export const incompatibleApp = express();

incompatibleApp.get('/', (req, res) => {
  res.send({ working: true })
})

describe('Incompatible express version', () => {
  it('Should throw incompatible express version error', async () => {
    // __[ODD-3]__: Under 4.0 ```app.stack``` is defined, after is ```app._router.stack```
    // Simulate express under 4.0
    incompatibleApp.stack = incompatibleApp._router.stack;
    delete incompatibleApp._router.stack;
    expect(() => trail(incompatibleApp)).toThrowError(/.+Express versions below.+/);
  })
})