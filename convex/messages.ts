import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

// Get messages for a thread
export const getThreadMessages = query({
  args: { 
    thread_id: v.id("threads"), 
    include_private: v.optional(v.boolean()),
    limit: v.optional(v.number()),
    before: v.optional(v.string()) // for pagination
  },
  handler: async (ctx, args) => {
    let messagesQuery = ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("thread_id", args.thread_id))
      .order("desc");

    const messages = args.limit 
      ? await messagesQuery.take(args.limit)
      : await messagesQuery.collect();
    
    // Filter private messages for client view
    const filteredMessages = args.include_private 
      ? messages 
      : messages.filter((msg: any) => !msg.is_private);

    // Reverse to show oldest first
    return filteredMessages.reverse();
  },
});

// Send message in thread
export const sendMessage = mutation({
  args: {
    thread_id: v.id("threads"),
    content: v.string(),
    author: v.union(v.literal("client"), v.literal("developer")),
    message_type: v.optional(v.union(v.literal("text"), v.literal("system"), v.literal("status_update"), v.literal("file"))),
    is_private: v.optional(v.boolean()),
    // Translation fields
    original_content: v.optional(v.string()),
    original_language: v.optional(v.union(v.literal("en"), v.literal("es"))),
    translated_content: v.optional(v.string()),
    target_language: v.optional(v.union(v.literal("en"), v.literal("es"))),
    translation_enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    
    // Insert message
    const messageId = await ctx.db.insert("messages", {
      thread_id: args.thread_id,
      author: args.author,
      content: args.content,
      message_type: args.message_type || "text",
      is_private: args.is_private || false,
      is_edited: false,
      created_at: now,
      // Translation fields
      original_content: args.original_content,
      original_language: args.original_language,
      translated_content: args.translated_content,
      target_language: args.target_language,
      translation_enabled: args.translation_enabled,
    });

    // Update thread activity and unread counts
    const thread = await ctx.db.get(args.thread_id);
    if (thread) {
      const newUnreadClient = args.author === "developer" && !args.is_private
        ? thread.unread_count_client + 1
        : args.author === "client" ? 0 : thread.unread_count_client;
      
      const newUnreadDeveloper = args.author === "client"
        ? thread.unread_count_developer + 1
        : args.author === "developer" ? 0 : thread.unread_count_developer;

      await ctx.db.patch(args.thread_id, {
        last_activity: now,
        unread_count_client: newUnreadClient,
        unread_count_developer: newUnreadDeveloper,
      });

      // Update project activity
      await ctx.db.patch(thread.project_id, {
        updated_at: now,
      });

      // Trigger notification for client messages
      if (args.author === "client" && !args.is_private) {
        // Get project and client info for notification
        const project = await ctx.db.get(thread.project_id);
        if (project) {
          await ctx.runMutation(api.notifications.sendTelegramAlert, {
            thread_id: args.thread_id,
            project_id: project._id,
            message: args.content,
            author: args.author,
          });
        }
      }
    }

    return messageId;
  },
});

// Edit message
export const editMessage = mutation({
  args: {
    message_id: v.id("messages"),
    new_content: v.string(),
    editor: v.union(v.literal("client"), v.literal("developer")),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.message_id);
    if (!message) return null;

    // Only allow editing own messages
    if (message.author !== args.editor) {
      throw new Error("No puedes editar mensajes de otros usuarios");
    }

    const now = new Date().toISOString();

    await ctx.db.patch(args.message_id, {
      content: args.new_content,
      is_edited: true,
      edited_at: now,
    });

    // Update thread activity
    await ctx.db.patch(message.thread_id, {
      last_activity: now,
    });

    return args.message_id;
  },
});

