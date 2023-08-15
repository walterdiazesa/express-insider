import request from 'supertest'
import express from 'express'
import { trail } from '../index';
import { awaitConsoleLog } from './utils';
import { TrailOptions } from '../ts';

export const app = express();

app.get('/', (req, res) => {
  res.send({ working: true })
})

const trailAdditaments: TrailOptions['trailAdditaments'] = {
  condition: (req, res) => {
    req.rawHeaders.splice(req.rawHeaders.findIndex((header) => header === "Host"), 2)
    return req
  },
};

trail(app, {
  trailId: () => 'test-id',
  timingFormatter: (value: number) => 0,
  trailAdditaments,
});

describe('trailAdditaments', () => {
  it('Should output complete Request object with default "multiline" option', async () => {
    const log = jest.spyOn(global.console, 'log');
    await request(app).get("/");
    await awaitConsoleLog(0, log.mock.calls)
    expect(log.mock.calls.length).toEqual(6);
    expect(log.mock.calls[1][0]).toMatchSnapshot();
  })
  it('Should output complete Request object with explicitly specified "multiline" option', async () => {
    trailAdditaments.print = "multiline";
    const log = jest.spyOn(global.console, 'log');
    await request(app).get("/");
    await awaitConsoleLog(0, log.mock.calls)
    expect(log.mock.calls.length).toEqual(6);
    expect(log.mock.calls[1][0]).toMatchSnapshot();
  })
  it('Should output complete Request object with "next-line-multiline" option', async () => {
    trailAdditaments.print = "next-line-multiline";
    const log = jest.spyOn(global.console, 'log');
    await request(app).get("/");
    await awaitConsoleLog(0, log.mock.calls)
    expect(log.mock.calls.length).toEqual(6);
    expect(log.mock.calls[1][0]).toMatchSnapshot();
  })
  it('Should output complete Request object with "wrap" option', async () => {
    trailAdditaments.print = "wrap";
    const log = jest.spyOn(global.console, 'log');
    await request(app).get("/");
    await awaitConsoleLog(0, log.mock.calls)
    expect(log.mock.calls.length).toEqual(6);
    expect(log.mock.calls[1][0]).toMatchSnapshot();
  })
  it('Should NOT output anything', async () => {
    trailAdditaments.condition = (req, res) => {};
    const log = jest.spyOn(global.console, 'log');
    await request(app).get("/");
    await awaitConsoleLog(0, log.mock.calls)
    expect(log.mock.calls.length).toEqual(5);
  })
  it('Should NOT output anything because the condition returned false', async () => {
    trailAdditaments.condition = (req, res) => {
      if (req.url === '/') return false;
      return req;
    };
    const log = jest.spyOn(global.console, 'log');
    await request(app).get("/");
    await awaitConsoleLog(0, log.mock.calls)
    expect(log.mock.calls.length).toEqual(5);
  })
})