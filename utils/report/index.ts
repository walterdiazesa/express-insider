import http from "http";
import { getCfg } from "../../config";
import { Request, Response } from 'express'
import { COLOR, METHOD_COLOR, ROUTE_HANDLER_STAGE_TAG } from "../../constants";
import { Method, PayloadReport, HandlerType } from "../../ts";
import { colorizedJSON, getStatusCodeColor, getRSS, logger } from "../../utils";
// BUN: util/types available since v0.4.0
import { isArrayBufferView, isArrayBuffer, isSharedArrayBuffer } from "util/types";

const config = getCfg();

export function logSegmentPerf(segment: string): (bundle?: object) => void;
export function logSegmentPerf(segment: string, cb: () => Promise<any>): Promise<void>;
export function logSegmentPerf(segment: string, cb: () => any): void;
// logSegmentPerf will throw if cb fails
export function logSegmentPerf(segment: string, cb?: () => any) {
  const { req, res, path } = this as { req: Request; res: Response; path: string };
  const init = performance.now();
  const execPerfHook = (bundle?: object | Parameters<typeof Buffer.byteLength>[0]) => {
    const trailId = res.trail[1];
    const showBundle = bundle && (["string", "object"].includes(typeof bundle) || isArrayBufferView(bundle) || isArrayBuffer(bundle) || isSharedArrayBuffer(bundle));
    const timing = performance.now() - init;
    const segmentElapsed = config[9]?.(timing) ?? timing;
    const nextLinePad = " ".repeat(`[${trailId}]${getRSS()} Segment `.length);
    const calledWithArgs = colorizedJSON(nextLinePad, { query: req.query, params: req.params }, false);
    config[8]?.(trailId, { type: 'segment', reqUrl: path, method: req.method as Method, name: segment, bundle, elapsed: segmentElapsed, ...(Object.keys({...req.query, ...req.params}).length && { args: {
      ...(Object.keys(req.query).length && { query: req.query }),
      ...(Object.keys(req.params).length && { params: req.params })
    } }) })
    logger(
      trailId,
      `${COLOR.fgBlue}Segment ${COLOR.reset}${COLOR.bright}${segment}${COLOR.reset} on ${METHOD_COLOR[req.method.toUpperCase()]}${req.method} ${path}${COLOR.reset}\n${nextLinePad}elapsed: ${COLOR.fgYellow}${segmentElapsed} ms${COLOR.reset}${calledWithArgs ? `\n${nextLinePad}calledWith: ${calledWithArgs}` : ''}${
        !showBundle ? "" : `\n${nextLinePad}bundle: ${COLOR.fgYellow}${Buffer.byteLength(typeof bundle === "object" ? JSON.stringify(bundle) : bundle)} bytes${COLOR.reset}`
      }`
    );
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
      if (payload.action === "not found") return `${COLOR.bright}Unknown ${COLOR.reset}${METHOD_COLOR[payload.method.toUpperCase()]}${payload.method} ${payload.reqUrl}${COLOR.reset}${COLOR.bright} not found!${COLOR.reset}`;
      return `${METHOD_COLOR[payload.method.toUpperCase()]}${payload.method} ${payload.reqUrl} ${COLOR.reset}${COLOR.bright}${payload.action}${COLOR.reset}${payload.action === "finish" ? `, elapsed time since begin: ${COLOR.fgYellow}${payload.elapsed} ms${COLOR.reset}` : ""}`;
    case "handler":
      // Middleware query 0.05143131314363 ms
      if (payload.isRouteHandler === false) return `${COLOR.fgCyan}${HandlerType.MIDDLEWARE} ${COLOR.fgGreen}${payload.handlerName} ${COLOR.fgYellow}${payload.elapsed} ms${COLOR.reset}`;

      const handlerParent = `${payload.method} ${payload.reqUrl}`;
      // Route GET /
      if (payload.routeHandlerStage === "JOIN") return `${COLOR.fgMagenta}${HandlerType.ROUTE} ${METHOD_COLOR[payload.method.toUpperCase()]}${handlerParent}${COLOR.reset}`;

      // Route GET / 0.05143131314363 ms 200 OK
      if (payload.routeHandlerStage === "UNIQUE HANDLER") return `${COLOR.fgMagenta}${HandlerType.ROUTE} ${METHOD_COLOR[payload.method.toUpperCase()]}${handlerParent} ${COLOR.fgYellow}${payload.elapsed} ms ${getStatusCodeColor(payload.statusCode)}${payload.statusCode} ${http.STATUS_CODES[payload.statusCode]}${COLOR.reset}`;

      let padStart = " ".repeat(`${HandlerType.ROUTE} ${handlerParent}`.length);
      //            <anonymous (0)>  0.05143131314363 ms
      if (payload.routeHandlerStage === "HANDLER" || payload.routeHandlerStage === "OPENER") return `${padStart}${COLOR.fgGreen}${payload.handlerName}${payload.routeHandlerStage === "OPENER" ? "" : ` ${COLOR.fgYellow}${payload.elapsed} ms`}${COLOR.reset}`;

      //                            (send response) 55.36708399653435 ms
      padStart += " ".repeat(payload.handlerName.length);
      if (payload.routeHandlerStage === "RESPONSE TOTAL") return `${padStart}${getStatusCodeColor(payload.statusCode)}${payload.statusCode} ${http.STATUS_CODES[payload.statusCode]}${COLOR.reset}, total elapsed time: ${COLOR.fgYellow}${payload.elapsed} ms${COLOR.reset}`;
      return `${padStart}${ROUTE_HANDLER_STAGE_TAG[payload.routeHandlerStage]}${COLOR.fgYellow}${payload.elapsed} ms${COLOR.reset}`;
    case "report":
      const nextLinePad = " ".repeat(`[${payload.trailId}]${getRSS()} `.length)
      if (payload.routeHandlerStage === 'UNIQUE HANDLER') return `${COLOR.bright}[RESPONSE]:${COLOR.reset} ${colorizedJSON(nextLinePad, JSON.parse(payload.payload))}`
      const _handlerParent = `${payload.method} ${payload.reqUrl}`;
      let _padStart = " ".repeat(`${HandlerType.ROUTE} ${_handlerParent}`.length);
      _padStart += " ".repeat(payload.handlerName.length);
      return `${_padStart}${COLOR.bright}[RESPONSE]:${COLOR.reset} ${colorizedJSON(`${nextLinePad} ${_padStart}`, JSON.parse(payload.payload))}`
  }
};

export const logStep = (trailId: string, payload: PayloadReport) => {
  config[8]?.(trailId, payload);
  return formatPayload(payload);
}