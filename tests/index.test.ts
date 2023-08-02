import request from 'supertest'
import express from 'express'
import bodyparser from 'body-parser'
import { trail } from '../index';
import { CASE_2_SEGMENT_FETCH_SNAPSHOT, CASE_2_SEGMENT_NO_FETCH_SNAPSHOT } from './__custom_snapshots__';
import { awaitConsoleLog, sleep } from './utils';

const isFetchAvailable = () => typeof fetch === 'function'; // parseFloat(process.versions.node) >= 17.5

const app = express();

app.use(bodyparser.json()); // express.json() is only available since 4.16.0

app.get('/', (req, res) => {
  res.send({ working: true })
})

app.get('/no-response-route', (req, res) => {
  res.send({ payload: 'hidden' })
})

app.get('/ignore-route', (req, res) => {
  res.send({ working: false })
})

app.get('/response-route', (req, res) => {
  res.send({ payload: 'some payload', items: [{ id: 1 }, { id: 2 }] })
})

app.post(
  "/conditional-route",
  async function (req, res, next) {
    if (req.body.segment) {
      if (isFetchAvailable()) await req.logSegmentPerf("async fetch", async () => await fetch("https://jsonplaceholder.typicode.com/todos/1").then((page) => page.json()));
      await req.logSegmentPerf("async promise", () => sleep(100));
      await req.logSegmentPerf("async function", async () => await sleep(100, { payload: "some string payload" }));
      req.logSegmentPerf("sync", () => {
        console.log("sync perf");
        return { response: 99 };
      });
      const cb = req.logSegmentPerf("no cb");
      cb();
    }
    if (req.body.first) res.send({ first: true });
    if (req.body.firstCleaner) await sleep(100);
    if (req.body.next || req.body.second || req.body.third) next();
  },
  async function (req, res, next) {
    if (req.body.sleepBefore) await sleep(50);
    if (req.body.second) res.send({ second: true });
    if (req.body.sleepAfter) await sleep(150);
    if (req.body.next || req.body.third) next();
  },
  async function lastmiddle(req, res, next) {
    await sleep(150);
    if (req.body.third) res.send({ third: true });
    next();
  },
);

const reportFn = jest.fn();

trail(app, {
  trailId: () => 'test-id',
  timingFormatter: (elapsed) => 0,
  ignoreRoutes: [{ method: "any", route: "/ignore-route" }], 
  report: (id, payload) => {
    reportFn(id, payload)
  },
  showResponse: [{ method: "get", route: "/response-route" }],
});

