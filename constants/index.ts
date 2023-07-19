import { RouteHandlerStage } from '../ts';

export const JSONTagPad = "  ";

export const ROUTE_HANDLER_STAGE_TAG: Record<Extract<RouteHandlerStage, "RESPONSE SENDED" | "CLEANUP HANDLER" | "TOTAL HANDLER">, string> = Object.freeze({
  "TOTAL HANDLER": "(total) ",
  "CLEANUP HANDLER": "(cleanup) ",
  "RESPONSE SENDED": "(send response) ",
});

export const UNNAMED_ROUTES = { "bound dispatch": true, "bound ": true /* older express versions */ } as const;
export const ANONYMOUS_ROUTE = "<anonymous>";

export * from './config'
export * from './color'
export * from './http'