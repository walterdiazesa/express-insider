import { randomUUID } from 'crypto';
import { Express, NextFunction, Request, Response } from 'express';
import { getCfg } from '../config';
import { ANONYMOUS_ROUTE, UNNAMED_ROUTES } from '../constants';
import { Method, StackItem, TrailResponseProps } from '../ts';
import { getStack, getStatusCode, isStackItemRoute, logger, logSegmentPerf, logStep } from '../utils';

const config = getCfg();
export const mutateRoutes = (app: Express) => {
  const stack = getStack(app);

  for (let stackIdx = 0; stackIdx < stack.length; stackIdx++) {
    const stackItem = stack[stackIdx];
    const { handle, route } = stackItem;

    stackItem.handle = async function (req: Request, res: Response, next: NextFunction) {
      const trail = res.trail;
      // [ODD-2]
      stackItem.name ??= handle.name;
      if (trail[9]) {
        return handle(req, res, next);
      }

      /* istanbul ignore next (deep conditional handling for express@4.0.0 support)*/
      const name = (UNNAMED_ROUTES[handle.name] ? route?.path : handle.name) || ANONYMOUS_ROUTE;
      const method = req.method as Uppercase<Method>;
      const trailId = trail[1];

      if (isStackItemRoute(stackItem)) {
        if (!trail[0]) {
          trail[0] = true; // if true is changed for [stackIdx] the value would be exactly the same as [res.stackRequested] *if* the route hasn't been ignored
          if (stackItem.route.stack.length !== 1) {
            const displayedURL = typeof stackItem.showRequestedURL === 'boolean' ? res.req.originalUrl : name;
            logger(trailId, logStep(trailId, { type: "handler", isRouteHandler: true, reqUrl: displayedURL, handlerName: name, method, routeHandlerStage: "JOIN" }));
          }
          // WARN: This condition was moved from outside 'if (!trail[0])', now the res.send.mutated statement seems redundant, need manual testing
          if (typeof stackItem.showResponse === 'boolean' && typeof (res.send as any).mutated === 'undefined') {
            const sendFn = res.send;
            res.send = function (body: any) {
              trail[10] = body;
              return sendFn.call(res, body);
            };
            (res.send as any).mutated = true;
          }
        }
      }
      else {
        trail[11].add(stackItem);
      }

      const init = performance.now();

      await handle(req, res, function (err: any) {
        if (!isStackItemRoute(stackItem) && (!config[2] || (typeof config[2] !== "boolean" && !config[2].includes((stackItem as StackItem).name)))) {
          /*
           PAPER: config[9] (alias from now as "t") can be undefined, so I can use
           "typeof t === 'function' ? t(timing) : timing" or
           "typeof t !== 'undefined' ? t(timing) : timing" or
           "t ? t(timing) : timing" or
           "t?.(timing) ?? timing", and it could seem as a trivial problem, and talking about performance it is,
           but the results are interesting
           Using Node:
           typeof t === "function": 110.39ms
           t?.(i) ?? i: 113.408ms
           typeof t !== "undefined": 129.592ms
           t ? t(i) : i: 141.379ms
           Using Bun:
           [95.33ms] typeof t === "function"
           [95.82ms] typeof t !== "undefined"
           [97.38ms] t ? t(i) : i
           [99.56ms] t?.(i) ?? i
           First thing is that the results from Bun are way more consistant, but it seems like 'typeof t === "function"' is always
           the clean winner, using '!== "undefined"' change their position in base of the runtime used, but then I remembered that
           t is not a function or undefined, t is an array which contains either a function or undefined, so I changed the tests and
           the results are now:
           Using Node:
           t[0]?.(i) ?? i: 144.282ms
           typeof t[0] === "function": 157.628ms
           typeof t[0] !== "undefined": 188.261ms
           t[0] ? t[0](i) : i: 191.445ms
           Using Bun (Now the results vary a lot, almost every time the positions change, but as they are not spread for more than a couple
           ms is basically a tie):
           [99.59ms] typeof t[0] !== "undefined"
           [99.90ms] t[0] ? t[0](i) : i
           [100.18ms] t[0]?.(i) ?? i
           [104.07ms] typeof t[0] === "function"
           So now, it looks like for Bun they are equally as performant but for Node, the clear winner is the choosen approach (t[0]?.(i) ?? i)
           which is overall the most consistant
          */
          const timing = performance.now() - init;
          const middlewareHandlerLogger = () => logger(trailId, logStep(trailId, { type: "handler", elapsed: config[9]?.(timing) ?? timing, method, isRouteHandler: false, handlerName: name }));
          /* istanbul ignore next (unnecessary deep coverage)*/
          if (typeof trail[14] === 'number') setTimeout(middlewareHandlerLogger); else middlewareHandlerLogger();
        }
        // [ODD-1] Fixable by try-catch
        const isNext = stack[stackIdx + 2] // Could be route middleware (with .route) or just middleware
        if (isNext) return next(err); 
      });
      trail[11].delete(stackItem);
      if (!trail[11].size && !trail[12]) {
        trail[12] = true;
        // For route cases, requestedRoute is equal to route (defined above), but for middlewares below it's not the same
        const requestedRoute = stack[trail[13]];
        // Change process.nextTick -> setTimeout0 would fix [CASE 12] when no await
        setTimeout(() => logger(trailId, logStep(trailId, { type: "wrapper", action: "finish", method, reqUrl: requestedRoute.route.path, elapsed: config[9]?.(performance.now() - trail[8]) ?? performance.now() - trail[8] }), { req, res }));
      }
    };
  }
}

