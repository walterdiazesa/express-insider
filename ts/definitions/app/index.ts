import { Method } from "../../../ts";
import { NextFunction, Request, Response } from "express";
import { logSegmentPerf } from "../../../utils";

export interface TrailRequestProps {
  logSegmentPerf: typeof logSegmentPerf;
}
export interface TrailResponseProps {
  routeEntered: boolean;
  trailId: string;
  routeTriggerIdx: number;
  currentRouteStackIndex: number;
  currentRouteStackName: string;
  trailInitTime: number;
  nextMiddleware: boolean;
  trailFinished: true | undefined;
  stackInit: number;
  stackRequested: number;
  ignoreRouteStack: boolean;
  sendedBundle: string;
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
        reqUrl: string;
        method: Method;
        handlerName: string;
      } & (
        | { isRouteHandler: false; elapsed: number }
        | ({ isRouteHandler: true } & (
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

// TODO: Inexact type
export type TrailOptions = Partial<{
  trailId: ((req: BaseExpressRequest, res: BaseExpressResponse) => string);
  ignoreMiddlewares: boolean | string[];
  ignoreRoutes: { route: `/${string}`; method: Method | 'any' }[];
  showRequestedURL: boolean | { route: `/${string}`; method: Method | 'any' }[];
  showResponse: boolean | { route: `/${string}`; method: Method | 'any' }[];
  showRSS: boolean;
  showColors: boolean;
  report: (trailId: string, payload: SegmentReport | PayloadReport) => void;
  timingFormatter: (elapsed: number) => number;
  initialImmutableMiddlewares: ((req: BaseExpressRequest, res: BaseExpressResponse, next: NextFunction) => void)[];
} & 
  (
  | { logStrategy: "real time"; }
  | { logStrategy: "delay all" | "delay each"; delayMs: number; }
  | { logStrategy: "await each"; skip: (req: Request, res: Response) => boolean; })>;

export type BaseTrailOptions = Partial<{
  trailId: ((req: BaseExpressRequest, res: BaseExpressResponse) => string);
  ignoreMiddlewares: boolean | string[];
  ignoreRoutes: { route: `/${string}`; method: Method | 'any' }[];
  showRequestedURL: boolean | { route: `/${string}`; method: Method | 'any' }[];
  showResponse: boolean | { route: `/${string}`; method: Method | 'any' }[];
  showRSS: boolean;
  showColors: boolean;
  report: (trailId: string, payload: SegmentReport | PayloadReport) => void;
  timingFormatter: (elapsed: number) => number;
  initialImmutableMiddlewares: ((req: BaseExpressRequest, res: BaseExpressResponse, next: NextFunction) => void)[];
  logStrategy: "real time" | "delay all" | "delay each" | "await each";
}>

export type LogStrategy<T extends BaseTrailOptions> =
  T['logStrategy'] extends "real time" | undefined ? {} :
  T['logStrategy'] extends "await each" ? { skip?: (req: Request, res: Response) => boolean } :
  { delayMs?: number; } 
