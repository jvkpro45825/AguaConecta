import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Create new changelog entry
export const create = mutation({
  args: {
    version: v.string(),
    english_content: v.object({
      features: v.optional(v.array(v.string())),
      bugfixes: v.optional(v.array(v.string())),
      improvements: v.optional(v.array(v.string())),
    }),
    spanish_content: v.object({
      features: v.optional(v.array(v.string())),
      bugfixes: v.optional(v.array(v.string())),
      improvements: v.optional(v.array(v.string())),
    }),
    release_notes_en: v.optional(v.string()),
    release_notes_es: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const changelogId = await ctx.db.insert("changelog", {
      ...args,
      release_date: new Date().toISOString(),
    });
    return changelogId;
  },
});

// Get all changelog entries
export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("changelog").order("desc").collect();
  },
});

// Get changelog by version
export const getByVersion = query({
  args: { version: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("changelog")
      .withIndex("by_version", (q) => q.eq("version", args.version))
      .first();
  },
});