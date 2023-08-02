import { NextFunction, Response, Request } from "express";
import { getCfg } from "../../config";
import { ANONYMOUS_ROUTE } from "../../constants";
import { Method, Route, StackItem, TrailResponseProps } from "../../ts";
import { logger, logStep, formatAnonymousRoute, getStatusCode, isRouteMatching } from "../../utils";

const config = getCfg();

type RouteHandlerProps = { trail: TrailResponseProps['trail']; trailId: string, name: string; method: Method, res: Response, stackItem: StackItem };
export const routeHandler = ({ trail, trailId, res, stackItem, name, method }: RouteHandlerProps) => {
  const requestedRoute = stackItem.route;

  if (!trail[0]) {
    trail[0] = true; // if true is changed for [stackIdx] the value would be exactly the same as [res.stackRequested] *if* the route hasn't been ignored
    if (stackItem.route.stack.length !== 1) {
      const displayedURL = isRouteMatching(requestedRoute, config[4]) ? res.req.originalUrl : name /* requestedRoute.path */;
      logger(trailId, logStep(trailId, { type: "handler", isRouteHandler: true, reqUrl: displayedURL, handlerName: name, method, routeHandlerStage: "JOIN" }));
    }
    // WARN: After testing phase
    if (typeof config[5] === 'boolean' ? config[5] : config[5].length) {
      const sendFn = res.send;
      res.send = function (body: any) {
        trail[10] = body;
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

      const displayedURL = isRouteMatching(requestedRoute, config[4]) ? req.originalUrl : name/* requestedRoute.path */;

      //console.log('from routeStackHandle')
      //console.log('init', routeStackName)
      await routeStackHandle(req, res, function (err) {
        trail[6] = true;
        trail[11] = routeIdx;
        //console.log('nextMiddleware called!', `${trail[2]} === ${trail[3]}`, res.writableEnded, res.writableFinished)
        //if (res.writableEnded) console.log('SEND RESPONSE from nextMiddleware handler')
        // console.log(`${trail[2]} === ${trail[3]}`, res.writableEnded, res.writableFinished, res.trail[7])
        // res.trail[7] = falsy, (res.writableEnded | res.writableFinished) = true, trail[2] = trail[3]
        if (!trail[7] && res.writableEnded && trail[2] === trail[3])
          logger(trailId, logStep(trailId, { type: "handler", isRouteHandler: true, routeHandlerStage: "OPENER", handlerName: routeStackName, method, reqUrl: displayedURL }));
        return next(err);
      });
      //console.log('exit', routeStackName)
      //if (res.writableEnded) console.log('SEND RESPONSE from routeStackHandle')
      
      // trail[6] = false;

      const perfNow = performance.now();
      const timing = perfNow - init;

      const statusCode = getStatusCode(res);

      if (requestedRoute.stack.length === 1) {
        logger(trailId, logStep(trailId, { type: "handler", reqUrl: displayedURL, elapsed: config[9]?.(timing) ?? timing, method: req.method as Method, isRouteHandler: true, handlerName: routeStackName, routeHandlerStage: "UNIQUE HANDLER", statusCode }));

        if (trail[10] && isRouteMatching(requestedRoute, config[5])) {
          logger(trailId, logStep(trailId, { type: 'report', trailId, reqUrl: displayedURL, method: req.method as Method, routeHandlerStage: 'UNIQUE HANDLER', payload: trail[10] }));
        }
      } else {
        //console.log('trail[6]', trail[6])
        if (trail[2] === routeIdx && trail[7]) {
          logger(trailId, logStep(trailId, { type: "handler", reqUrl: displayedURL, elapsed: config[9]?.(timing) ?? timing, statusCode, method, handlerName: routeStackName, isRouteHandler: true, routeHandlerStage: "CLEANUP HANDLER" }));
          logger(trailId, logStep(trailId, { type: "handler", reqUrl: displayedURL, elapsed: config[9]?.(timing) ?? timing, statusCode, method, handlerName: routeStackName, isRouteHandler: true, routeHandlerStage: "TOTAL HANDLER" }));
        } else {
          if ((trail[3] !== routeIdx || trail[7]) && trail[2] !== routeIdx) {
            // Here 4, 5, 7
            process.nextTick(() => logger(trailId, logStep(trailId, { type: "handler", reqUrl: displayedURL, elapsed: config[9]?.(timing) ?? timing, method, handlerName: routeStackName, isRouteHandler: true, routeHandlerStage: "HANDLER" })));
          } else if (trail[2] !== trail[3] && Boolean(!trail[7] && res.writableEnded) === false) {
            //const timingSinceStart = perfNow - trail[5];
            //elapsed: config[9]?.(timingSinceStart) ?? timingSinceStart
            // !=? ==> !res.trail[7] && res.writableEnded
            logger(trailId, logStep(trailId, { type: "handler", isRouteHandler: true, routeHandlerStage: "OPENER", handlerName: routeStackName, method, reqUrl: displayedURL }));
          }
        }
      }

      //console.log(`nextMiddleware is ${trail[6]}, isFinished is ${trail[7]}!!!`)
      if (routeIdx === trail[3]) {
        // Change process.nextTick -> setTimeout0 would fix [CASE 12] when no await
        setTimeout(() => logger(trailId, logStep(trailId, { type: "wrapper", action: "finish", method, reqUrl: name/* requestedRoute.path */, elapsed: config[9]?.(performance.now() - trail[8]) ?? performance.now() - trail[8] }), { req, res }));
      }
    };
  }
};