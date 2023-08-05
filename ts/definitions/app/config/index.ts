import { TrailOptions } from "..";
import { Request, Response } from 'express'
import { CONFIG_KEYS } from "../../../../constants";
import { generateRouteMatcherGroup } from "../../../../utils";

export type ConfigKeys = typeof CONFIG_KEYS;

// extra props coming from LoggingProps<T>
export type Config = TrailOptions & {
  delayMs?: number;
  skip?: (req: Request, res: Response) => boolean;
};

export type ConfigMapper = {
  /**
   * __trailId__
   */
  0: Config['trailId'];
  /**
   * __logger__
   */
  1: Config['logger'];
  /**
   * __ignoreMiddlewares__
   */
  2: Config['ignoreMiddlewares'];
  /**
   * __ignoreRoutes__
   */
  3: ReturnType<typeof generateRouteMatcherGroup>;
  /**
   * __showRequestedURL__
   */
  4: ReturnType<typeof generateRouteMatcherGroup>;
  /**
   * __showResponse__
   */
  5: ReturnType<typeof generateRouteMatcherGroup>;
  /**
   * __showRSS__
   */
  6: Config['showRSS'];
  /**
   * __showColors__
   */
  7: Config['showColors'];
  /**
   * __report__
   */
  8: Config['report'];
  /**
   * __timingFormatter__
   */
  9: Config['timingFormatter'];
  /**
   * __initialImmutableMiddlewares__
   */
  10: Config['initialImmutableMiddlewares'];
  /**
   * __logStrategy__
   */
  11: Config['logStrategy'];
  /**
   * __delayMs__
   */
  12: number;
  /**
   * __skip__
   */
  13: (req: Request, res: Response) => boolean;
};