export const initTracer = (app: Express) => function initTracer(req: Request, res: Response, next: NextFunction) {
  const trailId = config[0]?.(req, res) || randomUUID();
  const trail = new Array(11) as unknown as TrailResponseProps['trail'];
  res.trail = trail;
  trail[1] = trailId;
  const method = req.method as Uppercase<Method>;
  
  const requestedRouteIdx = getStack(app).findIndex((stack) => stack.regexp.test(req.originalUrl) && stack.route?.methods[method.toLowerCase()]);
  trail[13] = requestedRouteIdx;
  const requestedStackRoute = requestedRouteIdx !== -1 && getStack(app)[requestedRouteIdx];
  trail[9] = requestedRouteIdx === -1 || typeof requestedStackRoute.ignore === 'boolean';

  if (!requestedStackRoute) {
    logger(trailId, logStep(trailId, { type: "wrapper", action: "not found", method, reqUrl: req.originalUrl }));
  } else if (!trail[9]) {
    trail[11] = new Set();
    trail[11].add(requestedStackRoute)
    const path = requestedStackRoute.route.path;
    req.logSegmentPerf = logSegmentPerf.bind({ req, res, path });
    logger(trailId, logStep(trailId, { type: "wrapper", action: "start", method, reqUrl: path }));
    trail[8] = performance.now();
    res.once("finish", () => {
      const displayedURL = typeof requestedStackRoute.showRequestedURL === 'boolean' ? req.originalUrl : path;
      trail[7] = true;
      if (requestedStackRoute.route.stack.length === 1) {
        return;
      }
      const perfNow = performance.now();
      // On lib/routes trail[3](routeIdx) so opposite conditional?
      if ((trail[6] === undefined || trail[6] !== trail[3]) && trail[2] === trail[3]) {
        logger(trailId, logStep(trailId, { type: "handler", reqUrl: displayedURL, handlerName: trail[4], method, isRouteHandler: true, routeHandlerStage: "OPENER" }));
      }
      const statusCode = getStatusCode(res);
      const timingSended = perfNow - trail[5];
      /* istanbul ignore next (unnecessary deep coverage)*/
      logger(trailId, logStep(trailId, { type: "handler", method, reqUrl: displayedURL, elapsed: config[9]?.(timingSended) ?? timingSended, statusCode, handlerName: trail[15] ?? trail[4], isRouteHandler: true, routeHandlerStage: "RESPONSE SENDED" }));
      const timingTotal = perfNow - trail[8];
      /* istanbul ignore next (unnecessary deep coverage)*/
      logger(trailId, logStep(trailId, { type: "handler", method, reqUrl: displayedURL, elapsed: config[9]?.(timingTotal) ?? timingTotal, statusCode, handlerName: trail[15] ?? trail[4], isRouteHandler: true, routeHandlerStage: "RESPONSE TOTAL" }));
      if (trail[10] && typeof requestedStackRoute.showResponse === 'boolean') {
        logger(trailId, logStep(trailId, { type: 'report', trailId, reqUrl: displayedURL, method, routeHandlerStage: 'RESPONSE TOTAL', payload: trail[10], handlerName: trail[15] ?? trail[4] }));
      }
    });
  }

  next();
};
