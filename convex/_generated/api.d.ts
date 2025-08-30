/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as changelog from "../changelog.js";
import type * as clients from "../clients.js";
import type * as feedback from "../feedback.js";
import type * as files from "../files.js";
import type * as messages from "../messages.js";
import type * as migration from "../migration.js";
import type * as notifications from "../notifications.js";
import type * as projectFiles from "../projectFiles.js";
import type * as projectSetup from "../projectSetup.js";
import type * as projects from "../projects.js";
import type * as testFunctions from "../testFunctions.js";
import type * as threads from "../threads.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  changelog: typeof changelog;
  clients: typeof clients;
  feedback: typeof feedback;
  files: typeof files;
  messages: typeof messages;
  migration: typeof migration;
  notifications: typeof notifications;
  projectFiles: typeof projectFiles;
  projectSetup: typeof projectSetup;
  projects: typeof projects;
  testFunctions: typeof testFunctions;
  threads: typeof threads;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
