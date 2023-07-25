import { ConfigKeys, ConfigMapper, Config as TConfig } from "./ts/definitions/app/config";
import { digest } from "./utils";

/**
 * @description Get the config of the application, only set once on runtime 
*/
export const Config = (() => {
  const cfgArray = new Array(14) as unknown as ConfigMapper;

  let instance: { get: () => Readonly<ConfigMapper>; };

  return (config?: TConfig) => {
    if (!instance && config) {
      Object.entries(config).map(([key, config]) => cfgArray[digest(key as ConfigKeys[number])] = config);
      Object.freeze(cfgArray);
      instance = {
        get(): Readonly<ConfigMapper> {
          return cfgArray;
        },
      };
    }

    return instance || { get: () => cfgArray };
  };
})();

/**
 * @description alias call for Config().get()
 * @returns The configuration of the application
 */
export const getCfg = (): Readonly<ConfigMapper> => Config().get(); // Jest overrides the fn if contains "config"
