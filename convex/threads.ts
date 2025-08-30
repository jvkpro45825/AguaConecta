import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

// Get threads for a project
export const getProjectThreads = query({
  args: { 
    project_id: v.id("projects"),
    viewer: v.optional(v.union(v.literal("client"), v.literal("developer")))
  },
  handler: async (ctx, args) => {
    const threads = await ctx.db
      .query("threads")
      .withIndex("by_project", (q) => q.eq("project_id", args.project_id))
      .order("desc")
      .collect();

    // Get latest message for each thread
    const threadsWithDetails = await Promise.all(
      threads.map(async (thread) => {
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_thread", (q) => q.eq("thread_id", thread._id))
          .order("desc")
          .take(1);

        const lastMessage = messages[0] || null;
        const unreadCount = args.viewer === "developer" 
          ? thread.unread_count_developer 
          : thread.unread_count_client;

        return {
          ...thread,
          last_message: lastMessage,
          unread_count: unreadCount,
        };
      })
    );

    return threadsWithDetails.sort((a, b) => new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime());
  },
});

// Get single thread details
export const getThread = query({
  args: { 
    thread_id: v.id("threads"),
    viewer: v.optional(v.union(v.literal("client"), v.literal("developer")))
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.thread_id);
    if (!thread) return null;

    const project = await ctx.db.get(thread.project_id);
    const client = project ? await ctx.db.get(project.client_id) : null;

    return {
      ...thread,
      project,
      client,
    };
  },
});

// Create new conversation thread
export const createThread = mutation({
  args: {
    project_id: v.id("projects"),
    title: v.string(),
    priority: v.optional(v.union(v.literal("normal"), v.literal("urgent"))),
    initial_message: v.optional(v.string()),
    created_by: v.optional(v.union(v.literal("client"), v.literal("developer"))),
    // Translation fields for initial message
    original_content: v.optional(v.string()),
    original_language: v.optional(v.union(v.literal("en"), v.literal("es"))),
    translated_content: v.optional(v.string()),
    target_language: v.optional(v.union(v.literal("en"), v.literal("es"))),
    translation_enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    
    const threadId = await ctx.db.insert("threads", {
      project_id: args.project_id,
      title: args.title,
      status: "new",
      priority: args.priority || "normal",
      created_by: args.created_by || "client",
      last_activity: now,
      unread_count_client: args.created_by === "developer" ? 1 : 0,
      unread_count_developer: args.created_by === "client" ? 1 : 0,
      created_at: now,
    });

    // Add initial message if provided - use sendMessage for translation support
    if (args.initial_message) {
      await ctx.runMutation(api.messages.sendMessage, {
        thread_id: threadId,
        content: args.translated_content || args.initial_message,
        author: args.created_by || "client",
        message_type: "text",
        is_private: false,
        original_content: args.original_content,
        original_language: args.original_language,
        translated_content: args.translated_content,
        target_language: args.target_language,
        translation_enabled: args.translation_enabled,
      });
    }

    // Update project activity
    await ctx.db.patch(args.project_id, {
      updated_at: now,
    });

    return threadId;
  },
});

// Delete thread and all its messages
export const deleteThread = mutation({
  args: {
    thread_id: v.id("threads"),
  },
  handler: async (ctx, args) => {
    // Delete all messages in the thread first
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("thread_id", args.thread_id))
      .collect();
    
    for (const message of messages) {
      await ctx.db.delete(message._id);
    }
    
    // Delete the thread
    await ctx.db.delete(args.thread_id);
    
    return { success: true };
  },
});

// Toggle thread archive status
export const toggleThreadArchive = mutation({
  args: {
    thread_id: v.id("threads"),
    archived: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    
    await ctx.db.patch(args.thread_id, {
      is_archived: args.archived,
      last_activity: now,
    });

    return { success: true, archived: args.archived };
  },
});

