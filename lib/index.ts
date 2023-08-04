import { randomUUID } from "crypto";
import { Request, Response,  NextFunction, Express } from "express";
import { getCfg } from "../config";
import { ANONYMOUS_ROUTE, UNNAMED_ROUTES } from "../constants";
import { BaseExpressRequest, BaseExpressResponse, HandlerType, Method, Route, StackItem, TrailResponseProps } from "../ts";
import { logger, logStep, logSegmentPerf, getStackItemType, getStatusCode, getStack, isRouteMatching, formatAnonymousRoute } from "../utils";
import { routeHandler } from "./routes";

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

      const name = (UNNAMED_ROUTES[handle.name] ? route?.path : handle.name) || ANONYMOUS_ROUTE; // Here?
      const method = req.method as Uppercase<Method>;
      const trailId = trail[1];

      if (getStackItemType(stackItem) === HandlerType.ROUTE) {
        routeHandler({ name, method, res, stackItem, trailId, trail });
      }
      else {
        trail[11].add(stackItem);
      }

      const init = performance.now();

      await handle(req, res, function (err: any) {
        if (getStackItemType(stackItem) !== HandlerType.ROUTE && (!config[2] || (typeof config[2] !== "boolean" && !config[2].includes(stackItem.name)))) {
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
        setTimeout(() => logger(trailId, logStep(trailId, { type: "wrapper", action: "finish", method, reqUrl: requestedRoute.path, elapsed: config[9]?.(performance.now() - trail[8]) ?? performance.now() - trail[8] }), { req, res }));
      }
    };
  }
}

