import { getCfg } from "../../config";
import { Request, Response } from 'express'
import { getRSS } from '../../utils'

let loggerDump = new Map<string, string>();
let tmSet: NodeJS.Timeout | Record<string, NodeJS.Timeout> | any;

export const initDelayEach = () => {tmSet = {}};

export const logger = (trace: string, message: string, flush?: { req: Request, res: Response }) => {
  const config = getCfg();
  if (config.logStrategy === "real time") return console.log(`[${trace}]${getRSS()} ${message}`);
  else if (config.logStrategy === "delay all") {
    if (tmSet) clearTimeout(tmSet);
    tmSet = setTimeout(() => loggerDump.forEach((_, trailId) => flushPool(trailId)), config.delayMs ?? 500);
  } else if (config.logStrategy === "delay each") {
    if (tmSet[trace]) clearTimeout(tmSet[trace]);
    tmSet[trace] = setTimeout(() => flushPool(trace), config.delayMs ?? 500);
  }

  loggerDump.set(trace, `${loggerDump.get(trace) ?? ""}[${trace}]${getRSS()} ${message}\n`);
  if (config.logStrategy === "await each" && flush) {
    // config.skip could throw
    if (!config.skip || !config.skip(flush.req, flush.res)) flushPool(trace);
    else loggerDump.delete(trace);
  }
};

const flushPool = (trace: string) => {
  const message = `${loggerDump.get(trace)}`;
  if (!message) return;
  console.log(message.slice(0, -1));
  loggerDump.delete(trace);
};