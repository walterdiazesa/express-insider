import request from 'supertest'
import express from 'express'
import { trail } from '../index';
import { awaitConsoleLog } from './utils';

const sleep = (ms: number, payload?: object) => new Promise((r) => setTimeout(() => r(payload), ms));

const appAwaitEach = express();

appAwaitEach.get('/', async (req, res) => {
  await sleep(100);
  res.send({ working: true })
})

appAwaitEach.get('/fail-route', (req, res) => {
  res.status(404).send({ working: false })
})

trail(appAwaitEach, {
  trailId: () => 'test-id',
  timingFormatter: (elapsed) => 0,
  logStrategy: 'await-each',
  skip: (req, res) => res.statusCode === 404,
});

describe('trail on logStrategy await-each configuration', () => {
  it('Should handle GET /', async () => {
    const log = jest.spyOn(global.console, 'log');
    request(appAwaitEach).get("/").then();
    expect(log.mock.calls.length).toBe(0);
    await sleep(300)
    expect(log.mock.calls).toMatchSnapshot();
  })
  it('Should ignore GET /fail-route', async () => {
    const log = jest.spyOn(global.console, 'log');
    await request(appAwaitEach).get("/fail-route");
    await awaitConsoleLog(0, log.mock.calls);
    expect(log.mock.calls.length).toBe(0);
  })
});