export const mutateStackRoutes = (app: Express) => {
  const stack = getStack(app);

  for (let stackIdx = 0; stackIdx < stack.length; stackIdx++) {
    const stackItem = stack[stackIdx];
    if (getStackItemType(stackItem) !== HandlerType.ROUTE || isRouteMatching(stackItem.route, config[3])) continue;
    
    const handle = stackItem.handle;
    const requestedRoute = stackItem.route;

    for (let routeIdx = 0; routeIdx < requestedRoute.stack.length; routeIdx++) {
      const routeStack = requestedRoute.stack[routeIdx];
      const routeStackHandle = routeStack.handle;
      const name = (UNNAMED_ROUTES[handle.name] ? requestedRoute?.path : handle.name) || ANONYMOUS_ROUTE;
      routeStack.handle = async function (req: Request, res: Response, next: NextFunction) {
        const trail = res.trail;
        const trailId = trail[1];
        const method = req.method as Uppercase<Method>;
        // [ODD-2], routeStack.name is not defined under express 4.6.0
        const routeStackName = routeStack.name === ANONYMOUS_ROUTE || !routeStackHandle.name || routeStackHandle.name === ANONYMOUS_ROUTE
          ? formatAnonymousRoute(routeIdx)
          : routeStack.name || routeStackHandle.name;

        if (!res.writableEnded) {
          trail[2] = routeIdx;
        }
        trail[3] = routeIdx;
        trail[4] = routeStackName;
        const init = performance.now();
        trail[5] = init;

        const displayedURL = isRouteMatching(requestedRoute, config[4]) ? req.originalUrl : name;

        let cleanerCall = false;
        trail[11].add(routeStack);
        await routeStackHandle(req, res, function (err) {
          trail[6] = routeIdx;
          if (res.writableEnded) {
            trail[14] ??= routeIdx;
            trail[15] ??= routeStackName;
          }
          
          if (!trail[7] && res.writableEnded && trail[2] === trail[3]) {
            logger(trailId, logStep(trailId, { type: "handler", isRouteHandler: true, routeHandlerStage: "OPENER", handlerName: routeStackName, method, reqUrl: displayedURL }));
          }
          
          const perfNow = performance.now();
          const timing = perfNow - init;
          const statusCode = getStatusCode(res);

          if (trail[14] === routeIdx && trail[7]) {
            cleanerCall = true;
            logger(trailId, logStep(trailId, { type: "handler", reqUrl: displayedURL, elapsed: config[9]?.(timing) ?? timing, statusCode, method, handlerName: routeStackName, isRouteHandler: true, routeHandlerStage: "CLEANUP HANDLER" }));
            logger(trailId, logStep(trailId, { type: "handler", reqUrl: displayedURL, elapsed: config[9]?.(timing) ?? timing, statusCode, method, handlerName: routeStackName, isRouteHandler: true, routeHandlerStage: "TOTAL HANDLER" }));
          } else {
            if ((trail[3] === routeIdx || trail[7]) && (trail[14] !== routeIdx)) {
              const routeHandlerLogger = () => logger(trailId, logStep(trailId, { type: "handler", reqUrl: displayedURL, elapsed: config[9]?.(timing) ?? timing, method, handlerName: routeStackName, isRouteHandler: true, routeHandlerStage: "HANDLER" }));
              if (res.writableEnded) setTimeout(routeHandlerLogger); else routeHandlerLogger();
            } else if (trail[14] !== trail[3] && Boolean(!trail[7] && res.writableEnded) === false) {
              logger(trailId, logStep(trailId, { type: "handler", isRouteHandler: true, routeHandlerStage: "OPENER", handlerName: routeStackName, method, reqUrl: displayedURL }));
            }
          }
          
          return next(err);
        });

        if (res.writableEnded) {
          trail[14] ??= routeIdx;
          trail[15] ??= routeStackName;
        }

        trail[11].delete(routeStack);
        if (!trail[11].size && !trail[12]) {
          trail[12] = true;
          setTimeout(() => logger(trailId, logStep(trailId, { type: "wrapper", action: "finish", method, reqUrl: name, elapsed: config[9]?.(performance.now() - trail[8]) ?? performance.now() - trail[8] }), { req, res }));
        }

        const perfNow = performance.now();
        const timing = perfNow - init;
        const statusCode = getStatusCode(res);

        if (requestedRoute.stack.length === 1) {
          logger(trailId, logStep(trailId, { type: "handler", reqUrl: displayedURL, elapsed: config[9]?.(timing) ?? timing, method, isRouteHandler: true, handlerName: routeStackName, routeHandlerStage: "UNIQUE HANDLER", statusCode }));
    
          if (trail[10] && isRouteMatching(requestedRoute, config[5])) {
            logger(trailId, logStep(trailId, { type: 'report', trailId, reqUrl: displayedURL, method, routeHandlerStage: 'UNIQUE HANDLER', payload: trail[10] }));
          }
        } else {
          if (!cleanerCall && trail[6] !== trail[2] && trail[14] === routeIdx && trail[7]) {
            logger(trailId, logStep(trailId, { type: "handler", reqUrl: displayedURL, elapsed: config[9]?.(timing) ?? timing, statusCode, method, handlerName: routeStackName, isRouteHandler: true, routeHandlerStage: "CLEANUP HANDLER" }));
            logger(trailId, logStep(trailId, { type: "handler", reqUrl: displayedURL, elapsed: config[9]?.(timing) ?? timing, statusCode, method, handlerName: routeStackName, isRouteHandler: true, routeHandlerStage: "TOTAL HANDLER" }));
          } else {
            if (trail[3] === routeIdx && trail[14] !== routeIdx && (trail[6] !== routeIdx) && (!trail[7] || trail[2] === trail[14]))
            logger(trailId, logStep(trailId, { type: "handler", reqUrl: displayedURL, elapsed: config[9]?.(timing) ?? timing, method, handlerName: routeStackName, isRouteHandler: true, routeHandlerStage: "HANDLER" }))
          }
        }
      };
    }
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
  const requestedRoute = requestedRouteIdx !== -1 && getStack(app)[requestedRouteIdx];
  // It would be easier (and proper) to add properties routeMatcher results to the requestedRouteStack once instead?
  trail[9] = requestedRouteIdx === -1 || isRouteMatching(requestedRoute.route, config[3]);

  if (!requestedRoute) {
    logger(trailId, logStep(trailId, { type: "wrapper", action: "not found", method, reqUrl: req.originalUrl }));
  } else if (!trail[9]) {
    trail[11] = new Set();
    trail[11].add(requestedRoute)
    const path = requestedRoute.route.path
    const displayedURL = isRouteMatching(requestedRoute.route, config[4]) ? req.originalUrl : path;
    req.logSegmentPerf = logSegmentPerf.bind({ req, res, path: requestedRoute.route.path });
    logger(trailId, logStep(trailId, { type: "wrapper", action: "start", method, reqUrl: path }));
    trail[8] = performance.now();
    res.once("finish", () => {
      trail[7] = true;
      if (requestedRoute.route.stack.length === 1) {
        return;
      }
      const perfNow = performance.now();
      // On lib/routes trail[3](routeIdx) so opposite conditional?
      if ((trail[6] === undefined || trail[6] !== trail[3]) && trail[2] === trail[3]) {
        logger(trailId, logStep(trailId, { type: "handler", reqUrl: displayedURL, handlerName: trail[4], method, isRouteHandler: true, routeHandlerStage: "OPENER" }));
      }
      const statusCode = getStatusCode(res);
      const timingSended = perfNow - trail[5];
      logger(trailId, logStep(trailId, { type: "handler", method, reqUrl: displayedURL, elapsed: config[9]?.(timingSended) ?? timingSended, statusCode, handlerName: trail[15] ?? trail[4], isRouteHandler: true, routeHandlerStage: "RESPONSE SENDED" }));
      const timingTotal = perfNow - trail[8];
      logger(trailId, logStep(trailId, { type: "handler", method, reqUrl: displayedURL, elapsed: config[9]?.(timingTotal) ?? timingTotal, statusCode, handlerName: trail[15] ?? trail[4], isRouteHandler: true, routeHandlerStage: "RESPONSE TOTAL" }));
      if (trail[10] && isRouteMatching(requestedRoute.route, config[5])) {
        logger(trailId, logStep(trailId, { type: 'report', trailId, reqUrl: displayedURL, method, routeHandlerStage: 'RESPONSE TOTAL', payload: trail[10], handlerName: trail[15] ?? trail[4] }));
      }
    });
  }

  next();
};
