import { NextFunction, Response, Request } from "express";
import { getCfg } from "../../config";
import { ANONYMOUS_ROUTE } from "../../constants";
import { Method, Route, StackItem } from "../../ts";
import { logger, logStep, formatAnonymousRoute, getStatusCode, isRouteMatching } from "../../utils";

const config = getCfg();

type RouteHandlerProps = { trailId: string; name: string; method: Method, res: Response, stackItem: StackItem };
export const routeHandler = ({ trailId, res, stackItem, name, method }: RouteHandlerProps) => {
  const requestedRoute = stackItem.route;

  if (!res.trail.routeEntered) {
    res.trail.routeEntered = true; // if true is changed for [stackIdx] the value would be exactly the same as [res.stackRequested] *if* the route hasn't been ignored
    if (stackItem.route.stack.length !== 1) {
      const displayedURL = isRouteMatching(requestedRoute, config[4]) ? res.req.originalUrl : name /* requestedRoute.path */;
      logger(trailId, logStep(trailId, { type: "handler", isRouteHandler: true, reqUrl: displayedURL, handlerName: name, method, routeHandlerStage: "JOIN" }));
    }
    // WARN: After testing phase
    if (typeof config[5] === 'boolean' ? config[5] : config[5].length) {
      const sendFn = res.send;
      res.send = function (body: any) {
        res.trail.sendedBundle = body;
        return sendFn.call(res, body);
      };
    }
  }

  for (let routeIdx = 0; routeIdx < requestedRoute.stack.length; routeIdx++) {
    const routeStack = requestedRoute.stack[routeIdx];
    if (routeStack.mutated) {
      break;
    }
    routeStack.mutated = true;
    const routeStackHandle = routeStack.handle;
    routeStack.handle = async function (req: Request, res: Response, next: NextFunction) {
      // [ODD-2], routeStack.name is not defined under express 4.6.0
      const routeStackName = routeStack.name === ANONYMOUS_ROUTE || !routeStackHandle.name || routeStackHandle.name === ANONYMOUS_ROUTE
        ? formatAnonymousRoute(routeIdx)
        : routeStack.name || routeStackHandle.name;

      if (!res.writableEnded) {
        res.trail.routeTriggerIdx = routeIdx;
      }
      res.trail.currentRouteStackIndex = routeIdx;
      res.trail.currentRouteStackName = routeStackName;
      const init = performance.now();
      res.trail.initTime = init;

      await routeStackHandle(req, res, function (err) {
          res.trail.nextMiddleware = true;
          return next(err);
        });

        res.trail.nextMiddleware = false;
        const displayedURL = isRouteMatching(requestedRoute, config[4]) ? req.originalUrl : name/* requestedRoute.path */;

        const statusCode = getStatusCode(res);

        if (requestedRoute.stack.length === 1) {
          logger(trailId, logStep(trailId, { type: "handler", reqUrl: displayedURL, elapsed: config[9](performance.now() - init), method: req.method as Method, isRouteHandler: true, handlerName: routeStackName, routeHandlerStage: "UNIQUE HANDLER", statusCode }));

          if (res.trail.sendedBundle && isRouteMatching(requestedRoute, config[5])) {
            logger(trailId, logStep(trailId, { type: 'report', trailId: res.trail.id, reqUrl: displayedURL, method: req.method as Method, routeHandlerStage: 'UNIQUE HANDLER', payload: res.trail.sendedBundle }));
          }
        } else {
          if (res.trail.routeTriggerIdx === routeIdx && res.trail.finished) {
            logger(trailId, logStep(trailId, { type: "handler", reqUrl: displayedURL, elapsed: config[9](performance.now() - init), statusCode, method, handlerName: routeStackName, isRouteHandler: true, routeHandlerStage: "CLEANUP HANDLER" }));
            logger(trailId, logStep(trailId, { type: "handler", reqUrl: displayedURL, elapsed: config[9](performance.now() - init), statusCode, method, handlerName: routeStackName, isRouteHandler: true, routeHandlerStage: "TOTAL HANDLER" }));
          } else {
            if ((res.trail.currentRouteStackIndex !== routeIdx || res.trail.finished) && res.trail.routeTriggerIdx !== routeIdx) {
              logger(trailId, logStep(trailId, { type: "handler", reqUrl: displayedURL, elapsed: config[9](performance.now() - init), method, handlerName: routeStackName, isRouteHandler: true, routeHandlerStage: "HANDLER" }));
            } else if (res.trail.routeTriggerIdx !== res.trail.currentRouteStackIndex) {
              logger(trailId, logStep(trailId, { type: "handler", isRouteHandler: true, routeHandlerStage: "OPENER", handlerName: routeStackName, method, reqUrl: displayedURL, elapsed: config[9](performance.now() - res.trail.initTime) }));
            }
          }
        }


        if (!res.trail.nextMiddleware && routeIdx === res.trail.currentRouteStackIndex) {
          // [FIX-1]: If there's a route middleware after the route handler, but there's no next() call, this finish call would be printed
          // *before* the handler events (total handler, cleanup handler, response total, response sended), or even worst problems
          logger(trailId, logStep(trailId, { type: "wrapper", action: "finish", method, reqUrl: name/* requestedRoute.path */, elapsed: config[9](performance.now() - res.trail.stackInit) }), { req, res });
        }
    };
  }
};