import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get all projects for a client
export const getClientProjects = query({
  args: { 
    client_id: v.id("clients"),
    include_archived: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    let projects = await ctx.db
      .query("projects")
      .withIndex("by_client", (q) => q.eq("client_id", args.client_id))
      .collect();
    
    // Filter by archived status
    if (!args.include_archived) {
      projects = projects.filter(project => !project.is_archived);
    } else {
      projects = projects.filter(project => !!project.is_archived);
    }

    // Get unread thread counts for each project
    const projectsWithCounts = await Promise.all(
      projects.map(async (project) => {
        const threads = await ctx.db
          .query("threads")
          .withIndex("by_project", (q) => q.eq("project_id", project._id))
          .collect();

        const unreadCount = threads.reduce((total, thread) => total + thread.unread_count_client, 0);
        const activeThreads = threads.filter(thread => thread.status !== "closed").length;
        
        // Find most recent activity across all threads
        const mostRecentActivity = threads.length > 0 
          ? threads.reduce((latest, thread) => {
              const threadActivity = new Date(thread.last_activity);
              const latestActivity = new Date(latest);
              return threadActivity > latestActivity ? thread.last_activity : latest;
            }, threads[0].last_activity)
          : project.updated_at;

        return {
          ...project,
          unread_count: unreadCount,
          active_threads: activeThreads,
          total_threads: threads.length,
          archived: project.is_archived, // Map is_archived to archived for frontend
          updated_at: mostRecentActivity, // Use most recent thread activity as project activity
        };
      })
    );

    return projectsWithCounts.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  },
});

// Get single project details
export const getProject = query({
  args: { project_id: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.project_id);
    if (!project) return null;

    // Get client info
    const client = await ctx.db.get(project.client_id);

    // Get thread summary
    const threads = await ctx.db
      .query("threads")
      .withIndex("by_project", (q) => q.eq("project_id", args.project_id))
      .collect();

    const unreadCount = threads.reduce((total, thread) => total + thread.unread_count_client, 0);

    return {
      ...project,
      client,
      unread_count: unreadCount,
      thread_count: threads.length,
      active_threads: threads.filter(t => t.status !== "closed").length,
    };
  },
});

// Create new project
export const createProject = mutation({
  args: {
    client_id: v.id("clients"),
    name: v.string(),
    type: v.union(
      v.literal("presentation"), 
      v.literal("cards"), 
      v.literal("lead_gen"), 
      v.literal("website"),
      v.literal("other")
    ),
    icon: v.string(),
    color: v.string(),
    description: v.optional(v.string()),
    deadline: v.optional(v.string()),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    
    const projectId = await ctx.db.insert("projects", {
      client_id: args.client_id,
      name: args.name,
      type: args.type,
      status: "not_started",
      priority: args.priority || "medium",
      icon: args.icon,
      color: args.color,
      description: args.description,
      deadline: args.deadline,
      created_at: now,
      updated_at: now,
    });


    return projectId;
  },
});

// Update project status
export const updateProjectStatus = mutation({
  args: {
    project_id: v.id("projects"),
    status: v.union(
      v.literal("not_started"), 
      v.literal("in_progress"), 
      v.literal("review"), 
      v.literal("complete"),
      v.literal("paused")
    ),
    developer_note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    
    // Update project
    await ctx.db.patch(args.project_id, {
      status: args.status,
      updated_at: now,
    });

    // Create system message if there's a note
    if (args.developer_note) {
      // Find the most recent active thread or create a status thread
      const threads = await ctx.db
        .query("threads")
        .withIndex("by_project", (q) => q.eq("project_id", args.project_id))
        .order("desc")
        .take(1);

      let threadId;
      if (threads.length > 0) {
        threadId = threads[0]._id;
      } else {
        // Create status update thread
        threadId = await ctx.db.insert("threads", {
          project_id: args.project_id,
          title: "Actualizaciones del Proyecto",
          status: "new",
          priority: "normal",
          created_by: "developer",
          last_activity: now,
          unread_count_client: 1,
          unread_count_developer: 0,
          created_at: now,
        });
      }

      // Add status update message
      await ctx.db.insert("messages", {
        thread_id: threadId,
        author: "developer",
        content: `📊 **Estado del proyecto actualizado: ${args.status.toUpperCase()}**\n\n${args.developer_note}`,
        message_type: "status_update",
        is_private: false,
        is_edited: false,
        created_at: now,
      });

      // Update thread activity
      await ctx.db.patch(threadId, {
        last_activity: now,
        unread_count_client: (await ctx.db.get(threadId))!.unread_count_client + 1,
      });
    }

    return args.project_id;
  },
});

