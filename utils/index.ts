import { Express } from 'express';
import { getCfg } from '../config';
import { HandlerType, Route, RouteMatcher, StackItem } from '../ts';
import { generateRouteMatcherGroup } from './config';

const config = getCfg();

export const getRuntime = () => {
  const runtime = (process as any).isBun || process.versions.bun ? 'bun' : 'node'
  const { engines } = require('../package.json');
  return {
    runtime,
    version: process.versions[runtime],
    trailCompatibility: engines[runtime]
  }
}

const sanitizePackageVersion = (version: string) => version.match(/[0-9.]+/).shift() as `${number}.${number}.${number}`;

export const isRuntimeCompatible = (runtime: ReturnType<typeof getRuntime>) => sanitizePackageVersion(runtime.version).localeCompare(sanitizePackageVersion(runtime.trailCompatibility), undefined, { numeric: true, sensitivity: 'base' }) >= 0

export const getRSS = (): '' | ` [${number} bytes]` => {
  if (!config[6]) return ''
  // BUN: memoryUsage on process since v0.6.14
  let rss = process.memoryUsage?.().rss;
  /* istanbul ignore next */ 
  if (rss === undefined) {
    try {
      // BUN: bun:jsc available since v0.5.1
      const { memoryUsage } = require('bun:jsc');
      rss = memoryUsage().current
    } catch (e) {}
  }
  return ` [${rss} bytes]`
}

export const isStackItemRoute = (stackItem: StackItem | StackItem<HandlerType.ROUTE>): stackItem is StackItem<HandlerType.ROUTE> => typeof stackItem.route === 'object';

export const formatAnonymousRoute = (idx: number): `<anonymous (${number})>` => `<anonymous (${idx})>`;

/**
 * __[ODD-3]__: Under 4.0 ```app.stack``` is defined, after is ```app._router.stack```
 */
export const getStack = (app: Express): (StackItem | StackItem<HandlerType.ROUTE>)[] => app.stack || app._router.stack

/*
  PAPER: Let's start by saying that the timing difference between the worst possible matcher (a simple naive implementation
  without caching or transforming the original RouteMatcher given by the consumer) and this approach of grouping and storing
  the RouteMatchers in pairs inside an array is insignificant, not only in real-case scenarios but also relatively speaking.

  However, if I can either mantain the same performance (in the worst case) or improve it just a little bit without causing
  any issues in the ecosystem (the app itself or the debugging process for other developers, though in this case, I'm the
  only one :p), why not?

  My first approach was caching results by grouping a Map inside a Map (for caching, this was the faster implementation). I
  also tested objects, storing keys instead of references, and using the route as the identifier for the outer Map and the
  matchGroup for the inner Map (and vice versa), etc.
  
  But there were many variables that significantly affected the performance results:
    - The order of the route matcher requested versus the route that is actually being requested
      (User requesting GET / --> Match:
          [{ route: '/', method: 'post' }, { route: '/todo', method: 'get' }, { route: '/', method: 'get' }])
          is different than
          [{ route: '/', method: 'get' }, { route: '/todo', method: 'get' }, { route: '/', method: 'post' }])
    - And even worst, the size of the RouteMatcher set, at which point exactly is caching worth it? 3 items? 9 items? 20 items?
      keep in mind that the previous constraint (The order of the route matcher) is also affecting the second point both
      separately and as a whole
          Naive faster: [{ route: '/', method: 'post' }, { route: '/todo', method: 'get' }, { route: '/', method: 'get' }]
          Map faster?: [{ route: '/', method: 'post' }, (3 items more...), { route: '/', method: 'get' }]

  Then, I thought of transforming the original RouteMatcher into an array because, as I already mentioned in Config, using
  arrays is faster than any other type of object (even though arrays are also "objects").

  So, I came up with an array of arrays ([['/', ['get', 'post']], ['/todo', ['put']]]) which worked better than the previous
  approaches in all the cases.
  
  But then I thought, "Mmmmm, maybe using a top-level array of pairs with only the methods encapsuled in an array is faster."
  Thus, instead of [['/', ['get', 'post']], ['/todo', ['put']]]
  I used ['/', ['get', 'post'], '/todo', ['put']] and my hypothesis was correct – which is the approach you're seeing now.
*/
export const isRouteMatching = (route: Route, matchGroup: ReturnType<typeof generateRouteMatcherGroup>) => {
  if (!matchGroup || typeof matchGroup === 'boolean') return !!matchGroup;
  const path = route.path;
  for (let i = 0; i < matchGroup.length; i+=2) {
    const matchItemPath = matchGroup[i] as Route['path'];
    if (matchItemPath !== path) continue;
    const matchItemMethods = matchGroup[i + 1] as RouteMatcher['method'][];
    for (let j = 0; j < matchItemMethods.length; j++) {
      const method = matchItemMethods[j];
      if (method === 'any' || route.methods[method]) {
        return true;
      }
    }
  }
  return false
}

export * from './report'
export * from './json'
export * from './color'
export * from './logger'
export * from './http'
export * from './config'