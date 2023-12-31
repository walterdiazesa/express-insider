import { Express } from "express";
import { LoggingProps, TrailOptions } from "./ts";
import { COLOR, DEFAULT_TRAIL_OPTIONS, METHOD_COLOR } from "./constants";
import { getRuntime, getStack, initDelayEach, isRuntimeCompatible } from "./utils";
import { initTracer, mutateRoutes } from "./lib";
import { Config } from "./config";
import { mutateStackRoutes } from "./lib/routes";

/**
 * #  express-insider
 * Thoughtful logging and metrics tracer for your Express applications
 * 
 * @example
 * ```
 * import express from 'express';
 * import { trail } from "express-insider";
 * 
 * const app = express();
 * app.get('/', (req, res) => res.send({ working: true }));
 * 
 * trail(app); // Add logging capabilities
 * app.listen(process.env.PORT, () => console.log(`🚀 Server ready on ${process.env.PORT}`));
 * ```
 * 
 * @param {import('express').Express} app express app (const app = require('express')())
 * @param {TrailOptions} trailOptions custom config properties
 * @description Initializer for trail functionality
 * @returns mutated Express app
 */
export const trail = <T extends TrailOptions>(app: Express, trailOptions?: T & LoggingProps<T>) => {
  // Compatibility Checks
  // [ODD-3]
  if (!app._router?.stack) throw new Error(`${COLOR.fgYellow}[trail]${COLOR.reset} Express versions below 4.0.0 are not supported.`);
  const runtime = getRuntime();
  if (!isRuntimeCompatible(runtime)) throw new Error(`${COLOR.fgYellow}[trail]${COLOR.reset} ${runtime.runtime.charAt(0).toUpperCase()}${runtime.runtime.slice(1)} versions below ${runtime.trailCompatibility} are not supported.`)

  // Initialize config
  const config = Config({ ...DEFAULT_TRAIL_OPTIONS, ...trailOptions }).get();
  if (config[11] === 'delay-each') initDelayEach();
  if (!config[7]) {
    Object.keys(COLOR).map((color) => COLOR[color] = '');
    Object.keys(METHOD_COLOR).map((method) => METHOD_COLOR[method] = '');
  }

  // Mutate route handlers
  mutateStackRoutes(getStack(app));

  // Mutate original routes
  mutateRoutes(getStack(app));

  // Add tracer middleware and let Express handle it as a normal middleware
  app.use(initTracer(app));

  // Get stack
  const stack = getStack(app);

  // Move tracer middleware add the start of the trace
  stack.unshift(stack.pop());

  // If initialImmutableMiddlewares are provide, include those to the flow of the app and move them to the top of the stack
  if (config[10])
    for (const middleware of config[10].reverse()) {
      app.use(middleware);
      stack.unshift(stack.pop());
    }

  return app;
};