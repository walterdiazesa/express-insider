import request from 'supertest'
import express from 'express'
import { trail } from '../index';

export const someMiddlewareApp = express();

someMiddlewareApp.use(function mockBeforeMiddleware(req, res, next) {
  next();
})

someMiddlewareApp.get('/', (req, res) => {
  res.send({ working: true })
})

someMiddlewareApp.get('/some-route', async function (req, res, next) {
  next();
}, async function mockAfterSomeRouteRouteMiddleware(req, res, next) {
  res.send({ working: true });
}, async function neverRouteMiddleware(req, res) {})

trail(someMiddlewareApp, {
  trailId: () => 'test-id',
  timingFormatter: (elapsed) => 0,
  ignoreMiddlewares: ['expressInit']
});

describe('trail with no middleware output', () => {
  it('Should show handler message for GET / route', async () => {
    const log = jest.spyOn(global.console, 'log');
    await request(someMiddlewareApp).get("/");
    expect(log.mock.calls).toMatchSnapshot();
  })
  it('Should show handler message for GET /some-route route', async () => {
    const log = jest.spyOn(global.console, 'log');
    await request(someMiddlewareApp).get("/some-route");
    expect(log.mock.calls).toMatchSnapshot();
  })
})