import { getCfg } from "../../config";
import { Request, Response } from 'express'
import { getRSS } from '../../utils'
import { TrailOptions } from "../../ts";

const config = getCfg();

let loggerDump = new Map<string, string>();
let tmSet: NodeJS.Timeout | Record<string, NodeJS.Timeout> | any;

export const initDelayEach = () => {tmSet = {}};
export const logger = (trace: string, message: string, flush?: { req: Request, res: Response }) => {
  if (config[11] === "real-time") return (config[1] ?? console.log)(`[${trace}]${getRSS()} ${message}`);
  else if (config[11] === "delay-all") {
    clearTimeout(tmSet);
    /* istanbul ignore next (functions already tested on each corresponding test file in tests/log-strategy-~)*/
    tmSet = setTimeout(() => loggerDump.forEach((_, trailId) => flushPool(trailId, config[1])), config[12] ?? 500);
  } else if (config[11] === "delay-each") {
    clearTimeout(tmSet[trace]);
    /* istanbul ignore next (functions already tested on each corresponding test file in tests/log-strategy-~)*/
    tmSet[trace] = setTimeout(() => flushPool(trace, config[1]), config[12] ?? 500);
  }

  loggerDump.set(trace, `${loggerDump.get(trace) ?? ""}[${trace}]${getRSS()} ${message}\n`);
  if (config[11] === "await-each" && flush) {
    // config.skip could throw
    if (!config[13] || !config[13](flush.req, flush.res)) flushPool(trace, config[1]);
    /* istanbul ignore next (useless coverage test)*/
    else loggerDump.delete(trace);
  }
};

const flushPool = (trace: string, logger?: TrailOptions['logger']) => {
  const message = loggerDump.get(trace);
  /* istanbul ignore next (useless coverage test)*/
  if (!message) return;
  (logger ?? console.log)(message.slice(0, -1));
  loggerDump.delete(trace);
};