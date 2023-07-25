import { randomUUID } from "crypto";
import { Request, Response,  NextFunction, Express } from "express";
import { getCfg } from "../config";
import { ANONYMOUS_ROUTE, UNNAMED_ROUTES } from "../constants";
import { BaseExpressRequest, BaseExpressResponse, HandlerType, Method, Route, StackItem } from "../ts";
import { logger, logStep, logSegmentPerf, getStackItemType, getStatusCode, getStack, isRouteMatching } from "../utils";
import { routeHandler } from "./routes";

const config = getCfg();
export const mutateRoutes = (app: Express) => {
  const stack = getStack(app);

  for (let stackIdx = 0; stackIdx < stack.length; stackIdx++) {
    const stackItem = stack[stackIdx];
    const { handle, route } = stackItem;

    stackItem.handle = async function (req: Request, res: Response, next: NextFunction) {
      // [ODD-2]
      stackItem.name ??= handle.name;
      if (res.trail.ignoreRouteStack) {
        return handle(req, res, next);
      }

      // const requestedRoute = stack[res.trail.stackRequested].route; For route cases, requestedRoute is equal to route (defined above), but for middlewares below it's not the same
      const name = (UNNAMED_ROUTES[handle.name] ? route?.path : handle.name) || ANONYMOUS_ROUTE; // Here?
      const method = req.method as Method;
      const trailId = res.trail.id;

      if (getStackItemType(stackItem) === HandlerType.ROUTE) {
        routeHandler({ name, method, res, stackItem, trailId });
      }

      const init = performance.now();
      return await handle(req, res, function (err: any) {
        if (getStackItemType(stackItem) !== "Route" && (!config[2] || (typeof config[2] !== "boolean" && !config[2].includes(stackItem.name)))) {
          logger(trailId, logStep(trailId, { type: "handler", elapsed: config[9](performance.now() - init), method, isRouteHandler: false, handlerName: name }));
        }
        // [ODD-1] Fixable by try-catch, but I don't want to mess with JIT optimizations
        const isNext = stack[stackIdx + 2] // Could be route middleware (with .route) or just middleware
        if (isNext) return next(err); 
      });
    };
  }
}

export const initTracer = (app: Express) => function initTracer(req: Request, res: Response, next: NextFunction) {
  const trailId = config[0]?.(req, res) || randomUUID();
  res.trail = {} as any;
  res.trail.id = trailId;
  
  const requestedRouteIdx = getStack(app).findIndex((stack) => stack.regexp.test(req.originalUrl) && stack.route?.methods[req.method.toLowerCase()]);
  // res.trail.stackRequested = requestedRouteIdx;
  const requestedRoute = requestedRouteIdx !== -1 && getStack(app)[requestedRouteIdx];
  // ToDo: Cache methods as isRouteMatching
  res.trail.ignoreRouteStack = requestedRouteIdx === -1 || isRouteMatching(requestedRoute.route, config[3]);

  if (!requestedRoute) {
    logger(trailId, logStep(trailId, { type: "wrapper", action: "not found", method: req.method as Method, reqUrl: req.originalUrl }));
  } else if (!res.trail.ignoreRouteStack) {
    const path = requestedRoute.route.path
    const displayedURL = isRouteMatching(requestedRoute.route, config[4]) ? req.originalUrl : path;
    req.logSegmentPerf = logSegmentPerf.bind({ req, res, path: requestedRoute.route.path });
    logger(trailId, logStep(trailId, { type: "wrapper", action: "start", method: req.method as Method, reqUrl: path }));
    res.trail.stackInit = performance.now();
    res.once("finish", () => {
      res.trail.finished = true;
      if (requestedRoute.route.stack.length === 1) {
        return;
      }
      if (res.trail.routeTriggerIdx === res.trail.currentRouteStackIndex) {
        logger(trailId, logStep(trailId, { type: "handler", reqUrl: displayedURL, handlerName: res.trail.currentRouteStackName, method: req.method as Method, isRouteHandler: true, routeHandlerStage: "OPENER", elapsed: config[9](performance.now() - res.trail.initTime) }));
      }
      const statusCode = getStatusCode(res);
      logger(trailId, logStep(trailId, { type: "handler", method: req.method as Method, reqUrl: displayedURL, elapsed: config[9](performance.now() - res.trail.initTime), statusCode, handlerName: res.trail.currentRouteStackName, isRouteHandler: true, routeHandlerStage: "RESPONSE SENDED" }));
      logger(trailId, logStep(trailId, { type: "handler", method: req.method as Method, reqUrl: displayedURL, elapsed: config[9](performance.now() - res.trail.stackInit), statusCode, handlerName: res.trail.currentRouteStackName, isRouteHandler: true, routeHandlerStage: "RESPONSE TOTAL" }));
      if (res.trail.sendedBundle && isRouteMatching(requestedRoute.route, config[5])) {
        logger(trailId, logStep(trailId, { type: 'report', trailId, reqUrl: displayedURL, method: req.method as Method, routeHandlerStage: 'RESPONSE TOTAL', payload: res.trail.sendedBundle, handlerName: res.trail.currentRouteStackName }));
      }
    });
  }

  next();
};
