import { Express, NextFunction, Request, Response } from 'express';
import { getCfg } from '../../config';
import { ANONYMOUS_ROUTE, UNNAMED_ROUTES } from '../../constants';
import { HandlerType, Method, StackItem } from '../../ts';
import {
  formatAnonymousRoute,
  getStack,
  getStatusCode,
  isRouteMatching,
  isStackItemRoute,
  logger,
  logStep,
} from '../../utils';

const config = getCfg();
export const mutateStackRoutes = (stack: (StackItem | StackItem<HandlerType.ROUTE>)[], routerParentPath = '') => {
  for (let stackIdx = 0; stackIdx < stack.length; stackIdx++) {
    const stackItem = stack[stackIdx];
    // Using express.Router() inject the stack property of the route parent, which would be a normal stackItem on the root of the app
    if (stackItem.handle.stack) {
      // WARN, related: [ODD-4]: The way we obtain routerParentPath should be provided by the query middleware, which sets the req.baseUrl
      // and use it as we already do it in other places of the application, but by doing so we would need to move the routeMatching at the
      // original iterator level (most likely in initTracer middleware)
      mutateStackRoutes(stackItem.handle.stack, stackItem.regexp.source.slice(2, stackItem.regexp.source.indexOf('\\', 3)));
      continue;
    }
    if (!isStackItemRoute(stackItem)) continue;

    const path = `${routerParentPath}${routerParentPath && stackItem.route.path === '/' ? '' : stackItem.route.path}` as `/${string}`;
    const absoluteRouteMatcher = !routerParentPath ? stackItem.route : { ...stackItem.route, path };

    if (isRouteMatching(absoluteRouteMatcher, config[4])) stackItem.showRequestedURL = true;
    if (isRouteMatching(absoluteRouteMatcher, config[5])) stackItem.showResponse = true;
    
    if (isRouteMatching(absoluteRouteMatcher, config[3])) {
      stackItem.ignore = true;
      continue
    };
    
    const handle = stackItem.handle;
    const requestedRoute = stackItem.route;

    for (let routeIdx = 0; routeIdx < requestedRoute.stack.length; routeIdx++) {
      const routeStack = requestedRoute.stack[routeIdx];
      const routeStackHandle = routeStack.handle;
      /* istanbul ignore next (deep conditional handling for express@4.0.0 support)*/
      const name = (UNNAMED_ROUTES[handle.name] ? requestedRoute?.path : handle.name) || ANONYMOUS_ROUTE;
      routeStack.handle = async function (req: Request, res: Response, next: NextFunction) {
        const trail = res.trail;
        const trailId = trail[1];
        const method = req.method as Uppercase<Method>;
        // [ODD-2], routeStack.name is not defined under express 4.6.0
        /* istanbul ignore next (deep conditional handling for express@4.0.0 support)*/
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

        const displayedURL = typeof stackItem.showRequestedURL === 'boolean' ? req.originalUrl : `${routerParentPath}${routerParentPath && name === '/' ? '' : name}`;

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

          /* istanbul ignore next (unnecessary fallback or optional argument coverage)*/
          if (trail[14] === routeIdx && trail[7]) {
            cleanerCall = true;
            logger(trailId, logStep(trailId, { type: "handler", reqUrl: displayedURL, elapsed: config[9]?.(timing) ?? timing, statusCode, method, handlerName: routeStackName, isRouteHandler: true, routeHandlerStage: "CLEANUP HANDLER" }));
            logger(trailId, logStep(trailId, { type: "handler", reqUrl: displayedURL, elapsed: config[9]?.(timing) ?? timing, statusCode, method, handlerName: routeStackName, isRouteHandler: true, routeHandlerStage: "TOTAL HANDLER" }));
          } else {
            if ((trail[3] === routeIdx || trail[7]) && (trail[14] !== routeIdx)) {
              const routeHandlerLogger = () => logger(trailId, logStep(trailId, { type: "handler", reqUrl: displayedURL, elapsed: config[9]?.(timing) ?? timing, method, handlerName: routeStackName, isRouteHandler: true, routeHandlerStage: "HANDLER" }));
              if (res.writableEnded) setTimeout(routeHandlerLogger); else routeHandlerLogger();
            } else if (trail[14] !== trail[3] && Boolean(!trail[7] && res.writableEnded) === false) {
              // After the re-architecture this line was never reach in tests, so it's most likely to be redundant now, but I will leave it
              // to reduce possible missing tests from my side
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
          /* istanbul ignore next (unnecessary fallback or optional argument coverage)*/
          setTimeout(() => logger(trailId, logStep(trailId, { type: "wrapper", action: "finish", method, reqUrl: `${routerParentPath}${routerParentPath && requestedRoute.path === '/' ? '' : requestedRoute.path}`, elapsed: config[9]?.(performance.now() - trail[8]) ?? performance.now() - trail[8] }), { req, res }));
        }

        const perfNow = performance.now();
        const timing = perfNow - init;
        const statusCode = getStatusCode(res);

        if (requestedRoute.stack.length === 1) {
          logger(trailId, logStep(trailId, { type: "handler", reqUrl: displayedURL, elapsed: config[9]?.(timing) ?? timing, method, isRouteHandler: true, handlerName: routeStackName, routeHandlerStage: "UNIQUE HANDLER", statusCode }));
    
          if (trail[10] && typeof stackItem.showResponse === 'boolean') {
            logger(trailId, logStep(trailId, { type: 'report', for: "handler", trailId, reqUrl: displayedURL, method, routeHandlerStage: 'UNIQUE HANDLER', payload: trail[10] }));
          }
        } else {
          if (!cleanerCall && trail[6] !== trail[2] && trail[14] === routeIdx && trail[7]) {
            logger(trailId, logStep(trailId, { type: "handler", reqUrl: displayedURL, elapsed: config[9]?.(timing) ?? timing, statusCode, method, handlerName: routeStackName, isRouteHandler: true, routeHandlerStage: "CLEANUP HANDLER" }));
            logger(trailId, logStep(trailId, { type: "handler", reqUrl: displayedURL, elapsed: config[9]?.(timing) ?? timing, statusCode, method, handlerName: routeStackName, isRouteHandler: true, routeHandlerStage: "TOTAL HANDLER" }));
          } else {
            /* istanbul ignore next (unnecessary fallback or optional argument coverage)*/
            if (trail[3] === routeIdx && trail[14] !== routeIdx && (trail[6] !== routeIdx) && (!trail[7] || trail[2] === trail[14]))
              logger(trailId, logStep(trailId, { type: "handler", reqUrl: displayedURL, elapsed: config[9]?.(timing) ?? timing, method, handlerName: routeStackName, isRouteHandler: true, routeHandlerStage: "HANDLER" }))
          }
        }
      };
    }
  }
}