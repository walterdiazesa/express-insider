import { Express } from "express";
import { BaseTrailOptions, LogStrategy, TrailOptions } from "./ts";
import { COLOR, DEFAULT_TRACE_OPTIONS, METHOD_COLOR } from "./constants";
import { getStack, initDelayEach } from "./utils";
import { initTracer, mutateRoutes } from "./lib";
import { Config } from "./config";

/**
 * 
 * @param app express app (const app = require('express')())
 * @param trailOptions custom config properties
 * @description Initializer for trail functionality
 * @returns mutated app
 */
export const trail = (app: Express, trailOptions?: TrailOptions) => {
  // Initialize config
  const config = Config({ ...DEFAULT_TRACE_OPTIONS, ...trailOptions }).get();
  if (config.logStrategy === 'delay each') initDelayEach();
  if (!config.showColors) {
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
  if (config.initialImmutableMiddlewares)
    for (const middleware of config.initialImmutableMiddlewares.reverse()) {
      app.use(middleware);
      stack.unshift(stack.pop());
    }

  return app;
};