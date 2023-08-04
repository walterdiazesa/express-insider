import { NextFunction, Response, Request } from "express";
import { getCfg } from "../../config";
import { ANONYMOUS_ROUTE } from "../../constants";
import { Method, Route, StackItem, TrailResponseProps } from "../../ts";
import { logger, logStep, formatAnonymousRoute, getStatusCode, isRouteMatching } from "../../utils";

const config = getCfg();

type RouteHandlerProps = { trail: TrailResponseProps['trail']; trailId: string, name: string; method: Uppercase<Method>, res: Response, stackItem: StackItem };
export const routeHandler = ({ trail, trailId, res, stackItem, name, method }: RouteHandlerProps) => {
  const requestedRoute = stackItem.route;

  if (!trail[0]) {
    trail[0] = true; // if true is changed for [stackIdx] the value would be exactly the same as [res.stackRequested] *if* the route hasn't been ignored
    if (stackItem.route.stack.length !== 1) {
      const displayedURL = isRouteMatching(requestedRoute, config[4]) ? res.req.originalUrl : name;
      logger(trailId, logStep(trailId, { type: "handler", isRouteHandler: true, reqUrl: displayedURL, handlerName: name, method, routeHandlerStage: "JOIN" }));
    }
    // Redundant if
    if (typeof config[5] === 'boolean' ? config[5] : config[5].length) {
      const sendFn = res.send;
      res.send = function (body: any) {
        trail[10] = body;
        return sendFn.call(res, body);
      };
    }
  }

  // Even that technically can be undefined, by specification a route should have always have at least one handler
  /* const stack0 = requestedRoute.stack[0];
  if (!stack0 || stack0.mutated) return;
  stack0.mutated = true; */
  for (let routeIdx = 0; routeIdx < requestedRoute.stack.length; routeIdx++) {
    const routeStack = requestedRoute.stack[routeIdx];
    if (routeStack.mutated) {
      break;
    }
    routeStack.mutated = true;
    const routeStackHandle = routeStack.handle;
    routeStack.handle = async function (req: Request, res: Response, next: NextFunction) {
      const trail = res.trail;
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
};