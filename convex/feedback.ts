import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Submit new feedback
export const create = mutation({
  args: {
    category: v.union(v.literal("suggestion"), v.literal("bug"), v.literal("change_request")),
    subject: v.string(),
    description: v.string(),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
  },
  handler: async (ctx, args) => {
    const feedbackId = await ctx.db.insert("feedback", {
      ...args,
      status: "new",
    });
    return feedbackId;
  },
});

// Get all feedback with real-time updates
export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("feedback").order("desc").collect();
  },
});

// Update feedback status (for developer use)
export const updateStatus = mutation({
  args: {
    id: v.id("feedback"),
    status: v.union(v.literal("new"), v.literal("in_progress"), v.literal("completed"), v.literal("released")),
    developer_notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updateData } = args;
    await ctx.db.patch(id, updateData);
  },
});

// Mark all completed feedback as released
export const markCompletedAsReleased = mutation({
  handler: async (ctx) => {
    const completedFeedback = await ctx.db
      .query("feedback")
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();
    
    for (const feedback of completedFeedback) {
      await ctx.db.patch(feedback._id, { status: "released" });
    }
    
    return completedFeedback.length;
  },
});