import request from 'supertest'
import express from 'express'
import { trail } from '../index';
import { UNNAMED_ROUTES } from '../constants';
import { StackItem } from '../ts';
import { getStack } from '../utils';

export const initialMiddlewareApp = express();

initialMiddlewareApp.use(function thirdMiddleware(req, res, next) {
  next();
})

initialMiddlewareApp.use(function forthMiddleware(req, res, next) {
  next();
})

initialMiddlewareApp.get('/', (req, res) => {
  res.send({ working: true })
})

trail(initialMiddlewareApp, {
  trailId: (req) => (req as any).traceId,
  timingFormatter: (elapsed) => 0,
  initialImmutableMiddlewares: [
    function firstMiddleware(req, res, next) { next() },
    function secondMiddleware(req, res, next) { next() },
    function mockTraceMiddleware(req, res, next) { (req as any).traceId = 'trace-id'; next(); },
  ]
});

describe('trail with initial immutable middlewares', () => {
  it('Should show handler message for GET / route', async () => {
    const log = jest.spyOn(global.console, 'log');
    await request(initialMiddlewareApp).get("/");
    const logs = log.mock.calls.toString()
    expect(logs).toContain('trace-id');
    expect(logs).not.toContain('firstMiddleware');
    expect(logs).not.toContain('secondMiddleware');
    expect(logs).not.toContain('mockTraceMiddleware');
    // [ODD-2]
    expect(getStack(initialMiddlewareApp).map(({ name, handle }) => {
      if (!name) return handle.name  // express@<4.6.0
      return UNNAMED_ROUTES[name] ? "bound dispatch" : name // express@>=4.6.0
    })).toEqual([
      "firstMiddleware",
      "secondMiddleware",
      "mockTraceMiddleware",
      "initTracer",
      "query",
      "expressInit",
      "thirdMiddleware",
      "forthMiddleware",
      "bound dispatch",
    ])
  })
})