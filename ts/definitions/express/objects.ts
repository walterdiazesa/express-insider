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

type Stack = {
  handle: Function;
  name: string;
  params?: undefined;
  path?: undefined;
  keys: Record<string, string | boolean | number>[];
  regexp: RegExp;
  mutated: boolean;
};

export type StackItemType = HandlerType;
export type StackItem<T extends StackItemType | undefined = undefined> = Stack & {
  route: T extends undefined ? undefined | Route : T extends HandlerType.ROUTE ? Route : undefined;
};

export type RouteStack<T extends Method = Method> = Stack & {
  method: T;
};