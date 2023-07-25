import { getCfg } from '../config'
import { Express } from 'express'
import { HandlerType, Method, Route, StackItem, StackItemType } from '../ts';

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
  if (rss === undefined) {
    try {
      // BUN: bun:jsc available since v0.5.1
      const { memoryUsage } = require('bun:jsc');
      rss = memoryUsage().current
    } catch (e) {}
  }
  return ` [${rss} bytes]`
}
export const getStackItemType = (stackItem: StackItem): StackItemType => (stackItem.route ? HandlerType.ROUTE : HandlerType.MIDDLEWARE);

export const formatAnonymousRoute = (idx: number): `<anonymous (${number})>` => `<anonymous (${idx})>`;

/**
 * __[ODD-3]__: Under 4.0 ```app.stack``` is defined, after is ```app._router.stack```
 */
export const getStack = (app: Express): StackItem[] => app.stack || app._router.stack

export const isRouteMatching = (route: Route, matcher: { route: `/${string}`; method: 'any' | Uppercase<Method> | Method | 'ANY' }[] | boolean) => {
  if (!matcher || typeof matcher === 'boolean') return !!matcher;
  let match = false;
  const path = route.path;
  for (let i = 0; i < matcher.length; i++) {
    const matchR = matcher[i];
    if (matchR.route !== path) continue;
    const sanitizedMethod = matchR.method.toLowerCase();
    if (sanitizedMethod === 'any' || route.methods[sanitizedMethod]) {
      match = true;
      break;
    }
  }
  return match
}

export * from './report'
export * from './json'
export * from './color'
export * from './logger'
export * from './http'
export * from './config'