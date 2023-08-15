import http from "http";
import { getCfg } from "../../config";
import { Request, Response } from 'express'
import { COLOR, METHOD_COLOR, ROUTE_HANDLER_STAGE_TAG } from "../../constants";
import { Method, PayloadReport, HandlerType } from "../../ts";
import { colorizedJSON, getStatusCodeColor, getRSS, logger } from "../../utils";
// BUN: util/types available since v0.4.0
import { isArrayBufferView, isArrayBuffer, isSharedArrayBuffer } from "util/types";
import { getCircularReplacer } from "../json";

const config = getCfg();

/**
 * @param {string} segment Name or identifier to display on Segment output
 * 
 * @description A performance hook to obtain information about the metrics and bundle size of specific segments of your application, automatically appended to the logs of their corresponding requested stack
 * @returns
 * - If a callback (synchronous process, asynchronous process, or promise) is provided as the second argument this hook will automatically be executed when that callback finish running, displaying the metrics and the bundle size returned by the callback (if any)
 * - If not, you will need to manually execute the callback returned by the hook, and pass an argument if you want to display the bundle size of that argument with the normal metrics
 * 
 * @example
 * ```
 * import express from "express";
 * import { trail } from "express-insider";
 * import { db } from "./database";
 * import { sendWelcomeMail } from "mail-provider";
 * const app = express();
 * ...
 * app.get('/', async (req, res) => {
 *  // Manually-executed segment hook to measure performance of "db.assets.findMany"
 *  const segment = req.logSegmentPerf('db - assets');
 *  const assets = await db.assets.findMany();
 *  segment(assets); // Execute metrics and display the bundle size from "assets", which is going to be sended to the client later
 *  res.send(assets);
 * })
 * 
 * app.get('/:id', async (req, res) => {
 *  // Self-executed segment hook to measure "db.assets.findOne" performance, and assign the value retrieved from the database to variable "asset" directly
 *  const asset = req.logSegmentPerf('db - asset', () => db.assets.findOne(req.params.id));
 * res.send(asset)
 * })
 * 
 * app.post('/user', async (req, res) => {
 *  try {
 *    const user = await db.user.insert(req.body);
 *    // Send email and print metrics to measure cost from our current mail provider
 *    await req.logSegmentPerf("mail provider - send welcome to user", async () => await sendWelcomeMail(user)); // Self-executed when sendWelcomeMail finish
 *    res.send({ info: 'user created successfully!', action: 'please check your mail' });
 *  } catch {
 *    res.status(400).send({ error: 'something went wrong' })
 *  }
 * })
 * ```
 */
export function logSegmentPerf(segment: string): <T>(bundle?: T) => T;
export function logSegmentPerf<T>(segment: string, cb: () => Promise<T>): Promise<T>;
export function logSegmentPerf<T>(segment: string, cb: () => T): T;
// logSegmentPerf will throw if cb fails
export function logSegmentPerf(segment: string, cb?: () => any) {
  const { req, res, path } = this as { req: Request; res: Response; path: string };
  const init = performance.now();
  /**
   * @description Prints to console and report the metrics about the parent segment, if `bundle` is `string` | `object`
   * | `NodeJS.ArrayBufferView` | `ArrayBuffer` | `SharedArrayBuffer` it will also print information about the size (in bytes) of `bundle`
   * @returns `bundle`
   */
  /* istanbul ignore next (segment is already tested on [CASE 2] and tests/edge-cases.test.ts)*/
  const execPerfHook = <T>(bundle?: T) => {
    const trailId = res.trail[1];
    const showBundle = bundle && (["string", "object"].includes(typeof bundle) || isArrayBufferView(bundle) || isArrayBuffer(bundle) || isSharedArrayBuffer(bundle));
    const timing = performance.now() - init;
    const segmentElapsed = config[9]?.(timing) ?? timing;
    const nextLinePad = " ".repeat(`[${trailId}]${getRSS()} Segment `.length);
    const method = req.method as Uppercase<Method>;
    const calledWithArgs = colorizedJSON(nextLinePad, { query: req.query, params: req.params }, [,false]);
    config[8]?.(trailId, { type: 'segment', reqUrl: path, method, name: segment, bundle, elapsed: segmentElapsed, ...(Object.keys({...req.query, ...req.params}).length && { args: {
      ...(Object.keys(req.query).length && { query: req.query }),
      ...(Object.keys(req.params).length && { params: req.params })
    } }) });
    logger(
      trailId,
      `${COLOR.fgBlue}Segment ${COLOR.reset}${COLOR.bright}${segment}${COLOR.reset} on ${METHOD_COLOR[method]}${method} ${path}${COLOR.reset}\n${nextLinePad}elapsed: ${COLOR.fgYellow}${segmentElapsed} ms${COLOR.reset}${calledWithArgs ? `\n${nextLinePad}calledWith: ${calledWithArgs}` : ''}${
        !showBundle ? "" : `\n${nextLinePad}bundle: ${COLOR.fgYellow}${Buffer.byteLength(typeof bundle === "object" ? JSON.stringify(bundle) : (bundle as Parameters<typeof Buffer.byteLength>[0]))} bytes${COLOR.reset}`
      }`
    );
    return bundle;
  };
  if (typeof cb === "function") {
    const cbResult = cb();
    if (cbResult instanceof Promise) return cbResult.then(execPerfHook);
    return execPerfHook(cbResult);
  }
  return execPerfHook;
}

