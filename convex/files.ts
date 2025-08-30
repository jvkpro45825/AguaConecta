import { mutation } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

// Generate upload URL for file
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Send file message in thread
export const sendFileMessage = mutation({
  args: {
    thread_id: v.id("threads"),
    author: v.union(v.literal("client"), v.literal("developer")),
    file_id: v.id("_storage"),
    file_name: v.string(),
    file_type: v.string(),
    file_size: v.number(),
    caption: v.optional(v.string()), // Optional caption/message with the file
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    
    // Get file URL from Convex storage
    const file_url = await ctx.storage.getUrl(args.file_id);
    
    // Create file content - filename + optional caption
    const content = args.caption 
      ? `📎 ${args.file_name}\n${args.caption}` 
      : `📎 ${args.file_name}`;
    
    // Insert file message
    const messageId = await ctx.db.insert("messages", {
      thread_id: args.thread_id,
      author: args.author,
      content,
      message_type: "file",
      is_private: false,
      is_edited: false,
      created_at: now,
      // File fields
      file_id: args.file_id,
      file_name: args.file_name,
      file_type: args.file_type,
      file_size: args.file_size,
      file_url: file_url || undefined,
    });

    // Update thread activity and unread counts (same as regular messages)
    const thread = await ctx.db.get(args.thread_id);
    if (thread) {
      const newUnreadClient = args.author === "developer"
        ? thread.unread_count_client + 1
        : 0;
      
      const newUnreadDeveloper = args.author === "client"
        ? thread.unread_count_developer + 1
        : 0;

      await ctx.db.patch(args.thread_id, {
        last_activity: now,
        unread_count_client: newUnreadClient,
        unread_count_developer: newUnreadDeveloper,
      });

      // Update project activity
      await ctx.db.patch(thread.project_id, {
        updated_at: now,
      });

      // Auto-add file to project files system
      try {
        await ctx.runMutation(api.projectFiles.addFileToProject, {
          project_id: thread.project_id,
          file_id: args.file_id,
          message_id: messageId,
          file_name: args.file_name,
          file_type: args.file_type,
          file_size: args.file_size,
          uploaded_by: args.author,
        });
      } catch (error) {
        console.error("Failed to sync file to project files:", error);
      }
    }

    return messageId;
  },
});

// Get file info by storage ID
export const getFileInfo = mutation({
  args: {
    file_id: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const fileUrl = await ctx.storage.getUrl(args.file_id);
    return {
      url: fileUrl,
      id: args.file_id,
    };
  },
});