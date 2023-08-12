import request from 'supertest'
import express from 'express'
import { trail } from '../index';
import bodyparser from 'body-parser'
import { sleep } from './utils';

const edgeApp = express();

edgeApp.use(bodyparser.json()); // express.json() is only available since 4.16.0

edgeApp.get('/', (req, res) => {
  res.send({})
});

edgeApp.get('/request-url/:key', (req, res, next) => {
  next();
}, (req, res) => {
  res.send(req.params)
});

edgeApp.post('/segment', async (req, res) => {
  const bodySegmentHook = await req.logSegmentPerf('body-segment', () => sleep(30, req.body as object));
  // @ts-expect-error
  bodySegmentHook === 'false string';
  res.send(bodySegmentHook);
})

const logger = {
  log: jest.fn((message: string) => {})
}

trail(edgeApp, {
  showRSS: true,
  logger: logger.log,
  showRequestedURL: [{ route: '/request-url/:key', method: 'get' }],
  ignoreMiddlewares: ['jsonParser']
})


describe('Edge cases', () => {
  it('Should display RSS with default trailId method (UUID)', async () => {
    const log = jest.spyOn(global.console, 'log');
    await request(edgeApp).get("/");
    await sleep(0);
    expect(log.mock.calls.length).toBe(0);
    expect(logger.log).toHaveBeenCalledTimes(5)
    expect(logger.log.mock.calls[3][0]).toMatch(/\[[0-9a-fA-F-]{36}\] \[\d+ bytes\] \u001b\[35mRoute \u001b\[32mGET \/ \u001b\[33m\d\.\d+ ms \u001b\[32m200 OK\u001b\[0m/)
  })
  it('Should display requestedUrl', async () => {
    expect((await request(edgeApp).get("/request-url/jest")).body).toEqual({ key: 'jest' });
    await sleep(0);
    expect(logger.log.mock.calls[3][0]).toContain('/request-url/jest')
    expect(logger.log.mock.calls[10][0]).toContain('/request-url/:key')
  })
  it('Should wait ~30ms to get { segment: 123 } back', async () => {
    expect((await request(edgeApp).post("/segment").send({ segment: 123 })).body).toEqual({ segment: 123 });
    expect(logger.log.mock.calls.length).toBe(5);
    expect(logger.log.mock.calls[3][0]).toMatch(/elapsed:.+(2[5-9]|3[0-5])\.\d+/);
  })
})