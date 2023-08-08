import { digest, generateRouteMatcherGroup } from '.'

describe('utils/config', () => {
  it('Should return 1 in both Jest and TS Intellisense', () => {
    // @ts-expect-error
    digest('logger') === 2;
    expect(digest('logger')).toBe(1);
  })
  it('Should generate a routeMatcherGroup without duplicates', () => {
    expect(generateRouteMatcherGroup(
      [{ route: '/the-route', method: 'get' }, { route: '/some-other-route', method: 'any' }, { route: '/the-route', method: 'GET' }]
    )).toEqual(["/the-route", ["get"], "/some-other-route", ["any"]])
  });
  it('Should generate a routeMatcherGroup without *route* duplicates', () => {
    expect(generateRouteMatcherGroup(
      [{ route: '/the-route', method: 'GET' }, { route: '/some-other-route', method: 'any' }, { route: '/the-route', method: 'post' }]
    )).toEqual(["/the-route", ["get", "post"], "/some-other-route", ["any"]])
  });
})