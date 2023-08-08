import { AnyButNullish, Method } from "../../../ts";
import { NextFunction, Request, Response } from "express";
import { logSegmentPerf } from "../../../utils";
import { HandlerType, RouteStack, StackItem } from "../express";

export interface TrailRequestProps {
  logSegmentPerf: typeof logSegmentPerf;
}
export interface TrailResponseProps {
  trail: {
    /**
     * __routeEntered__
     */
    0: boolean;
    /**
     * __id__
     */
    1: string;
    /**
     * __routeTriggerIdx__
     */
    2: number;
    /**
     * __currentRouteStackIndex__
     */
    3: number;
    /**
     * __currentRouteStackName__
     */
    4: string;
    /**
     * __initTime__
     */
    5: number;
    /**
     * __nextMiddlewareLastRouteStackIdx__
     */
    6: number | undefined;
    /**
     * __finished__
     */
    7: true | undefined;
    /**
     * __stackInit__
     */
    8: number;
    /**
     * __ignoreRouteStack__
     */
    9: boolean;
    /**
     * __sendedBundle__
     */
    10: string;
    /**
     * __stackTrace__
     */
    11: Set<StackItem | StackItem<HandlerType.ROUTE> | RouteStack>;
    /**
     * __stackFinished__
     */
    12: boolean;
    /**
     * __stackRequested__
     */
    13: number;
    /**
     * __routeStackResponseIdx__
     */
    14: undefined | number;
    /**
     * __routeStackResponseName__
     */
    15: undefined | string;
  }
}

declare global {
  namespace Express {
    interface Request extends TrailRequestProps {}
    interface Response extends TrailResponseProps {}
  }
}

export type RouteHandlerStage = "JOIN" | "HANDLER" | "OPENER" | "RESPONSE SENDED" | "RESPONSE TOTAL" | "CLEANUP HANDLER" | "TOTAL HANDLER" | "UNIQUE HANDLER";

export type PayloadReport = | ({
        type: "wrapper";
        method: Uppercase<Method>;
        reqUrl: string;
      } & ({ action: "start" | "not found" } | { action: "finish"; elapsed: number }))
    | ({
      type: "report",
      reqUrl: string;
      method: Uppercase<Method>;
      payload: string;
      trailId: string;
    } & ({
      routeHandlerStage: Extract<RouteHandlerStage, "UNIQUE HANDLER">;
    } | {
      routeHandlerStage: Extract<RouteHandlerStage, "RESPONSE TOTAL">;
      handlerName: string;
    }))
    | ({
        type: "handler";
        method: Uppercase<Method>;
        handlerName: string;
      } & (
        | { isRouteHandler: false; elapsed: number }
        | ({ isRouteHandler: true; reqUrl: string; } & (
            | {
                routeHandlerStage: Extract<RouteHandlerStage, "OPENER">;
              }
            | {
              routeHandlerStage: Extract<RouteHandlerStage, "HANDLER">;
              elapsed: number;
            }
            | {
                routeHandlerStage: Extract<RouteHandlerStage, "JOIN">;
              }
            | {
                routeHandlerStage: Extract<RouteHandlerStage, "RESPONSE SENDED" | "RESPONSE TOTAL" | "CLEANUP HANDLER" | "TOTAL HANDLER" | "UNIQUE HANDLER">;
                statusCode: number;
                elapsed: number;
              }
          ))
      ));

export type SegmentReport = {
      type: "segment",
      name: string;
      method: Uppercase<Method>;
      reqUrl: string;
      elapsed: number;
      args?: {
        query?: Request['query'],
        params?: Request['params'],
      }
      bundle?: object | Parameters<typeof Buffer.byteLength>[0];
    }

export type BaseExpressRequest = Omit<Request, keyof TrailRequestProps>
export type BaseExpressResponse = Omit<Response, keyof TrailResponseProps>

