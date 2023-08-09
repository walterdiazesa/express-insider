import request from 'supertest'
import express from 'express'
import { trail } from '../index';
import { awaitConsoleLog } from './utils';

export const basicApp = express();

basicApp.get('/', (req, res) => {
  res.send({ working: true })
})

basicApp.get('/fail-route', (req, res) => {
  res.status(400).send({ working: false })
})

const router = express.Router();
router.use(function routerMiddleware(req, res, next) {
  next();
})
router.get('/', (req, res) => {
  res.send({ info: 'Router index' })
});
router.get('/query', (req, res) => {
  res.send(req.query)
});
router.get('/:dyn', (req, res) => {
  res.send({ info: req.params.dyn })
});
router.post('/info', (req, res) => {
  res.send({ info: 'Using router' })
});
basicApp.use('/router', router);

trail(basicApp, {
  trailId: () => 'test-id',
  timingFormatter: (value: number) => 0,
  showRequestedURL: [{ route: '/router/:dyn', method: 'get' }]
});

describe('trail on basic configuration', () => {
  it('Should show handler message for unknown route', async () => {
    const log = jest.spyOn(global.console, 'log');
    await request(basicApp).get("/unknown-route");
    expect(log).toHaveBeenCalledWith('[test-id] \x1B[1mUnknown \x1B[0m\x1B[32mGET /unknown-route\x1B[0m\x1B[1m not found!\x1B[0m');
  })
  it('Should show handler message for fail route', async () => {
    const log = jest.spyOn(global.console, 'log');
    await request(basicApp).get("/fail-route");
    await awaitConsoleLog(0, log.mock.calls)
    expect(log.mock.calls.length).toBe(5)
    expect(log.mock.calls[0][0]).toBe('[test-id] [32mGET /fail-route [0m[1mstart[0m')
    expect(log.mock.calls[1][0]).toMatch(/\[test-id\] \u001b\[36mMiddleware \u001b\[32mquery \u001b\[33m\d ms\u001b\[0m/)
    expect(log.mock.calls[2][0]).toMatch(/\[test-id\] \u001b\[36mMiddleware \u001b\[32mexpressInit \u001b\[33m\d ms\u001b\[0m/)
    expect(log.mock.calls[3][0]).toMatch(/\[test-id\] \u001b\[35mRoute \u001b\[32mGET \/fail-route \u001b\[33m\d ms \u001b\[31m400 Bad Request\u001b\[0m/)
    expect(log.mock.calls[4][0]).toMatch(/\[test-id\] \u001b\[32mGET \/fail-route \u001b\[0m\u001b\[1mfinish\u001b\[0m, elapsed time since begin: \u001b\[33m\d ms\u001b\[0m/)
  })
  it('Should work with route from router', async () => {
    const log = jest.spyOn(global.console, 'log');
    expect((await request(basicApp).get("/router")).body).toEqual({ info: 'Router index' });
    expect((await request(basicApp).get("/router/query?abc=123")).body).toEqual({ abc: "123" });
    expect((await request(basicApp).get("/router/dynamic")).body).toEqual({ info: 'dynamic' });
    expect((await request(basicApp).post("/router/info")).body).toEqual({ info: 'Using router' });
    await awaitConsoleLog(0, log.mock.calls)
    expect(log.mock.calls).toMatchSnapshot();
  })
})