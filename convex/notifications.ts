import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Send Telegram notification for new client messages
export const sendTelegramAlert = mutation({
  args: {
    thread_id: v.id("threads"),
    project_id: v.id("projects"),
    message: v.string(),
    author: v.union(v.literal("client"), v.literal("developer")),
  },
  handler: async (ctx, args) => {
    // Only send notifications for client messages
    if (args.author !== "client") {
      return null;
    }

    const thread = await ctx.db.get(args.thread_id);
    const project = await ctx.db.get(args.project_id);
    
    if (!thread || !project) {
      return null;
    }

    const client = await ctx.db.get(project.client_id);
    const truncatedMessage = args.message.length > 100 
      ? args.message.slice(0, 100) + "..." 
      : args.message;

    const telegramMessage = `🔔 *Nuevo Mensaje*

👤 *Cliente:* ${client?.name || "Cliente"}
📁 *Proyecto:* ${project.name}
💬 *Hilo:* ${thread.title}

📝 *Mensaje:*
${truncatedMessage}

⏰ *Fecha:* ${new Date().toLocaleString('es-MX', {
  timeZone: 'America/Mexico_City',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})}

🔗 *Ver conversación:* https://agualimpia.vercel.app/#/platform/thread/${thread._id}
📊 *Dashboard:* https://agualimpia.vercel.app/#/platform/admin`;

    // Create notification record
    const notificationId = await ctx.db.insert("notifications", {
      type: "telegram",
      recipient: process.env.TELEGRAM_CHAT_ID || "",
      message: telegramMessage,
      thread_id: args.thread_id,
      project_id: args.project_id,
      status: "pending",
      created_at: new Date().toISOString(),
    });

    // Send to Telegram Bot API
    try {
      const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: telegramMessage,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }),
      });

      if (response.ok) {
        await ctx.db.patch(notificationId, {
          status: "sent",
          sent_at: new Date().toISOString(),
        });
      } else {
        const error = await response.text();
        await ctx.db.patch(notificationId, {
          status: "failed",
          message: `${telegramMessage}\n\nError: ${error}`,
        });
      }
    } catch (error) {
      await ctx.db.patch(notificationId, {
        status: "failed",
        message: `${telegramMessage}\n\nError: ${error}`,
      });
    }

    return notificationId;
  },
});

// Send project status update notification
export const sendProjectStatusNotification = mutation({
  args: {
    project_id: v.id("projects"),
    old_status: v.union(v.literal("not_started"), v.literal("in_progress"), v.literal("review"), v.literal("complete"), v.literal("paused")),
    new_status: v.union(v.literal("not_started"), v.literal("in_progress"), v.literal("review"), v.literal("complete"), v.literal("paused")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.project_id);
    if (!project) return null;

    const client = await ctx.db.get(project.client_id);

    const statusEmojis = {
      not_started: "⏸️",
      in_progress: "🔄",
      review: "👀",
      complete: "✅",
      paused: "⏸️"
    };

    const statusNames = {
      not_started: "No iniciado",
      in_progress: "En progreso", 
      review: "En revisión",
      complete: "Completado",
      paused: "Pausado"
    };

    const telegramMessage = `📊 *Actualización de Proyecto*

👤 *Cliente:* ${client?.name || "Cliente"}
📁 *Proyecto:* ${project.name}

${statusEmojis[args.old_status]} *Estado anterior:* ${statusNames[args.old_status]}
${statusEmojis[args.new_status]} *Estado nuevo:* ${statusNames[args.new_status]}

${args.note ? `📝 *Nota:*\n${args.note}` : ''}

⏰ *Fecha:* ${new Date().toLocaleString('es-MX', {
  timeZone: 'America/Mexico_City',
  year: 'numeric',
  month: 'short', 
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})}

🔗 *Ver proyecto:* https://agualimpia.vercel.app/#/platform/project/${project._id}`;

    const notificationId = await ctx.db.insert("notifications", {
      type: "telegram",
      recipient: process.env.TELEGRAM_CHAT_ID || "",
      message: telegramMessage,
      project_id: args.project_id,
      status: "pending",
      created_at: new Date().toISOString(),
    });

    try {
      const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: telegramMessage,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }),
      });

      if (response.ok) {
        await ctx.db.patch(notificationId, {
          status: "sent",
          sent_at: new Date().toISOString(),
        });
      } else {
        await ctx.db.patch(notificationId, { status: "failed" });
      }
    } catch (error) {
      await ctx.db.patch(notificationId, { status: "failed" });
    }

    return notificationId;
  },
});

// Get notification history
export const getNotificationHistory = query({
  args: { 
    limit: v.optional(v.number()),
    status: v.optional(v.union(v.literal("pending"), v.literal("sent"), v.literal("failed")))
  },
  handler: async (ctx, args) => {
    const notifications = args.status
      ? await ctx.db
          .query("notifications")
          .withIndex("by_status", (q) => q.eq("status", args.status!))
          .take(args.limit || 50)
      : await ctx.db
          .query("notifications")
          .withIndex("by_created_at")
          .order("desc")
          .take(args.limit || 50);

    // Add thread and project context
    const notificationsWithContext = await Promise.all(
      notifications.map(async (notification: any) => {
        let thread = null;
        let project = null;

        if (notification.thread_id) {
          thread = await ctx.db.get(notification.thread_id);
        }
        
        if (notification.project_id) {
          project = await ctx.db.get(notification.project_id);
        }

        return {
          ...notification,
          thread,
          project,
        };
      })
    );

    return notificationsWithContext;
  },
});

// Retry failed notifications
export const retryFailedNotifications = mutation({
  args: { notification_id: v.optional(v.id("notifications")) },
  handler: async (ctx, args) => {
    let notifications;
    
    if (args.notification_id) {
      const notification = await ctx.db.get(args.notification_id);
      notifications = notification ? [notification] : [];
    } else {
      notifications = await ctx.db
        .query("notifications")
        .withIndex("by_status", (q) => q.eq("status", "failed"))
        .collect();
    }

    let successCount = 0;

    for (const notification of notifications) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: process.env.TELEGRAM_CHAT_ID,
            text: `🔄 REENVÍO\n\n${notification.message}`,
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
          }),
        });

        if (response.ok) {
          await ctx.db.patch(notification._id, {
            status: "sent",
            sent_at: new Date().toISOString(),
          });
          successCount++;
        }
      } catch (error) {
        console.error("Failed to retry notification:", error);
      }
    }

    return {
      total_attempted: notifications.length,
      successful: successCount,
      failed: notifications.length - successCount,
    };
  },
});

// Test Telegram connection
export const testTelegramConnection = mutation({
  handler: async (ctx) => {
    const testMessage = `🧪 *Prueba de Conexión Telegram*

✅ El sistema de notificaciones está funcionando correctamente.

⏰ *Fecha de prueba:* ${new Date().toLocaleString('es-MX', {
  timeZone: 'America/Mexico_City',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
})}

🔗 *Plataforma:* https://agualimpia.vercel.app/#/platform`;

    try {
      const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: testMessage,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }),
      });

      if (response.ok) {
        return { success: true, message: "Mensaje de prueba enviado exitosamente" };
      } else {
        const error = await response.text();
        return { success: false, message: `Error: ${error}` };
      }
    } catch (error) {
      return { success: false, message: `Error de conexión: ${error}` };
    }
  },
});