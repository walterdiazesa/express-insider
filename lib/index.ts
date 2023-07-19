import { randomUUID } from "crypto";
import { Request, Response,  NextFunction, Express } from "express";
import { getCfg } from "../config";
import { ANONYMOUS_ROUTE, UNNAMED_ROUTES } from "../constants";
import { BaseExpressRequest, BaseExpressResponse, HandlerType, Method, Route, StackItem } from "../ts";
import { logger, logStep, logSegmentPerf, getStackItemType, getStatusCode, getStack } from "../utils";
import { routeHandler } from "./routes";

export const mutateRoutes = (app: Express) => {
  const config = getCfg();
  const stack = getStack(app);

  for (let stackIdx = 0; stackIdx < stack.length; stackIdx++) {
    const stackItem = stack[stackIdx];
    const { handle, route } = stackItem;

    stackItem.handle = async function (req: Request, res: Response, next: NextFunction) {
      // [ODD-2]
      stackItem.name ??= handle.name;
      if (res.ignoreRouteStack) {
        return handle(req, res, next);
      }

      const requestedRoute = stack[res.stackRequested].route;
      const name = (UNNAMED_ROUTES[handle.name] ? route?.path : handle.name) || ANONYMOUS_ROUTE;
      const method = req.method as Method;
      const trailId = res.trailId;

      if (getStackItemType(stackItem) === HandlerType.ROUTE) {
        routeHandler({ name, method, res, requestedRoute, stackItem, trailId });
      }

      const init = performance.now();
      return await handle(req, res, function (err: any) {
        if (getStackItemType(stackItem) !== "Route" && (!config.ignoreMiddlewares || (typeof config.ignoreMiddlewares !== "boolean" && !config.ignoreMiddlewares.includes(stackItem.name)))) {
          logger(trailId, logStep(trailId, { type: "handler", reqUrl: requestedRoute.path, elapsed: config.timingFormatter(performance.now() - init), method, isRouteHandler: false, handlerName: name }));
        }
        // [ODD-1] Fixable by try-catch, but I don't want to mess with JIT optimizations
        const isNext = stack[stackIdx + 2] // Could be route middleware (with .route) or just middleware
        if (isNext) return next(err); 
      });
    };
  }
}

export const initTracer = (app: Express) => function initTracer(req: Request, res: Response, next: NextFunction) {
  const config = getCfg();
  const trailId = config.trailId?.(req, res) || randomUUID();
  res.trailId = trailId;
  
  const requestedRouteIdx = getStack(app).findIndex((stack) => stack.regexp.test(req.originalUrl) && stack.route?.methods[req.method.toLowerCase()]);
  res.stackRequested = requestedRouteIdx;
  const requestedRoute = requestedRouteIdx !== -1 && getStack(app)[requestedRouteIdx];
  res.ignoreRouteStack = requestedRouteIdx === -1 || !!config.ignoreRoutes?.find(({ route: _route, method: _method }) => _route === requestedRoute.route.path && (_method === 'any' || requestedRoute.route.methods[_method]));

  if (!requestedRoute) {
    logger(trailId, logStep(trailId, { type: "wrapper", action: "not found", method: req.method as Method, reqUrl: req.originalUrl }));
  } else if (!res.ignoreRouteStack) {
    req.logSegmentPerf = logSegmentPerf.bind({ req, res, path: requestedRoute.route.path });
    logger(trailId, logStep(trailId, { type: "wrapper", action: "start", method: req.method as Method, reqUrl: requestedRoute.route.path }));
    res.stackInit = performance.now();
    res.once("finish", () => {
      res.trailFinished = true;
      if (requestedRoute.route.stack.length === 1) {
        return;
      }
      if (res.routeTriggerIdx === res.currentRouteStackIndex) {
        logger(trailId, logStep(trailId, { type: "handler", reqUrl: requestedRoute.route.path, handlerName: res.currentRouteStackName, method: req.method as Method, isRouteHandler: true, routeHandlerStage: "OPENER", elapsed: config.timingFormatter(performance.now() - res.trailInitTime) }));
      }
      const statusCode = getStatusCode(res);
      logger(trailId, logStep(trailId, { type: "handler", method: req.method as Method, reqUrl: requestedRoute.route.path, elapsed: config.timingFormatter(performance.now() - res.trailInitTime), statusCode, handlerName: res.currentRouteStackName, isRouteHandler: true, routeHandlerStage: "RESPONSE SENDED" }));
      logger(trailId, logStep(trailId, { type: "handler", method: req.method as Method, reqUrl: requestedRoute.route.path, elapsed: config.timingFormatter(performance.now() - res.stackInit), statusCode, handlerName: res.currentRouteStackName, isRouteHandler: true, routeHandlerStage: "RESPONSE TOTAL" }));
      if (res.sendedBundle && (typeof config.showResponse === 'boolean' ? config.showResponse : !!config.showResponse.find(({ route: _route, method: _method }) => _route === requestedRoute.route.path && (_method === 'any' || requestedRoute.route.methods[_method])))) {
        logger(trailId, logStep(trailId, { type: 'report', trailId: res.trailId, reqUrl: requestedRoute.route.path, method: req.method as Method, routeHandlerStage: 'RESPONSE TOTAL', payload: res.sendedBundle, handlerName: res.currentRouteStackName }));
      }
    });
  }

  next();
};
