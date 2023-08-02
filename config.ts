import { ConfigKeys, ConfigMapper, Config as TConfig } from "./ts/definitions/app/config";
import { digest, generateRouteMatcherGroup } from "./utils";

/**
 * @description Get the config of the application, only set once on runtime 
*/
export const Config = (() => {
  /*
    PAPER: 
    Calling getCfg() every time you need to access the config is pretty fast, but calling it once is way faster. Therefore,
    the first step was to change the number of getCfg() calls used; we now only call getCfg() once per needed file. As a result,
    even though the config is empty at the start of the runtime, the reference remains the same. Consequently, any functionality
    that requires access to the actual config is already there.

    Secondly, obtaining values from objects is generally fast. However, in relative terms, obtaining values from arrays is
    significantly faster. This is because we don't need to resort to the hash functionality to transform the property 'logger'
    into its corresponding index inside the array, which exists in a different space of memory.

    After storing values in an array, I considered wrapping it with a Proxy and returning the proxy instead, or using
    Object.defineProperty to define the get method for accessing any property. This approach would allow accessing the array
    properties as "config.logger," but it turned out to be slower than using a simple object from the very start.

    So, in terms of Developer Experience (DX), it might be somewhat inconvenient to access properties as config[1] instead of
    config.logger, but it offers significantly improved performance, relatively speaking.

    Access values for ____ 50,000 times:
    array: 0.786ms
    object: 1.289ms
    defined: 1.882ms (use Object.defineProperty on the array and define the behavior of the get method to access the specified index)
    proxy: 2.483ms (use array for storing and proxy for accesing)
    
    Access values for ____ 1,000,000 times:
    array: 3.045ms
    object: 17.943ms
    defined: 24.898ms
    proxy: 24.985ms

    Access values for ____ 100,000,000 times:
    array: 96.473ms (still ms!!!)
    object: 1.584s
    proxy: 2.186s
    defined: 2.220s
  */
  const cfgArray = new Array(14) as unknown as ConfigMapper;

  let instance: { get: () => Readonly<ConfigMapper>; };

  // JavaScript is a toy language, TypeScript is a garbage language
  return (config?: TConfig) => {
    if (!instance && config) {
      Object.entries(config).map(<T extends ConfigKeys[number]>([key, config]: [T, TConfig[T]]) => {
        const configIdx = digest(key) as any
        if (["ignoreRoutes", "showRequestedURL", "showResponse"].includes(key)) {
          cfgArray[configIdx] = generateRouteMatcherGroup(config as TConfig['ignoreRoutes']);
        }
        else cfgArray[configIdx] = config
      });
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
