import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Clean up welcome messages and fix thread titles
export const cleanupWelcomeMessages = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all threads with Spanish welcome titles
    const threads = await ctx.db.query("threads").collect();
    let updatedThreads = 0;
    let deletedMessages = 0;

    for (const thread of threads) {
      // Fix thread titles that start with "¡Bienvenido a"
      if (thread.title.startsWith("¡Bienvenido a ") && thread.title.endsWith("!")) {
        const projectName = thread.title.replace("¡Bienvenido a ", "").replace("!", "");
        await ctx.db.patch(thread._id, {
          title: projectName
        });
        updatedThreads++;
      }

      // Delete welcome messages
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_thread", (q) => q.eq("thread_id", thread._id))
        .collect();

      for (const message of messages) {
        // Delete Spanish welcome messages
        if (message.content.includes("¡Hola! Este es tu espacio de comunicación") || 
            message.content.includes("¡Bienvenido al proyecto")) {
          await ctx.db.delete(message._id);
          deletedMessages++;
        }
      }
    }

    return {
      success: true,
      updated_threads: updatedThreads,
      deleted_messages: deletedMessages
    };
  },
});

// Migrate existing feedback to new platform structure
export const migrateFeedbackData = mutation({
  args: { client_name: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Check if migration has already been run
    const existingClient = await ctx.db
      .query("clients")
      .filter((q) => q.eq(q.field("name"), args.client_name || "Cliente Principal"))
      .first();

    if (existingClient) {
      return {
        success: false,
        message: "Migration already completed",
        client_id: existingClient._id
      };
    }

    const now = new Date().toISOString();

    // 1. Create main client
    const clientId = await ctx.db.insert("clients", {
      name: args.client_name || "Cliente Principal",
      email: "cliente@agualimpia.com",
      language: "es",
      tech_level: 3,
      timezone: "America/Mexico_City",
      created_at: now,
      last_active: now,
    });

    // 2. Create main project (Agua Limpia Presentation)
    const mainProjectId = await ctx.db.insert("projects", {
      client_id: clientId,
      name: "Agua Limpia - Presentación",
      type: "presentation",
      status: "in_progress",
      priority: "high",
      icon: "💧",
      color: "#0EA5E9",
      description: "Presentación profesional para sistema de tratamiento de agua con PWA offline y funcionalidad completa.",
      created_at: now,
      updated_at: now,
    });

    // 3. Get existing feedback data
    const existingFeedback = await ctx.db.query("feedback").collect();

    // 4. Migrate each feedback item to legacy table and create corresponding threads
    let migratedCount = 0;
    
    for (const feedback of existingFeedback) {
      // Move to legacy table
      await ctx.db.insert("legacy_feedback", {
        category: feedback.category,
        subject: feedback.subject,
        description: feedback.description,
        status: feedback.status,
        priority: feedback.priority,
        developer_notes: feedback.developer_notes,
        client_response: feedback.client_response,
        created_at: feedback._creationTime.toString(),
        migration_date: now,
      });

      // Create thread for this feedback
      const threadId = await ctx.db.insert("threads", {
        project_id: mainProjectId,
        title: feedback.subject,
        status: feedback.status === "new" ? "new" : 
               feedback.status === "in_progress" ? "in_progress" :
               feedback.status === "completed" ? "resolved" : "closed",
        priority: feedback.priority === "high" ? "urgent" : "normal",
        created_by: "client",
        last_activity: now,
        unread_count_client: 0,
        unread_count_developer: feedback.status === "new" ? 1 : 0,
        created_at: feedback._creationTime.toString(),
      });

      // Add initial message with feedback description
      await ctx.db.insert("messages", {
        thread_id: threadId,
        author: "client",
        content: feedback.description,
        message_type: "text",
        is_private: false,
        is_edited: false,
        created_at: feedback._creationTime.toString(),
      });

      // Add developer notes if they exist
      if (feedback.developer_notes) {
        await ctx.db.insert("messages", {
          thread_id: threadId,
          author: "developer",
          content: `📝 **Nota del desarrollador:**\n\n${feedback.developer_notes}`,
          message_type: "text",
          is_private: false,
          is_edited: false,
          created_at: feedback._creationTime.toString(),
        });
      }

      // Update legacy feedback with thread reference
      const legacyFeedback = await ctx.db
        .query("legacy_feedback")
        .filter((q) => q.eq(q.field("subject"), feedback.subject))
        .first();
      
      if (legacyFeedback) {
        await ctx.db.patch(legacyFeedback._id, {
          migrated_to_thread: threadId,
        });
      }

      migratedCount++;
    }

    // 5. Create additional sample projects
    const sampleProjects = [
      {
        name: "Tarjetas Físicas - Rediseño",
        type: "cards" as const,
        icon: "🃏",
        color: "#10B981",
        description: "Rediseño de tarjetas de presentación y materiales físicos para el negocio.",
      },
      {
        name: "Sistema Generador de Leads",
        type: "lead_gen" as const,
        icon: "🎯",
        color: "#F59E0B",
        description: "Implementación de sistema automatizado para captura y gestión de prospectos.",
      }
    ];

    const sampleProjectIds = [];
    for (const project of sampleProjects) {
      const projectId = await ctx.db.insert("projects", {
        client_id: clientId,
        name: project.name,
        type: project.type,
        status: "not_started",
        priority: "medium",
        icon: project.icon,
        color: project.color,
        description: project.description,
        created_at: now,
        updated_at: now,
      });


      sampleProjectIds.push(projectId);
    }

    return {
      success: true,
      message: `Migration completed successfully`,
      client_id: clientId,
      main_project_id: mainProjectId,
      migrated_feedback_count: migratedCount,
      sample_project_ids: sampleProjectIds,
      total_projects: sampleProjects.length + 1,
    };
  },
});