// Delete message (soft delete by marking as edited with deleted content)
export const deleteMessage = mutation({
  args: {
    message_id: v.id("messages"),
    deleter: v.union(v.literal("client"), v.literal("developer")),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.message_id);
    if (!message) return null;

    // Only allow deleting own messages or developer can delete any
    if (message.author !== args.deleter && args.deleter !== "developer") {
      throw new Error("No puedes eliminar mensajes de otros usuarios");
    }

    const now = new Date().toISOString();

    await ctx.db.patch(args.message_id, {
      content: "*Mensaje eliminado*",
      is_edited: true,
      edited_at: now,
    });

    return args.message_id;
  },
});

// Add developer note (private message)
export const addDeveloperNote = mutation({
  args: {
    thread_id: v.id("threads"),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    
    const messageId = await ctx.db.insert("messages", {
      thread_id: args.thread_id,
      author: "developer",
      content: `🔒 **Nota privada:** ${args.note}`,
      message_type: "text",
      is_private: true,
      is_edited: false,
      created_at: now,
    });

    // Update thread activity (but don't increase client unread count)
    await ctx.db.patch(args.thread_id, {
      last_activity: now,
    });

    return messageId;
  },
});

// Get message statistics
export const getMessageStats = query({
  args: {
    thread_id: v.optional(v.id("threads")),
    project_id: v.optional(v.id("projects")),
    timeframe_days: v.optional(v.number()), // default 30 days
  },
  handler: async (ctx, args) => {
    const days = args.timeframe_days || 30;
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const allMessages = args.thread_id
      ? await ctx.db
          .query("messages")
          .withIndex("by_thread", (q) => q.eq("thread_id", args.thread_id!))
          .collect()
      : await ctx.db.query("messages").collect();
    
    // Filter by project if specified
    let filteredMessages = allMessages;
    if (args.project_id) {
      const projectThreads = await ctx.db
        .query("threads")
        .withIndex("by_project", (q) => q.eq("project_id", args.project_id!))
        .collect();
      
      const threadIds = new Set(projectThreads.map(t => t._id));
      filteredMessages = allMessages.filter((msg: any) => threadIds.has(msg.thread_id));
    }

    // Filter by timeframe
    const recentMessages = filteredMessages.filter((msg: any) => msg.created_at >= cutoffDate);

    const stats = {
      total_messages: recentMessages.length,
      client_messages: recentMessages.filter(msg => msg.author === "client").length,
      developer_messages: recentMessages.filter(msg => msg.author === "developer").length,
      private_notes: recentMessages.filter(msg => msg.is_private).length,
      avg_response_time_hours: 0, // TODO: Calculate based on message timings
      most_active_day: "", // TODO: Calculate most active day
    };

    return stats;
  },
});

// Search messages
export const searchMessages = query({
  args: {
    query: v.string(),
    thread_id: v.optional(v.id("threads")),
    project_id: v.optional(v.id("projects")),
    include_private: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const allMessages = args.thread_id
      ? await ctx.db
          .query("messages")
          .withIndex("by_thread", (q) => q.eq("thread_id", args.thread_id!))
          .take(args.limit || 50)
      : await ctx.db.query("messages").take(args.limit || 50);
    
    // Filter by project if specified
    let filteredMessages = allMessages;
    if (args.project_id) {
      const projectThreads = await ctx.db
        .query("threads")
        .withIndex("by_project", (q) => q.eq("project_id", args.project_id!))
        .collect();
      
      const threadIds = new Set(projectThreads.map(t => t._id));
      filteredMessages = allMessages.filter((msg: any) => threadIds.has(msg.thread_id));
    }

    // Filter private messages if needed
    if (!args.include_private) {
      filteredMessages = filteredMessages.filter((msg: any) => !msg.is_private);
    }

    // Simple text search in content
    const matchingMessages = filteredMessages.filter((msg: any) => 
      msg.content.toLowerCase().includes(args.query.toLowerCase())
    );

    // Add thread and project context
    const messagesWithContext = await Promise.all(
      matchingMessages.map(async (message: any) => {
        const thread = await ctx.db.get(message.thread_id);
        const project = thread ? await ctx.db.get((thread as any).project_id) : null;

        return {
          ...message,
          thread,
          project,
        };
      })
    );

    return messagesWithContext.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },
});