describe('trail on custom configuration', () => {
  it('Should ignore GET /ignore-route', async () => {
    const log = jest.spyOn(global.console, 'log');
    await request(app).get("/ignore-route");
    expect(reportFn).toBeCalledTimes(0);
    expect(log.mock.calls.length).toBe(0);
  })
  it('Should NOT output GET /no-response-route payload', async () => {
    const log = jest.spyOn(global.console, 'log');
    await request(app).get("/no-response-route");
    await awaitConsoleLog(0, log.mock.calls)
    expect(log.mock.calls.toString()).not.toContain('[RESPONSE]')
    expect(log.mock.calls).toMatchSnapshot();
  })
  it('Should output GET /response-route payload', async () => {
    const log = jest.spyOn(global.console, 'log');
    await request(app).get("/response-route");
    await awaitConsoleLog(0, log.mock.calls)
    expect(reportFn).toBeCalledTimes(7);
    expect(reportFn.mock.calls[0]).toEqual(["test-id", {"action": "start", "method": "GET", "reqUrl": "/response-route", "type": "wrapper"}])
    expect(reportFn.mock.calls[1]).toEqual(["test-id", {"elapsed": 0, "handlerName": "query", "isRouteHandler": false, "method": "GET", "type": "handler"}])
    expect(reportFn.mock.calls[2]).toEqual(["test-id", {"elapsed": 0, "handlerName": "expressInit", "isRouteHandler": false, "method": "GET", "type": "handler"}])
    expect(reportFn.mock.calls[3]).toEqual(["test-id", {"elapsed": 0, "handlerName": "jsonParser", "isRouteHandler": false, "method": "GET", "type": "handler"}])
    expect(reportFn.mock.calls[4]).toEqual(["test-id", {"elapsed": 0, "handlerName": "<anonymous (0)>", "isRouteHandler": true, "method": "GET", "reqUrl": "/response-route", "routeHandlerStage": "UNIQUE HANDLER", "statusCode": 200, "type": "handler"}])
    expect(reportFn.mock.calls[5]).toEqual(["test-id", {"trailId": "test-id", "method": "GET", "payload": "{\"payload\":\"some payload\",\"items\":[{\"id\":1},{\"id\":2}]}", "reqUrl": "/response-route", "routeHandlerStage": "UNIQUE HANDLER", "type": "report"}])
    expect(reportFn.mock.calls[6]).toEqual(["test-id", {"action": "finish", "elapsed": 0, "method": "GET", "reqUrl": "/response-route", "type": "wrapper"}])
    expect(log.mock.calls.toString()).toContain('[RESPONSE]')
    expect(log.mock.calls).toMatchSnapshot();
  })

  /**
   * CASE 1:
   * body: { first: true }
   * Should send response on first route middleware and not continue further
   * 
   * CASE 2:
   * body: { first: true, segment: true }
   * Should send response on first route middleware and not continue further while printing logSegmentPerf cases
   * 
   * CASE 3:
   * body: { first: true, firstCleaner: true }
   * Should send response on first route middleware and not continue further with a sleep function before finalizing
   * 
   * CASE 4:
   * body: { first: true, next: true }
   * Should send response on first route middleware and continue further
   * 
   * CASE 5:
   * body: { first: true, next: true, firstCleaner: true }
   * Should send response on first route middleware and continue further with a sleep function before finalizing
   * 
   * CASE 6:
   * body: { second: true }
   * Should send response on second route middleware
   * 
   * CASE 7:
   * body: { second: true, sleepBefore: true }
   * Should send response on second route middleware without cleanup nor total message
   * 
   * CASE 8:
   * body: { second: true, sleepAfter: true }
   * Should send response on second route middleware with cleanup and total message
   * 
   * CASE 9:
   * body: { second: true, sleepBefore: true, sleepAfter: true }
   * Should send response on second route middleware with correct route middlewares order
   * 
   * CASE 10:
   * body: { second: true, sleepBefore: true, sleepAfter: true, next: true }
   * Should send response on second route middleware with correct route middlewares order and continue
   * 
   * CASE 11:
   * body: { second: true, next: true }
   * Should send response on second route middleware and continue, check that is incorrectly ordered
   * 
   * CASE 12:
   * body: { third: true }
   * Should send response on third route middleware
  */
  it('Should handle [CASE 1] with POST /conditional-route', async () => {
    const log = jest.spyOn(global.console, 'log');
    await request(app).post("/conditional-route").send({ first: true });
    await awaitConsoleLog(0, log.mock.calls)
    expect(log.mock.calls).toMatchSnapshot();
  })
  it('Should handle [CASE 2] with POST /conditional-route', async () => {
    const log = jest.spyOn(global.console, 'log');
    await request(app).post("/conditional-route").send({ first: true, segment: true });
    await awaitConsoleLog(0, log.mock.calls)
    expect(log.mock.calls.toString()).toBe(isFetchAvailable() ? CASE_2_SEGMENT_FETCH_SNAPSHOT : CASE_2_SEGMENT_NO_FETCH_SNAPSHOT)
  })
  it('Should handle [CASE 3] with POST /conditional-route', async () => {
    const log = jest.spyOn(global.console, 'log');
    await request(app).post("/conditional-route").send({ first: true, firstCleaner: true });
    await awaitConsoleLog(300, log.mock.calls)
    expect(log.mock.calls).toMatchSnapshot();
  })
  it('Should handle [CASE 4] with POST /conditional-route', async () => {
    const log = jest.spyOn(global.console, 'log');
    await request(app).post("/conditional-route").send({ first: true, next: true });
    await awaitConsoleLog(300, log.mock.calls)
    expect(log.mock.calls).toMatchSnapshot();
  })
  it('Should handle [CASE 5] with POST /conditional-route', async () => {
    const log = jest.spyOn(global.console, 'log');
    await request(app).post("/conditional-route").send({ first: true, next: true, firstCleaner: true });
    await awaitConsoleLog(300, log.mock.calls)
    expect(log.mock.calls).toMatchSnapshot();
  })
  it('Should handle [CASE 6] with POST /conditional-route', async () => {
    const log = jest.spyOn(global.console, 'log');
    await request(app).post("/conditional-route").send({ second: true });
    await awaitConsoleLog(300, log.mock.calls)
    expect(log.mock.calls).toMatchSnapshot();
  })
  it('Should handle [CASE 7] with POST /conditional-route', async () => {
    const log = jest.spyOn(global.console, 'log');
    await request(app).post("/conditional-route").send({ second: true, sleepBefore: true });
    await awaitConsoleLog(300, log.mock.calls)
    expect(log.mock.calls).toMatchSnapshot();
  })
  it('Should handle [CASE 8] with POST /conditional-route', async () => {
    const log = jest.spyOn(global.console, 'log');
    await request(app).post("/conditional-route").send({ second: true, sleepAfter: true });
    await awaitConsoleLog(300, log.mock.calls)
    expect(log.mock.calls).toMatchSnapshot();
  })
  it('Should handle [CASE 9] with POST /conditional-route', async () => {
    const log = jest.spyOn(global.console, 'log');
    await request(app).post("/conditional-route").send({ second: true, sleepBefore: true, sleepAfter: true });
    await awaitConsoleLog(300, log.mock.calls)
    expect(log.mock.calls).toMatchSnapshot();
  })
  it('Should handle [CASE 10] with POST /conditional-route', async () => {
    const log = jest.spyOn(global.console, 'log');
    await request(app).post("/conditional-route").send({ second: true, sleepBefore: true, sleepAfter: true, next: true });
    await awaitConsoleLog(300, log.mock.calls)
    expect(log.mock.calls).toMatchSnapshot();
  })
  it('Should handle [CASE 11] with POST /conditional-route', async () => {
    const log = jest.spyOn(global.console, 'log');
    await request(app).post("/conditional-route").send({ second: true, next: true });
    await awaitConsoleLog(300, log.mock.calls)
    expect(log.mock.calls).toMatchSnapshot();
  })
  it('Should handle [CASE 12] with POST /conditional-route', async () => {
    const log = jest.spyOn(global.console, 'log');
    await request(app).post("/conditional-route").send({ third: true });
    await awaitConsoleLog(300, log.mock.calls)
    expect(log.mock.calls).toMatchSnapshot();
  })
})