export type TrailOptions = Partial<{
  /**
   * Provide a custom trace id generator, currently uses the native approach directly using
   * `import { randomUUID } from 'node:crypto';`
   * In Node (Bun is considerably slower), using UUID is the most efficient and secure way to generate identifiers
   * for filtering by a specific logging group. However, there are certain cases where efficiency at the initial
   * stage is not as important:
   * 
   * 1- If you intend to store the logs in a database, it is recommended to use ULID because, although generating a
   * UUID in Node is faster, ULID will have better performance over time when querying your database due to its inherent nature.
   * 
   * ```
   * import { ulid } from 'ulid';
   * ...
   * trail(app, { trailId: ulid })
   * ```
   * 
   * 2- If you already have some identifier in your Request object coming from another service or assigned by some other middleware*
   * (or you simply want to obtain your identifier from another service), you can use that same identifier to filter your logging
   * group and maintain a consistent single source of truth.
   * 
   * @see initialImmutableMiddlewares
   * 
   * ```
   * trail(app, { trailId: (req) => req.headers['X-Request-ID'] });
   * ```
   */
  trailId: ((req: BaseExpressRequest, res: BaseExpressResponse) => string) | (() => string);
  /**
   * express-trail uses the native `console.log` method (which is just a wrapper over `process.stdout.write`),
   * logging is not often viewed as a critical aspect in performance as is normally used just in basic cases
   * such as debugging the value of some variable, but in reality it is a relatively expensive process in
   * terms of performance, therefore this library gives the possibility to the consumer to bring their own
   * logger, the recommended by us is [pino](https://github.com/pinojs/pino)
   * 
   * @see showColors
   * 
   * ```
   * import { pino } from 'pino';
   * const pinologger = pino();
   * ...
   * trail(app, { logger: (message) => pinologger.info(message), showColors: false })
   * ```
   */
  logger: (message: string) => void;
  /**
   * If you don't want to see __any__ logs related to middlewares you can set this property as `true`,
   * if you wan't to hide the logs related to __some__ middlewares you can include the name of the function of the middleware
   * you wan't to ignore in an array for this property
   * 
   * @example
   * ```
   * import express from "express";
   * const app = express();
   * app.use(express.json()); // --> In the logs you can see this middleware name is "jsonParser"
   * app.use(function cors(req, res, next) {
   *  // handle cors
   *  next();
   * });
   * app.get("/", (req, res) => {
   *  res.send({ working: true })
   * });
   * trail(app, {
   *  ignoreMiddlewares: ["query", "expressInit", "jsonParser"]
   *  // (query and expressInit are middlewares added by express directly)
   *  // The only middleware you will still see in the logs would be "cors" as you would need to
   *  // add it to the array to ignore it
   * });
   * ```
   * 
   * @default false
   */
  ignoreMiddlewares: boolean | string[];
  /**
   * You can ignore all the logs related to certain routes, depending if the request match any of the cases
   * provided in this array
   * 
   * __Note:__ The value `all` in the `method` property is not the same as `any`, if you want to ignore __all__ methods of the
   * provided route you should use `any`, if you want to ignore requests being handle by the route `app.all('/', (req, res, next) { ... })`
   * you should use `all`, this is because even if you have `app.all('/', (req, res, next) { ... })` you can still use `app.get('/', (req, res, next) { ... })`
   * by declaring the `app.get` route before `app.all` (the first one declared would be the one taking precedence), so for cases you want to ignore `app.all('/', ...)`
   * but not `app.get('/', ...)` you can include the object in the array of this property as `{ route: '/', method: 'all' }`
   * 
   * ```
   * import express from "express";
   * const app = express();
   * app.get("/book/:id", (req, res) => {
   *  // Handle GET /book/:id
   * });
   * app.get("/book", (req, res) => {
   *  // Handle GET /book
   * });
   * app.post("/book", (req, res) => {
   *  // Handle POST /book
   * });
   * app.delete("/book", (req, res) => {
   *  // Handle DELETE /book
   * });
   * ```
   * 
   * @example Ignore __all__ routes independent of the method for `/book`
   * ```
   * ...
   * trail(app, {
   *  // Would ignore the GET, POST and DELETE route for /book, logs for "GET /book/:id" will still showing
   *  ignoreRoutes: [{ route: "/book", method: "any" }]
   * });
   * ```
   * @example Ignore __only__ the `GET /book` route
   * ```
   * ...
   * trail(app, {
   *  // Would ignore ONLY the "GET /book" route, "POST /book", "DELETE /book" and "GET /book/:id" will still showing
   *  ignoreRoutes: [{ route: "/book", method: "get" }]
   * });
   * ```
   * @example Ignore POST __and__ DELETE /book routes
   * ```
   * ...
   * trail(app, {
   *  // Would ignore "POST /book" and "DELETE /book" routes, "GET /book" and "GET /book/:id" will still showing
   *  ignoreRoutes: [{ route: "/book", method: "post" }, { route: "/book", method: "delete" }]
   * });
   * ```
   */
  ignoreRoutes: { route: `/${string}`; method: 'any' | Uppercase<Method> | Method | 'ANY' }[];
  /**
   * For parameterized routes as "/:id" or "/book/:id", the normal behaviour in the logs would be showing "GET /:id", "GET /book/:id",
   * but if you want to show the actual value for the parameterized route as "GET /some-id", "GET /book/tom-sawyer" you can provide the
   * route matcher inside the array of this property
   * 
   * __Note:__ The value `all` in the `method` property is not the same as `any`, if you want to show the requested url for __all__ the
   * methods of the provided route you should use `any`, if you want to show the requested url for requests being handle by the route
   * `app.all('/', (req, res, next) { ... })` you should use `all`, this is because even if you have `app.all('/', (req, res, next) { ... })`
   * you can still use `app.get('/', (req, res, next) { ... })` by declaring the `app.get` route before `app.all` (the first one declared
   * would be the one taking precedence), so for cases you want to show the requested url for `app.all('/', ...)` but not `app.get('/', ...)`
   * you can include the object in the array of this property as `{ route: '/', method: 'all' }`
   * 
   * ```
   * import express from "express";
   * const app = express();
   * app.get("/book/:id", (req, res) => {
   *  // Handle GET /book/:id
   * });
   * app.patch("/book/:id", (req, res) => {
   *  // Handle PATCH /book/:id
   * });
   * app.delete("/book/:id", (req, res) => {
   *  // Handle DELETE /book/:id
   * });
   * ```
   * 
   * @example Show the requested url for __all__ routes independant of the method for `/book`
   * ```
   * ...
   * trail(app, {
   *  // Would show the requested url for /book/:id (as "<METHOD> /book/lord-of-the-rings"), independant of the method
   *  showRequestedURL: [{ route: "/book/:id", method: "any" }]
   * });
   * ```
   * @example Show the requested url __only__ for `GET /book/:id` route
   * ```
   * ...
   * trail(app, {
   *  // Would show the requested url ONLY on the "GET /book/:id" route (as "GET /book/to-kill-a-mockingbird")
   *  // "PATCH /book/:id" and "DELETE /book/:id" will still show "<METHOD> /book/:id"
   *  showRequestedURL: [{ route: "/book/:id", method: "get" }]
   * });
   * ```
   * @example Show the requested url for PATCH __and__ DELETE /book/:id routes
   * ```
   * ...
   * trail(app, {
   *  // Would show the requested url for "PATCH /book/:id" (as "PATCH /book/the-great-gatsby") and
   *  // "DELETE /book/:id" (as "DELETE /book/anna-karenina") routes, "GET /book/:id" will still show "GET /book/:id"
   *  showRequestedURL: [{ route: "/book/:id", method: "post" }, { route: "/book/:id", method: "delete" }]
   * });
   * ```
   * 
   * @default false
   */
  showRequestedURL: boolean | { route: `/${string}`; method: 'any' | Uppercase<Method> | Method | 'ANY' }[];
  /**
   * You can include in the logs the response payload from the routes that match any of the cases provided in this array
   * 
   * __Note:__ The value `all` in the `method` property is not the same as `any`, if you want to show the response payload from __all__
   * the methods of the provided route you should use `any`, if you want to show the response payload from requests being handle by the
   * route `app.all('/', (req, res, next) { ... })` you should use `all`, this is because even if you have
   * `app.all('/', (req, res, next) { ... })` you can still use `app.get('/', (req, res, next) { ... })` by declaring the `app.get` route
   * before `app.all` (the first one declared would be the one taking precedence), so for cases you want to show the response payload from
   * `app.all('/', ...)` but not `app.get('/', ...)` you can include the object in the array of this property as `{ route: '/', method: 'all' }`
   * 
   * ```
   * import express from "express";
   * const app = express();
   * app.get("/book/:id", (req, res) => {
   *  // Handle GET /book/:id
   * });
   * app.get("/book", (req, res) => {
   *  // Handle GET /book
   * });
   * app.post("/book", (req, res) => {
   *  // Handle POST /book
   * });
   * app.delete("/book/:id", (req, res) => {
   *  // Handle DELETE /book/:id
   * });
   * ```
   * 
   * @example Show the response payload for __all__ routes independant of the method for `/book/:id`
   * ```
   * ...
   * trail(app, {
   *  // Always show the response payload for /book/:id, independant of the requested method
   *  showResponse: [{ route: "/book/:id", method: "any" }]
   * });
   * ```
   * @example Show the response payload __only__ for the `GET /book/:id` route
   * ```
   * ...
   * trail(app, {
   *  // Would show the response payload only for "GET /book/:id" route
   *  showResponse: [{ route: "/book/:id", method: "get" }]
   * });
   * ```
   * @example Show the response payload for "POST /book" __and__ "DELETE /book/:id" routes
   * ```
   * ...
   * trail(app, {
   *  // Would show the response payload for "POST /book" and "DELETE /book/:id" routes, "GET /book" and "GET /book/:id" are not going to
   *  // show their corresponding responses on logging
   *  showResponse: [{ route: "/book", method: "post" }, { route: "/book/:id", method: "delete" }]
   * });
   * ```
   */
  showResponse: boolean | { route: `/${string}`; method: 'any' | Uppercase<Method> | Method | 'ANY' }[];
  /**
   * Monitoring the RSS of your application can help you identify issues with excessive memory usage. If the RSS keeps increasing or
   * reaches very high values, it may indicate that your application has memory leaks or is utilizing resources inefficiently.
   * Identifying and fixing these issues can significantly improve the performance and stability of the application.
   * This property helps you track the RSS throughout your application's lifecycle and between requests.
   * 
   * @default false
   */
  showRSS: boolean;
  /**
   * If you're using your custom logger or if the cloud solution you're using doesn't correctly interpret the colors that you usually
   * see on the developer console (or if you want to see uncolored logs), you can set this property to `false`.
   * 
   * @see logger
   * 
   * @default true
   */
  showColors: boolean;
  /**
   * The future purpose of this library is to provide analytics for performance metrics by keeping track of the logs in a
   * database. However, in the current version, this functionality is not yet included in the library itself. If you need
   * to implement it before it's natively supported, you can create your own implementation using the payload returned by
   * the callback of this property, or simply use this property to manage any useful side effects on your end.
   * 
   * The flow is as follows:
   * - report (the values obtained on different parts of the request lifecycle)
   * - log (the message obtained from the previous process, treated for their use on console)
   * 
   * @see logger
   */
  report: (trailId: string, payload: SegmentReport | PayloadReport) => void;
  /**
   * The functionality used for obtain the timing insights is `performance.now()`, which returns a high resolution timestamp
   * in milliseconds (e.g `0.5999999996`), if getting all the decimals is redundant for your use-case, you can provide a parser for
   * this property
   * 
   * @example Round `performance.now()` to two decimal places
   * ```
   * trail(app, {
   *  // Instead of 0.5999999996 would return 0.6
   *  timingFormatter: (elapsed) => +elapsed.toFixed(2)
   * });
   * ```
   */
  timingFormatter: (elapsed: number) => number;
  /**
   * This property is an array of middlewares, the middlewares you include here are not going to be mutated or iterated by this library,
   * they would work as they would work normally in a simple express app, and the middlewares you include here shouldn't be added to the
   * express app from your side `(app.use(...))`, the work would be done by this library
   * 
   * For example, if you want to use a value coming from a middleware or a different service for the trailId, you would need to include
   * that middleware inside this array of middlewares instead of using `app.use` directly from your side as you would do it normally
   * 
   * @example Let's say you want jsonParser and your custom traceId middleware to run first in the stack of middlewares
   * ```
   * import express from "express";
   * import { traceMiddleware } from "./middleware";
   * ...
   * // Instead of including the middlewares as you would do it normally
   * // app.use(express.json()); ❌
   * // app.use(traceMiddleware); ❌
   * ...
   * trail(app, {
   *  initialImmutableMiddlewares: [express.json(), traceMiddleware], // You need to include them here, in the same order you would include it on your normal app
   *  trailId: (req, res) => req.headers['X-Request-ID'], // Now, you can set trailId as the value that was included in the list of headers (for example) previously by the traceMiddleware middleware
   * });
   * ```
   * 
   * @see trailId
   */
  initialImmutableMiddlewares: ((req: BaseExpressRequest, res: BaseExpressResponse, next: NextFunction) => void)[];
  /**
   * There are various strategies to minimize the performance impact caused by logging calls. Each strategy employs a different
   * approach that influences how the requested stack is presented.
   * 
   * `real-time`: Prints the current step of any requested stack as it occurs, providing more accuracy but at the cost of reduced performance.
   * 
   * `delay-all`: The most efficient strategy (but also danger), it defers all logging calls until the server remains idle for a specified period of time (delayMs).
   * In other words, it waits for the logging calls until the server enters an idle state without receiving any new requests or steps during
   * that time, the drawback is that as soon as it starts logging all those requested stacks, __the main thread is going to be blocked__ until all
   * logging instructions are done executing, therefore if you have your express app __only__ running on the main thread, the requests in that meantime
   * are going to be blocked and dispatched until the main thread is freed from the logging operations
   * 
   * `delay-each`: Debounce (delay) each individual request before logging the steps occur until that moment. It waits for a specific time
   * period (delayMs) without receiving any new instructions for that specific request, and then prints all the accumulated steps related
   * to that request, even if the request is still ongoing.
   * 
   * `await-each`: Groups logging calls based on requests. Once a request is completed, it prints all the relevant data for that specific
   * requested stack, ensuring that there will be no more steps or calls for that same request in the future.
   * 
   * @example Using the "delay-all" log strategy with a delay of one second (1000 ms)
   * ```
   * trail(app, {
   *   // Delays logging calls until the server remains idle for 1000 ms
   *   logStrategy: "delay-all",
   *   delayMs: 1000, // If not provided, default value is 500
   * });
   * ```
   * 
   * @example Using the "await-each" log strategy to only output requests that failed with a statusCode of 401 (Unauthorized)
   * ```
   * trail(app, {
   *   // Ignore output requests whose responses received a 401 status code.
   *   logStrategy: "await-each",
   *   skip: (req, res) => res.statusCode !== 401, // If not provided, default value is 500
   * });
   * ```
   * 
   * @default "real-time"
   */
  logStrategy: "real-time" | "delay-all" | "delay-each" | "await-each";
}>;

