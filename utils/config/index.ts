import { Find, Method, Route, RouteMatcher, TrailOptions } from "../../ts";
import { Config, ConfigKeys } from "../../ts/definitions/app/config";

// const digest = (property: LooseAutocomplete<ConfigKeys[number]>): keyof ConfigMapper => {
export const digest = <T extends ConfigKeys[number]>(property: T): Find<ConfigKeys, T> => {
  switch (property) {
    // @ts-ignore
    case "trailId": return 0;
    // @ts-ignore
    case "logger": return 1;
    // @ts-ignore
    case "ignoreMiddlewares": return 2;
    // @ts-ignore
    case "ignoreRoutes": return 3;
    // @ts-ignore
    case "showRequestedURL": return 4;
    // @ts-ignore
    case "showResponse": return 5;
    // @ts-ignore
    case "showRSS": return 6;
    // @ts-ignore
    case "showColors": return 7;
    // @ts-ignore
    case "report": return 8;
    // @ts-ignore
    case "timingFormatter": return 9;
    // @ts-ignore
    case "initialImmutableMiddlewares": return 10;
    // @ts-ignore
    case "logStrategy": return 11;
    // @ts-ignore
    case "delayMs": return 12;
    // @ts-ignore
    case "skip": return 13;
    /* istanbul ignore next */
    default:
      // TypeScript will raise an error if the default case is reached.
      const _: never = property;
      throw new Error(`Property "${String(property)}" not supported.`)
  }
}

export const generateRouteMatcherGroup = (matcher: Config['ignoreRoutes'] | boolean) => {
  if (typeof matcher === 'boolean') return matcher;
  const matchGroup: (`/${string}` | RouteMatcher['method'][])[] = [] as any;
  for (let i = 0; i < matcher.length; i++) {
    const matchItem = matcher[i];
    const enlisted = matchGroup.findIndex((route) => route === matchItem.route);
    const method = matchItem.method.toLowerCase() as RouteMatcher['method'];
    if (enlisted !== -1) {
      const enlistedItem = matchGroup[enlisted + 1] as RouteMatcher['method'][];
      if (!enlistedItem.includes(method)) enlistedItem.push(method)
    }
    else matchGroup.push(matchItem.route, [method])
  }
  return matchGroup;
}