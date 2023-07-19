import request from 'supertest'
import express from 'express'
import { trail } from '../index';

const sleep = (ms: number, payload?: object) => new Promise((r) => setTimeout(() => r(payload), ms));

const appDelayAll = express();

appDelayAll.get('/', async (req, res, next) => {
  res.send({ working: true })
})

appDelayAll.get('/delay-200', async (req, res, next) => {
  await sleep(200);
  res.send({ working: true })
})

const DELAY_MS = 400;

let testId = 1;

trail(appDelayAll, {
  trailId: () => `test-id(${testId})`,
  timingFormatter: (elapsed) => 0,
  logStrategy: "delay all",
  delayMs: DELAY_MS,
  ignoreMiddlewares: true,
});

describe('trail on logStrategy delay all configuration', () => {
  it('Should handle GET /', async () => {
    const log = jest.spyOn(global.console, 'log');
    request(appDelayAll).get("/").then();
    await sleep(25)
    testId++;
    request(appDelayAll).get("/").then();
    await sleep(25)
    testId++;
    request(appDelayAll).get("/delay-200").then();
    await sleep(400); // After 400ms at least the GET '/' should had finished, but is still waiting for the GET '/delay-200' route
    expect(log.mock.calls.length).toBe(0);
    await sleep(400 + DELAY_MS)
    expect(log.mock.calls).toMatchSnapshot();
  })
});