import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Simple test function to verify Convex is working
export const simpleTest = mutation({
  args: {},
  handler: async (ctx, args) => {
    console.log("simpleTest function called successfully!");
    return { message: "Test successful", timestamp: new Date().toISOString() };
  },
});

// Test function with parameters
export const testWithParams = mutation({
  args: {
    text: v.string(),
    number: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    console.log("testWithParams called with:", args);
    return { success: true, received: args };
  },
});