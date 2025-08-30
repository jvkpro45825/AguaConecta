import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get all clients
export const getAllClients = query({
  handler: async (ctx) => {
    const clients = await ctx.db.query("clients").collect();
    
    // Add project counts and activity info
    const clientsWithDetails = await Promise.all(
      clients.map(async (client) => {
        const projects = await ctx.db
          .query("projects")
          .withIndex("by_client", (q) => q.eq("client_id", client._id))
          .collect();

        const activeProjects = projects.filter(p => p.status === "in_progress").length;
        
        // Get unread message count across all projects
        const allThreads = await Promise.all(
          projects.map(project => 
            ctx.db
              .query("threads")
              .withIndex("by_project", (q) => q.eq("project_id", project._id))
              .collect()
          )
        );
        
        const flatThreads = allThreads.flat();
        const unreadCount = flatThreads.reduce((total, thread) => 
          total + thread.unread_count_developer, 0
        );

        return {
          ...client,
          project_count: projects.length,
          active_projects: activeProjects,
          unread_messages: unreadCount,
        };
      })
    );

    return clientsWithDetails.sort((a, b) => 
      new Date(b.last_active || b.created_at).getTime() - 
      new Date(a.last_active || a.created_at).getTime()
    );
  },
});

// Get single client with full details
export const getClient = query({
  args: { client_id: v.id("clients") },
  handler: async (ctx, args) => {
    const client = await ctx.db.get(args.client_id);
    if (!client) return null;

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_client", (q) => q.eq("client_id", args.client_id))
      .collect();

    // Get recent activity across all projects
    const allThreads = await Promise.all(
      projects.map(project => 
        ctx.db
          .query("threads")
          .withIndex("by_project", (q) => q.eq("project_id", project._id))
          .collect()
      )
    );
    
    const flatThreads = allThreads.flat();
    const recentActivity = flatThreads
      .sort((a, b) => new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime())
      .slice(0, 10);

    const unreadCount = flatThreads.reduce((total, thread) => 
      total + thread.unread_count_developer, 0
    );

    return {
      ...client,
      projects,
      recent_threads: recentActivity,
      unread_messages: unreadCount,
    };
  },
});

// Create new client
export const createClient = mutation({
  args: {
    name: v.string(),
    email: v.optional(v.string()),
    language: v.optional(v.union(v.literal("en"), v.literal("es"))),
    tech_level: v.optional(v.number()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    
    const clientId = await ctx.db.insert("clients", {
      name: args.name,
      email: args.email,
      language: args.language || "es",
      tech_level: args.tech_level || 3,
      timezone: args.timezone || "America/Mexico_City",
      created_at: now,
      last_active: now,
    });

    return clientId;
  },
});

// Update client information
export const updateClient = mutation({
  args: {
    client_id: v.id("clients"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    language: v.optional(v.union(v.literal("en"), v.literal("es"))),
    tech_level: v.optional(v.number()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { client_id, ...updates } = args;
    
    // Remove undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );

    if (Object.keys(cleanUpdates).length === 0) {
      return client_id;
    }

    await ctx.db.patch(client_id, cleanUpdates);
    return client_id;
  },
});

// Update client last active time
export const updateClientActivity = mutation({
  args: { client_id: v.id("clients") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.client_id, {
      last_active: new Date().toISOString(),
    });
    return args.client_id;
  },
});

// Get client activity summary
export const getClientActivitySummary = query({
  args: { 
    client_id: v.id("clients"),
    days: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const days = args.days || 30;
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Get all projects for client
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_client", (q) => q.eq("client_id", args.client_id))
      .collect();

    // Get all threads for these projects
    const allThreads = await Promise.all(
      projects.map(project => 
        ctx.db
          .query("threads")
          .withIndex("by_project", (q) => q.eq("project_id", project._id))
          .collect()
      )
    );

    const flatThreads = allThreads.flat();
    
    // Get all messages for these threads within timeframe
    const allMessages = await Promise.all(
      flatThreads.map(thread =>
        ctx.db
          .query("messages")
          .withIndex("by_thread", (q) => q.eq("thread_id", thread._id))
          .collect()
      )
    );

    const flatMessages = allMessages.flat()
      .filter(msg => msg.created_at >= cutoffDate);

    const clientMessages = flatMessages.filter(msg => msg.author === "client");
    const developerMessages = flatMessages.filter(msg => msg.author === "developer");

    // Calculate activity by day
    const dailyActivity: Record<string, { client: number; developer: number; total: number }> = {};
    flatMessages.forEach(msg => {
      const date = msg.created_at.split('T')[0];
      if (!dailyActivity[date]) {
        dailyActivity[date] = { client: 0, developer: 0, total: 0 };
      }
      dailyActivity[date][msg.author]++;
      dailyActivity[date].total++;
    });

    return {
      total_messages: flatMessages.length,
      client_messages: clientMessages.length,
      developer_messages: developerMessages.length,
      active_projects: projects.filter(p => p.status === "in_progress").length,
      total_projects: projects.length,
      active_threads: flatThreads.filter(t => t.status !== "closed").length,
      daily_activity: dailyActivity,
      most_recent_activity: flatThreads.length > 0 
        ? Math.max(...flatThreads.map(t => new Date(t.last_activity).getTime()))
        : null,
    };
  },
});

// Archive client (soft delete)
export const archiveClient = mutation({
  args: { client_id: v.id("clients") },
  handler: async (ctx, args) => {
    // In a real implementation, you might add an 'archived' field
    // For now, we'll just return the client_id
    return args.client_id;
  },
});

// Alias for compatibility with frontend
export const list = getAllClients;