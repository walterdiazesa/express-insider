import request from 'supertest'
import express from 'express'
import { trail } from '../index';

export const noMiddlewareApp = express();

noMiddlewareApp.get('/', (req, res) => {
  res.send({ working: true })
})

trail(noMiddlewareApp, {
  trailId: () => 'test-id',
  timingFormatter: (elapsed) => 0,
  ignoreMiddlewares: true
});

describe('trail with no middleware output', () => {
  it('Should show handler message for GET / route', async () => {
    const log = jest.spyOn(global.console, 'log');
    await request(noMiddlewareApp).get("/");
    expect(log.mock.calls).toMatchSnapshot();
  })
})