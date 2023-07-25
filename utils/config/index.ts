import { Find } from "../../ts";
import { ConfigKeys } from "../../ts/definitions/app/config";

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
    default:
      // TypeScript will raise an error if the default case is reached.
      const _: never = property;
      throw new Error(`Property "${String(property)}" not supported.`)
  }
}