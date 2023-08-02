import request from 'supertest'
import express from 'express'
import { trail } from '../index';
import { awaitConsoleLog } from './utils';

export const noColorApp = express();

noColorApp.get('/', (req, res) => {
  res.send({ working: true })
})

noColorApp.all('/all-route', (req, res) => {
  res.status(304).send({ working: true })
})

trail(noColorApp, {
  trailId: () => 'test-id',
  timingFormatter: (elapsed) => 0,
  showColors: false
});

describe('trail with no color', () => {
  it('Should show handler message for GET / route', async () => {
    const log = jest.spyOn(global.console, 'log');
    await request(noColorApp).get("/");
    await awaitConsoleLog(0, log.mock.calls)
    expect(log.mock.calls).toMatchSnapshot();
  })
  it('Should show handler message for [ALL] /all-route route', async () => {
    const log = jest.spyOn(global.console, 'log');
    await request(noColorApp).get("/all-route");
    await awaitConsoleLog(0, log.mock.calls)
    expect(log.mock.calls).toMatchSnapshot();
  })
})