import request from 'supertest'
import express from 'express'
import { trail } from '../index';

const sleep = (ms: number, payload?: object) => new Promise((r) => setTimeout(() => r(payload), ms));

const appDelayEach = express();

appDelayEach.get('/', async (req, res, next) => {
  await sleep(50);
  res.send({ working: true })
  next();
}, async (req, res) => {
  await sleep(50);
})

appDelayEach.get('/delay-400', async (req, res, next) => {
  await sleep(400);
  res.send({ working: true })
})

const DELAY_MS = 200;

let testId = 1;

trail(appDelayEach, {
  trailId: () => `test-id(${testId})`,
  timingFormatter: (elapsed) => 0,
  logStrategy: 'delay each',
  delayMs: DELAY_MS,
  ignoreMiddlewares: true
});

describe('trail on logStrategy delay each configuration', () => {
  it('Should handle GET /', async () => {
    const log = jest.spyOn(global.console, 'log');
    request(appDelayEach).get("/").then();
    await sleep(25)
    testId++;
    request(appDelayEach).get("/delay-400").then();
    await sleep(50)
    expect(log.mock.calls.length).toBe(0);
    await sleep(150 + DELAY_MS)
    expect(log.mock.calls).toMatchSnapshot();
    await sleep(250 + DELAY_MS)
    expect(log.mock.calls).toMatchSnapshot();
  })
});