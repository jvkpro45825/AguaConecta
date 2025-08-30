import { ConvexReactClient } from "convex/react";

const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (!convexUrl) {
  throw new Error("VITE_CONVEX_URL is not set. Please set your Convex deployment URL in .env.local");
}

export const convex = new ConvexReactClient(convexUrl);