export type LoggingProps<T extends TrailOptions & { skip?: any; delayMs?: any; }> =
  T['logStrategy'] extends "await-each" ?
    (
      {
        /**
         * Before logging out the requested stack this function is executed (if defined), if the execution of this property returns
         * true, the requested stack is not going to be logged and immediatly will be disposed, otherwise it will print the requested
         * stack as normal
         * 
         * @example Don't log `404` responses
         * ```
         * import express from "express";
         * import { trail } from "express-trail";
         * ...
         * trail(app, {
         *  logStrategy: "await-each",
         *  skip: (req, res) => res.statusCode === 404, // If the response statusCode is equal to 404 (NOT_FOUND), ignore the requested stack
         * });
         * ```
         */
        skip?: (req: Request, res: Response) => boolean;
      }
      &
      (T['delayMs'] extends AnyButNullish ? 
      {
        /**
         * @deprecated Delay is only available when using logStrategy = "delay-each" or "delay-all"
         * @see logStrategy
         */
        delayMs?: never; 
      }
      :
      {})
    ) :
  T['logStrategy'] extends "delay-all" | "delay-each" ?
    (
      {
        /**
         * Amount (in milliseconds) to delay (debounce) logging calls
         * @default 500
         */
        delayMs?: number; 
      }
      &
      (T['skip'] extends AnyButNullish ? 
      {
        /**
         * @deprecated Skip is only available when using logStrategy = "await-each"
         * @see logStrategy
         */
        skip?: never; 
      }
      :
      {})
    )
  :
  {};
