import { Express } from "express";
import { TrailOptions } from "./ts";
import { COLOR, DEFAULT_TRACE_OPTIONS, METHOD_COLOR } from "./constants";
import { getRuntime, getStack, initDelayEach, isRuntimeCompatible } from "./utils";
import { initTracer, mutateRoutes } from "./lib";
import { Config } from "./config";

/**
 * ##  Prisma Client ʲˢ
 * Type-safe database client for TypeScript & Node.js
 * 
 * @example
 * ```
 * const prisma = new PrismaClient()
 * ```
 */


/**
 * #  express-trail
 * Thoughtful logging and metrics tracer for your Express applications
 * 
 * @example
 * ```
 * import express from 'express';
 * import { trail } from "express-trail";
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
export const trail = (app: Express, trailOptions?: TrailOptions) => {
  // Compatibility Checks
  // [ODD-3]
  if (!app._router?.stack) throw new Error(`${COLOR.fgYellow}[trail]${COLOR.reset} Express versions below 4.0.0 are not supported.`);
  const runtime = getRuntime();
  if (!isRuntimeCompatible(runtime)) throw new Error(`${COLOR.fgYellow}[trail]${COLOR.reset} ${runtime.runtime.charAt(0).toUpperCase()}${runtime.runtime.slice(1)} versions below ${runtime.trailCompatibility} are not supported.`)

  // Sort to improve isRouteMatching(...) performance
  if (typeof trailOptions.showRequestedURL === 'object') trailOptions.showRequestedURL.sort((a, b) => a.route.localeCompare(b.route))
  if (typeof trailOptions.showResponse === 'object') trailOptions.showResponse.sort((a, b) => a.route.localeCompare(b.route))
  if (typeof trailOptions.ignoreRoutes === 'object') trailOptions.ignoreRoutes.sort((a, b) => a.route.localeCompare(b.route))

  // Initialize config
  const config = Config({ ...DEFAULT_TRACE_OPTIONS, ...trailOptions }).get();
  if (config[11] === 'delay-each') initDelayEach();
  if (!config[7]) {
    Object.keys(COLOR).map((color) => COLOR[color] = '');
    Object.keys(METHOD_COLOR).map((method) => METHOD_COLOR[method] = '');
  }

  // Mutate original routes
  mutateRoutes(app);

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