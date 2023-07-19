import { NextFunction, Response, Request } from "express";
import { getCfg } from "../../config";
import { ANONYMOUS_ROUTE } from "../../constants";
import { Method, Route, StackItem } from "../../ts";
import { logger, logStep, formatAnonymousRoute, getStatusCode } from "../../utils";

type RouteHandlerProps = { trailId: string; name: string; method: Method, requestedRoute: Route, res: Response, stackItem: StackItem };

export const routeHandler = ({ trailId, res, stackItem, requestedRoute, name, method }: RouteHandlerProps) => {
  const config = getCfg();

  if (!res.routeEntered) {
    res.routeEntered = true; // if true is changed for [stackIdx] the value would be exactly the same as [res.stackRequested] *if* the route hasn't been ignored
    if (stackItem.route.stack.length !== 1) {
      logger(trailId, logStep(trailId, { type: "handler", isRouteHandler: true, reqUrl: name, handlerName: name, method, routeHandlerStage: "JOIN" }));
    }
    const sendFn = res.send;
    res.send = function (body: any) {
      res.sendedBundle = body;
      return sendFn.call(res, body);
    };
  }

  for (let routeIdx = 0; routeIdx < stackItem.route.stack.length; routeIdx++) {
    const routeStack = stackItem.route.stack[routeIdx];
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
        res.routeTriggerIdx = routeIdx;
      }
      res.currentRouteStackIndex = routeIdx;
      res.currentRouteStackName = routeStackName;
      const init = performance.now();
      res.trailInitTime = init;

      await routeStackHandle(req, res, function (err) {
          res.nextMiddleware = true;
          return next(err);
        });

        res.nextMiddleware = false;
        const displayedURL = (typeof config.showRequestedURL === 'boolean' ? config.showRequestedURL : !!config.showRequestedURL.find(({ route: _route, method: _method }) => _route === requestedRoute.path && (_method === 'any' || requestedRoute.methods[_method]))) ? req.originalUrl : requestedRoute.path;

        const statusCode = getStatusCode(res);

        if (stackItem.route.stack.length === 1) {
          logger(trailId, logStep(trailId, { type: "handler", reqUrl: displayedURL, elapsed: config.timingFormatter(performance.now() - init), method: req.method as Method, isRouteHandler: true, handlerName: routeStackName, routeHandlerStage: "UNIQUE HANDLER", statusCode }));

          if (res.sendedBundle && (typeof config.showResponse === 'boolean' ? config.showResponse : !!config.showResponse.find(({ route: _route, method: _method }) => _route === requestedRoute.path && (_method === 'any' || requestedRoute.methods[_method])))) {
            logger(trailId, logStep(trailId, { type: 'report', trailId: res.trailId, reqUrl: displayedURL, method: req.method as Method, routeHandlerStage: 'UNIQUE HANDLER', payload: res.sendedBundle }));
          }
        } else {
          if (res.routeTriggerIdx === routeIdx && res.trailFinished) {
            logger(trailId, logStep(trailId, { type: "handler", reqUrl: displayedURL, elapsed: config.timingFormatter(performance.now() - init), statusCode, method, handlerName: routeStackName, isRouteHandler: true, routeHandlerStage: "CLEANUP HANDLER" }));
            logger(trailId, logStep(trailId, { type: "handler", reqUrl: displayedURL, elapsed: config.timingFormatter(performance.now() - init), statusCode, method, handlerName: routeStackName, isRouteHandler: true, routeHandlerStage: "TOTAL HANDLER" }));
          } else {
            if ((res.currentRouteStackIndex !== routeIdx || res.trailFinished) && res.routeTriggerIdx !== routeIdx) {
              logger(trailId, logStep(trailId, { type: "handler", reqUrl: displayedURL, elapsed: config.timingFormatter(performance.now() - init), method, handlerName: routeStackName, isRouteHandler: true, routeHandlerStage: "HANDLER" }));
            } else if (res.routeTriggerIdx !== res.currentRouteStackIndex) {
              logger(trailId, logStep(trailId, { type: "handler", isRouteHandler: true, routeHandlerStage: "OPENER", handlerName: routeStackName, method, reqUrl: displayedURL, elapsed: config.timingFormatter(performance.now() - res.trailInitTime) }));
            }
          }
        }

        if (!res.nextMiddleware && routeIdx === res.currentRouteStackIndex) {
          logger(trailId, logStep(trailId, { type: "wrapper", action: "finish", method, reqUrl: requestedRoute.path, elapsed: config.timingFormatter(performance.now() - res.stackInit) }), { req, res });
        }
    };
  }
};