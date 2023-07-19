import { getCfg } from '../config'
import { Express } from 'express'
import { HandlerType, StackItem, StackItemType } from '../ts';

export const getRSS = (): '' | ` [${number} bytes]` => {
  if (!getCfg().showRSS) return ''
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

export * from './report'
export * from './json'
export * from './color'
export * from './logger'
export * from './http'