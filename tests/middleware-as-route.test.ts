import request from 'supertest'
import express from 'express'
import { trail } from '../index';
import bodyparser from 'body-parser'
import { sleep } from './utils';

const app = express();

app.use(async function authMiddleware(req, res, next) {
  if (req.originalUrl === '/auth') return res.status(401).send({ error: 'Unauthorized' });
  if (req.originalUrl === '/auth-async') {
    await sleep(3);
    return res.status(400).send({ error: 'Something went wrong' })
  }
  next();
})

app.get('/', (req, res) => {
  res.send({ working: true })
});
app.get('/auth', (req, res) => {
  throw new Error('Should never get to this point')
});
app.get('/auth-async', (req, res) => {
  throw new Error('Should never get to this point')
});

trail(app, {
  trailId: () => 'test-id',
  timingFormatter: (timing) => 0,
  ignoreMiddlewares: ['query', 'expressInit', 'authMiddleware'],
  showResponse: [{ route: '/', method: 'get' }],
  showRequestedURL: [{ route: '/:id', method: 'get' }]
});

describe('Using middleware as route', () => {
  it('ignore authMiddleware when no response is coming from it', async () => {
    const log = jest.spyOn(global.console, 'log');
    await request(app).get("/");
    await sleep(0);
    expect(log.mock.calls).toMatchSnapshot();
  })
  it('response from sync middleware', async () => {
    const log = jest.spyOn(global.console, 'log');
    await request(app).get("/auth");
    await sleep(0);
    expect(log.mock.calls).toMatchSnapshot();
  })
  it('response from async middleware', async () => {
    const log = jest.spyOn(global.console, 'log');
    await request(app).get("/auth-async");
    await sleep(0);
    expect(log.mock.calls).toMatchSnapshot();
  })
})