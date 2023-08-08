import express from 'express'
import { trail } from '../index';

export const incompatibleApp = express();

incompatibleApp.get('/', (req, res) => {
  res.send({ working: true })
})

describe('Incompatible runtime version', () => {
  it('Should throw incompatible Bun version error', async () => {
    (process as any).isBun = true; // Injected by Bun Runtime
    process.versions['bun'] = '0.5.0'; // Limit defined on package.json > engines
    expect(() => trail(incompatibleApp)).toThrowError(/.+Bun versions below.+/);
  })
  it('Should throw incompatible Node version error', async () => {
    (process as any).isBun = false;
    delete process.versions['bun'];
    delete process.versions['node'];
    process.versions['node'] = '15.14.0'; // Limit defined on package.json > engines
    expect(() => trail(incompatibleApp)).toThrowError(/.+Node versions below.+/);
  })
})