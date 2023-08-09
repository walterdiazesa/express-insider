import { TrailOptions } from "..";
import { HandlerType, Method } from "../../../ts";

export type RouteMatcher = {
  route: TrailOptions['ignoreRoutes'][number]['route'],
  method: Lowercase<TrailOptions['ignoreRoutes'][number]['method']>,
};

export type Route = {
  path: `/${string}`;
  stack: RouteStack[];
  methods: Record<Method, boolean>;
};

type Stack<T extends HandlerType | undefined = undefined> = {
  handle: Function & { stack?: (StackItem | StackItem<HandlerType.ROUTE>)[] };
  name: string;
  params?: undefined;
  path: T extends HandlerType.ROUTE ? string : unknown;
  keys: Record<string, string | boolean | number>[];
  regexp: RegExp;
};

export type StackItem<T extends HandlerType | undefined = undefined> = Stack<T> & {
  route: T extends undefined ? undefined | Route : T extends HandlerType.ROUTE ? Route : undefined;
  // Config params
  ignore: T extends HandlerType.ROUTE ? undefined | true : never;
  showResponse: T extends HandlerType.ROUTE ? undefined | true : never;
  showRequestedURL: T extends HandlerType.ROUTE ? undefined | true : never;
}

export type RouteStack<T extends Method = Method> = Stack & {
  method: T;
};