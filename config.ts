import { DEFAULT_TRACE_OPTIONS } from "./constants";
import { TrailOptions } from "./ts";

type Config = TrailOptions & Required<Pick<TrailOptions, 'timingFormatter'>>;
/**
 * @description Get the config of the application, only set once on runtime 
*/
export const Config = (() => {
  let instance: { get: () => Readonly<Config>; };

  return (config?: Config) => {
    if (!instance) {
      const data = Object.freeze(config)

      instance = {
        get(): Readonly<Config> {
          return data;
        },
      };
    }

    return instance;
  };
})();

/**
 * @description alias call for Config().get()
 * @returns The configuration of the application
 */
export const getCfg = (): Readonly<Config> => Config().get(); // Jest overrides the fn if contains "config"

/**
 * @unused Docummentation only
 */
class ConfigClass {
  private static instance: ConfigClass | null = null;
  private data: Readonly<TrailOptions & Required<Pick<TrailOptions, 'timingFormatter'>>>;

  constructor(config?: TrailOptions & Required<Pick<TrailOptions, 'timingFormatter'>>) {
    if (ConfigClass.instance) {
      return ConfigClass.instance;
    }

    this.data = Object.freeze(config);
    ConfigClass.instance = this;

    Object.freeze(this);

    return this;
  }

  get() {
    return this.data;
  }
}