// Update thread status
export const updateThreadStatus = mutation({
  args: {
    thread_id: v.id("threads"),
    status: v.union(
      v.literal("new"), 
      v.literal("acknowledged"), 
      v.literal("in_progress"), 
      v.literal("resolved"),
      v.literal("closed")
    ),
    updated_by: v.union(v.literal("client"), v.literal("developer")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    
    // Update thread status
    await ctx.db.patch(args.thread_id, {
      status: args.status,
      last_activity: now,
    });

    // Add system message about status change
    const statusMessages = {
      new: "Nueva conversación iniciada",
      acknowledged: "Conversación vista por el desarrollador",
      in_progress: "Trabajando en esta conversación",
      resolved: "Conversación marcada como resuelta",
      closed: "Conversación cerrada"
    };

    const systemMessage = args.note 
      ? `📋 **Estado actualizado: ${statusMessages[args.status]}**\n\n${args.note}`
      : `📋 **Estado actualizado: ${statusMessages[args.status]}**`;

    await ctx.db.insert("messages", {
      thread_id: args.thread_id,
      author: args.updated_by,
      content: systemMessage,
      message_type: "status_update",
      is_private: false,
      is_edited: false,
      created_at: now,
    });

    // Update unread counts
    const thread = await ctx.db.get(args.thread_id);
    if (thread) {
      await ctx.db.patch(args.thread_id, {
        unread_count_client: args.updated_by === "developer" ? thread.unread_count_client + 1 : 0,
        unread_count_developer: args.updated_by === "client" ? thread.unread_count_developer + 1 : 0,
      });
    }

    return args.thread_id;
  },
});

// Mark thread as read
export const markThreadAsRead = mutation({
  args: {
    thread_id: v.id("threads"),
    reader: v.union(v.literal("client"), v.literal("developer")),
  },
  handler: async (ctx, args) => {
    const updates = args.reader === "client" 
      ? { unread_count_client: 0 }
      : { unread_count_developer: 0 };

    await ctx.db.patch(args.thread_id, updates);
    return args.thread_id;
  },
});

// Get recent activity across all threads
export const getRecentActivity = query({
  args: { 
    limit: v.optional(v.number()),
    viewer: v.optional(v.union(v.literal("client"), v.literal("developer")))
  },
  handler: async (ctx, args) => {
    const threads = await ctx.db
      .query("threads")
      .withIndex("by_last_activity")
      .order("desc")
      .take(args.limit || 20);

    const threadsWithDetails = await Promise.all(
      threads.map(async (thread) => {
        const project = await ctx.db.get(thread.project_id);
        const client = project ? await ctx.db.get(project.client_id) : null;
        
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_thread", (q) => q.eq("thread_id", thread._id))
          .order("desc")
          .take(1);

        const lastMessage = messages[0] || null;
        const unreadCount = args.viewer === "developer" 
          ? thread.unread_count_developer 
          : thread.unread_count_client;

        return {
          ...thread,
          project,
          client,
          last_message: lastMessage,
          unread_count: unreadCount,
        };
      })
    );

    return threadsWithDetails;
  },
});

// Search threads
export const searchThreads = query({
  args: {
    query: v.string(),
    project_id: v.optional(v.id("projects")),
    viewer: v.optional(v.union(v.literal("client"), v.literal("developer")))
  },
  handler: async (ctx, args) => {
    const allThreads = args.project_id 
      ? await ctx.db
          .query("threads")
          .withIndex("by_project", (q) => q.eq("project_id", args.project_id!))
          .collect()
      : await ctx.db.query("threads").collect();
    
    // Simple text search in title
    const matchingThreads = allThreads.filter(thread => 
      thread.title.toLowerCase().includes(args.query.toLowerCase())
    );

    const threadsWithDetails = await Promise.all(
      matchingThreads.map(async (thread) => {
        const project = await ctx.db.get(thread.project_id);
        const unreadCount = args.viewer === "developer" 
          ? thread.unread_count_developer 
          : thread.unread_count_client;

        return {
          ...thread,
          project,
          unread_count: unreadCount,
        };
      })
    );

    return threadsWithDetails.sort((a, b) => new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime());
  },
});

// Get total unread count for badge notifications
export const getTotalUnreadCount = query({
  args: { 
    viewer: v.union(v.literal("client"), v.literal("developer"))
  },
  handler: async (ctx, args) => {
    const threads = await ctx.db
      .query("threads")
      .filter(q => q.eq(q.field("is_archived"), false)) // Only count non-archived threads
      .collect();

    const totalUnread = threads.reduce((total, thread) => {
      const unreadCount = args.viewer === "developer" 
        ? thread.unread_count_developer 
        : thread.unread_count_client;
      return total + unreadCount;
    }, 0);

    return totalUnread;
  },
});