export const formatPayload = (payload: PayloadReport) => {
  switch (payload.type) {
    case "wrapper":
      // GET / started
      if (payload.action === "not found") return `${COLOR.bright}Unknown ${COLOR.reset}${METHOD_COLOR[payload.method]}${payload.method} ${payload.reqUrl}${COLOR.reset}${COLOR.bright} not found!${COLOR.reset}`;
      return `${METHOD_COLOR[payload.method]}${payload.method} ${payload.reqUrl} ${COLOR.reset}${COLOR.bright}${payload.action}${COLOR.reset}${payload.action === "finish" ? `, elapsed time since begin: ${COLOR.fgYellow}${payload.elapsed} ms${COLOR.reset}` : ""}`;
    case "handler":
      // Middleware query 0.05143131314363 ms
      if (payload.isRouteHandler === false) return `${COLOR.fgCyan}${HandlerType.MIDDLEWARE} ${COLOR.fgGreen}${payload.handlerName} ${COLOR.fgYellow}${payload.elapsed} ms${COLOR.reset}`;

      const handlerParent = `${payload.method} ${payload.reqUrl}`;
      // Route GET /
      if (payload.routeHandlerStage === "JOIN") return `${COLOR.fgMagenta}${HandlerType.ROUTE} ${METHOD_COLOR[payload.method]}${handlerParent}${COLOR.reset}`;

      // Route GET / 0.05143131314363 ms 200 OK
      if (payload.routeHandlerStage === "UNIQUE HANDLER") return `${COLOR.fgMagenta}${HandlerType.ROUTE} ${METHOD_COLOR[payload.method]}${handlerParent} ${COLOR.fgYellow}${payload.elapsed} ms ${getStatusCodeColor(payload.statusCode)}${payload.statusCode} ${http.STATUS_CODES[payload.statusCode]}${COLOR.reset}`;

      let padStart = " ".repeat(`${HandlerType.ROUTE} ${handlerParent}`.length);
      //            <anonymous (0)>  0.05143131314363 ms
      if (payload.routeHandlerStage === "HANDLER" || payload.routeHandlerStage === "OPENER") return `${padStart}${COLOR.fgGreen}${payload.handlerName}${payload.routeHandlerStage === "OPENER" ? "" : ` ${COLOR.fgYellow}${payload.elapsed} ms`}${COLOR.reset}`;

      //                            (send response) 55.36708399653435 ms
      padStart += " ".repeat(payload.handlerName.length);
      if (payload.routeHandlerStage === "RESPONSE TOTAL") return `${payload.middleware ? " ".repeat(`${HandlerType.MIDDLEWARE} ${payload.handlerName} `.length) : padStart}${getStatusCodeColor(payload.statusCode)}${payload.statusCode} ${http.STATUS_CODES[payload.statusCode]}${COLOR.reset}, total elapsed time: ${COLOR.fgYellow}${payload.elapsed} ms${COLOR.reset}`;
      return `${padStart}${ROUTE_HANDLER_STAGE_TAG[payload.routeHandlerStage]}${COLOR.fgYellow}${payload.elapsed} ms${COLOR.reset}`;
    case "report":
      const nextLinePad = " ".repeat(`[${payload.trailId}]${getRSS()} `.length)
      switch (payload.for) {
        case "handler":
          if (payload.routeHandlerStage === 'UNIQUE HANDLER') return `${COLOR.bright}[RESPONSE]:${COLOR.reset} ${colorizedJSON(nextLinePad, JSON.parse(payload.payload))}`
          const _handlerParent = `${payload.method} ${payload.reqUrl}`;
          let _padStart = " ".repeat(`${HandlerType.ROUTE} ${_handlerParent}`.length);
          _padStart += " ".repeat(payload.handlerName.length);
          return `${_padStart}${COLOR.bright}[RESPONSE]:${COLOR.reset} ${colorizedJSON(`${nextLinePad} ${_padStart}`, JSON.parse(payload.payload))}`
        case "additament":
          const sanitizedAdditament = JSON.parse(JSON.stringify(payload.payload, getCircularReplacer()));
          if (!payload.print || payload.print === "multiline") {
            return colorizedJSON(nextLinePad, sanitizedAdditament, [,true])
          } else if (payload.print === "next-line-multiline") {
            return `\n${colorizedJSON("", sanitizedAdditament, [,true])}`
          } else {
            return `\n${colorizedJSON("", sanitizedAdditament, [true, undefined])}`
          }
      }
  }
};

export const logStep = (trailId: string, payload: PayloadReport) => {
  config[8]?.(trailId, payload);
  return formatPayload(payload);
}