// Seed development data (additional clients and projects for testing)
export const seedDevelopmentData = mutation({
  handler: async (ctx) => {
    const now = new Date().toISOString();

    // Create a test client
    const testClientId = await ctx.db.insert("clients", {
      name: "Cliente de Prueba",
      email: "test@example.com",
      language: "es",
      tech_level: 2,
      timezone: "America/Mexico_City",
      created_at: now,
      last_active: now,
    });

    // Create test project
    const testProjectId = await ctx.db.insert("projects", {
      client_id: testClientId,
      name: "Proyecto de Prueba",
      type: "website",
      status: "in_progress",
      priority: "low",
      icon: "🧪",
      color: "#8B5CF6",
      description: "Este es un proyecto de prueba para validar la funcionalidad de la plataforma.",
      created_at: now,
      updated_at: now,
    });

    // Create test thread with messages
    const testThreadId = await ctx.db.insert("threads", {
      project_id: testProjectId,
      title: "Prueba de Conversación",
      status: "in_progress",
      priority: "normal",
      created_by: "client",
      last_activity: now,
      unread_count_client: 0,
      unread_count_developer: 1,
      created_at: now,
    });

    // Add test messages
    const testMessages = [
      {
        author: "client" as const,
        content: "¡Hola! Esta es una prueba del sistema de mensajería.",
        time_offset: 0
      },
      {
        author: "developer" as const,
        content: "¡Perfecto! El sistema está funcionando correctamente. ¿Cómo te sientes usando la nueva plataforma?",
        time_offset: 300000 // 5 minutes later
      },
      {
        author: "client" as const,
        content: "Me gusta mucho la interfaz, es muy fácil de usar. ¿Podemos agregar más funcionalidades?",
        time_offset: 600000 // 10 minutes later
      }
    ];

    for (const [index, message] of testMessages.entries()) {
      const messageTime = new Date(Date.now() + message.time_offset).toISOString();
      
      await ctx.db.insert("messages", {
        thread_id: testThreadId,
        author: message.author,
        content: message.content,
        message_type: "text",
        is_private: false,
        is_edited: false,
        created_at: messageTime,
      });
    }

    return {
      success: true,
      test_client_id: testClientId,
      test_project_id: testProjectId,
      test_thread_id: testThreadId,
      test_messages_count: testMessages.length,
    };
  },
});

// Check migration status
export const getMigrationStatus = query({
  handler: async (ctx) => {
    const clients = await ctx.db.query("clients").collect();
    const projects = await ctx.db.query("projects").collect();
    const threads = await ctx.db.query("threads").collect();
    const messages = await ctx.db.query("messages").collect();
    const legacyFeedback = await ctx.db.query("legacy_feedback").collect();
    const originalFeedback = await ctx.db.query("feedback").collect();

    return {
      clients_count: clients.length,
      projects_count: projects.length,
      threads_count: threads.length,
      messages_count: messages.length,
      legacy_feedback_count: legacyFeedback.length,
      original_feedback_count: originalFeedback.length,
      migration_completed: clients.length > 0,
      main_client: clients.find(c => c.name === "Cliente Principal") || clients[0],
    };
  },
});

// Reset all data (development only)
export const resetAllData = mutation({
  args: { confirm: v.string() },
  handler: async (ctx, args) => {
    if (args.confirm !== "RESET_ALL_DATA") {
      throw new Error("Invalid confirmation");
    }

    // Delete all platform data (preserve original feedback and changelog)
    const clients = await ctx.db.query("clients").collect();
    const projects = await ctx.db.query("projects").collect();
    const threads = await ctx.db.query("threads").collect();
    const messages = await ctx.db.query("messages").collect();
    const legacyFeedback = await ctx.db.query("legacy_feedback").collect();
    const notifications = await ctx.db.query("notifications").collect();

    let deletedCount = 0;

    for (const item of messages) {
      await ctx.db.delete(item._id);
      deletedCount++;
    }

    for (const item of threads) {
      await ctx.db.delete(item._id);
      deletedCount++;
    }

    for (const item of projects) {
      await ctx.db.delete(item._id);
      deletedCount++;
    }

    for (const item of clients) {
      await ctx.db.delete(item._id);
      deletedCount++;
    }

    for (const item of legacyFeedback) {
      await ctx.db.delete(item._id);
      deletedCount++;
    }

    for (const item of notifications) {
      await ctx.db.delete(item._id);
      deletedCount++;
    }

    return {
      success: true,
      deleted_records: deletedCount,
      message: "All platform data reset successfully"
    };
  },
});