// Get projects by status (for developer dashboard)
export const getProjectsByStatus = query({
  args: { 
    status: v.optional(v.union(
      v.literal("not_started"), 
      v.literal("in_progress"), 
      v.literal("review"), 
      v.literal("complete"),
      v.literal("paused")
    )) 
  },
  handler: async (ctx, args) => {
    const projects = args.status 
      ? await ctx.db
          .query("projects")
          .withIndex("by_status", (q) => q.eq("status", args.status!))
          .collect()
      : await ctx.db.query("projects").collect();

    // Add client info and thread counts
    const projectsWithDetails = await Promise.all(
      projects.map(async (project) => {
        const client = await ctx.db.get(project.client_id);
        const threads = await ctx.db
          .query("threads")
          .withIndex("by_project", (q) => q.eq("project_id", project._id))
          .collect();

        const unreadCount = threads.reduce((total, thread) => total + thread.unread_count_developer, 0);

        return {
          ...project,
          client,
          unread_count: unreadCount,
          thread_count: threads.length,
        };
      })
    );

    return projectsWithDetails.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  },
});

// Delete project and all associated data
export const deleteProject = mutation({
  args: {
    project_id: v.id("projects"),
  },
  handler: async (ctx, args) => {
    try {
      // Get all threads for this project
      const threads = await ctx.db
        .query("threads")
        .withIndex("by_project", (q) => q.eq("project_id", args.project_id))
        .collect();

      console.log(`Found ${threads.length} threads to delete for project ${args.project_id}`);

      // Delete all messages for each thread
      for (const thread of threads) {
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_thread", (q) => q.eq("thread_id", thread._id))
          .collect();

        console.log(`Found ${messages.length} messages to delete for thread ${thread._id}`);

        for (const message of messages) {
          await ctx.db.delete(message._id);
        }

        // Delete notifications for this thread (more efficient query)
        if (thread._id) {
          const threadNotifications = await ctx.db
            .query("notifications")
            .filter(q => q.eq(q.field("thread_id"), thread._id))
            .collect();
          
          for (const notification of threadNotifications) {
            await ctx.db.delete(notification._id);
          }
        }

        // Delete the thread
        await ctx.db.delete(thread._id);
      }

      // Delete project-level notifications
      const projectNotifications = await ctx.db
        .query("notifications")
        .filter(q => q.eq(q.field("project_id"), args.project_id))
        .collect();
      
      for (const notification of projectNotifications) {
        await ctx.db.delete(notification._id);
      }

      // Finally, delete the project
      await ctx.db.delete(args.project_id);

      console.log(`Successfully deleted project ${args.project_id} with ${threads.length} threads`);
      return { success: true, deleted_threads: threads.length };
    } catch (error) {
      console.error("Error in deleteProject mutation:", error);
      throw new Error(`Failed to delete project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

// Archive/unarchive project
export const toggleProjectArchive = mutation({
  args: {
    project_id: v.id("projects"),
    archived: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    
    await ctx.db.patch(args.project_id, {
      is_archived: args.archived,
      updated_at: now,
    });

    return { success: true, archived: args.archived };
  },
});