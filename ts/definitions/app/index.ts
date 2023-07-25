import { Method } from "../../../ts";
import { NextFunction, Request, Response } from "express";
import { logSegmentPerf } from "../../../utils";

export interface TrailRequestProps {
  logSegmentPerf: typeof logSegmentPerf;
}
export interface TrailResponseProps {
  trail: {
    routeEntered: boolean;
    id: string;
    routeTriggerIdx: number;
    currentRouteStackIndex: number;
    currentRouteStackName: string;
    initTime: number;
    nextMiddleware: boolean;
    finished: true | undefined;
    stackInit: number;
    ignoreRouteStack: boolean;
    sendedBundle: string;
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
        method: Method;
        reqUrl: string;
      } & ({ action: "start" | "not found" } | { action: "finish"; elapsed: number }))
    | ({
      type: "report",
      reqUrl: string;
      method: Method;
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
        method: Method;
        handlerName: string;
      } & (
        | { isRouteHandler: false; elapsed: number }
        | ({ isRouteHandler: true; reqUrl: string; } & (
            | {
                routeHandlerStage: Extract<RouteHandlerStage, "HANDLER" | "OPENER">;
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
      method: Method;
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
   * @see initialImmutableMiddlewares
   * 
   * ```
   * trail(app, { trailId: (req) => req.headers['X-Request-ID'] });
   * ```
   */
  trailId: ((req: BaseExpressRequest, res: BaseExpressResponse) => string) | (() => string);
  /**
   * express-trail uses the native `console.log` method (which is just a wrapper over `process.stdout.write`),
   * logging is not often view as a critical aspect in performance as is normally used just in basic cases
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
   * @example Ignore __all__ routes independant of the method for `/book`
   * ```
   * ...
   * trail(app, {
   *  // Would ignore the GET, POST and DELETE route for /book, logs for "GET /book/:id" will still showing
   *  ignoreRoutes: [{ route: "/book", method: "any" }]
   * });
   * ```
   * @example Ignore the `GET /book` route
   * ```
   * ...
   * trail(app, {
   *  // Would ignore ONLY the "GET /book" route, "POST /book", "DELETE /book" and "GET /book/:id" will still showing
   *  ignoreRoutes: [{ route: "/book", method: "get" }]
   * });
   * ```
   * @example Ignore POST and DELETE /book routes
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
   * For parameterized routes as "/:id" or "/book/:id", the normal behaviour in the logs would be showing "GET "
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
   * @example Ignore __all__ routes independant of the method for `/book`
   * ```
   * ...
   * trail(app, {
   *  // Would ignore the GET, POST and DELETE route for /book, logs for "GET /book/:id" will still showing
   *  ignoreRoutes: [{ route: "/book", method: "any" }]
   * });
   * ```
   * @example Ignore the `GET /book` route
   * ```
   * ...
   * trail(app, {
   *  // Would ignore ONLY the "GET /book" route, "POST /book", "DELETE /book" and "GET /book/:id" will still showing
   *  ignoreRoutes: [{ route: "/book", method: "get" }]
   * });
   * ```
   * @example Ignore POST and DELETE /book routes
   * ```
   * ...
   * trail(app, {
   *  // Would ignore "POST /book" and "DELETE /book" routes, "GET /book" and "GET /book/:id" will still showing
   *  ignoreRoutes: [{ route: "/book", method: "post" }, { route: "/book", method: "delete" }]
   * });
   * ```
   * 
   * @default false
   */
  showRequestedURL: boolean | { route: `/${string}`; method: 'any' | Uppercase<Method> | Method | 'ANY' }[];
  showResponse: boolean | { route: `/${string}`; method: 'any' | Uppercase<Method> | Method | 'ANY' }[];
  showRSS: boolean;
  /**
   * If you're using your custom logger or the cloud solution you're using doesn't interpretate correctly the colors that you
   * normally see on the developer console (or you simply want to see uncolored logs), you can set this property as `false`
   * @default true
   */
  showColors: boolean;
  report: (trailId: string, payload: SegmentReport | PayloadReport) => void;
  timingFormatter: (elapsed: number) => number;
  /**
   * If you're using your custom logger or the cloud solution you're using doesn't interpretate correctly the colors that you
   * normally see on the developer console (or you simply want to see uncolored logs), you can set this property as `false`
   * @see trailId
   */
  initialImmutableMiddlewares: ((req: BaseExpressRequest, res: BaseExpressResponse, next: NextFunction) => void)[];
} & 
  (
  | { logStrategy: "real-time"; }
  | { logStrategy: "delay-all" | "delay-each"; delayMs: number; }
  | { logStrategy: "await-each"; skip: (req: Request, res: Response) => boolean; })>;