import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // === NEW MULTI-PROJECT PLATFORM SCHEMA ===
  
  clients: defineTable({
    name: v.string(),
    email: v.optional(v.string()),
    language: v.union(v.literal("en"), v.literal("es")),
    tech_level: v.optional(v.number()), // 1-5 scale
    timezone: v.optional(v.string()),
    created_at: v.string(),
    last_active: v.optional(v.string()),
  }),

  projects: defineTable({
    client_id: v.id("clients"),
    name: v.string(),
    type: v.union(
      v.literal("presentation"), 
      v.literal("cards"), 
      v.literal("lead_gen"), 
      v.literal("website"),
      v.literal("other")
    ),
    status: v.union(
      v.literal("not_started"), 
      v.literal("in_progress"), 
      v.literal("review"), 
      v.literal("complete"),
      v.literal("paused")
    ),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent")),
    icon: v.string(), // emoji or icon name
    color: v.string(), // hex color for project theme
    description: v.optional(v.string()),
    deadline: v.optional(v.string()),
    is_archived: v.optional(v.boolean()), // for archiving projects
    created_at: v.string(),
    updated_at: v.string(),
  }).index("by_client", ["client_id"]).index("by_status", ["status"]).index("by_archived", ["is_archived"]),

  threads: defineTable({
    project_id: v.id("projects"),
    title: v.string(),
    status: v.union(
      v.literal("new"), 
      v.literal("acknowledged"), 
      v.literal("in_progress"), 
      v.literal("resolved"),
      v.literal("closed")
    ),
    priority: v.union(v.literal("normal"), v.literal("urgent")),
    created_by: v.union(v.literal("client"), v.literal("developer")),
    last_activity: v.string(),
    unread_count_client: v.number(),
    unread_count_developer: v.number(),
    is_archived: v.optional(v.boolean()), // for archiving threads
    created_at: v.string(),
  }).index("by_project", ["project_id"]).index("by_last_activity", ["last_activity"]).index("by_archived", ["is_archived"]),

  messages: defineTable({
    thread_id: v.id("threads"),
    author: v.union(v.literal("client"), v.literal("developer")),
    content: v.string(),
    message_type: v.union(v.literal("text"), v.literal("system"), v.literal("status_update"), v.literal("file")),
    is_private: v.boolean(), // developer notes only
    is_edited: v.boolean(),
    created_at: v.string(),
    edited_at: v.optional(v.string()),
    // Translation fields
    original_content: v.optional(v.string()), // Original text before translation
    original_language: v.optional(v.union(v.literal("en"), v.literal("es"))), // Detected original language
    translated_content: v.optional(v.string()), // Translated text
    target_language: v.optional(v.union(v.literal("en"), v.literal("es"))), // Target language for translation
    translation_enabled: v.optional(v.boolean()), // Whether auto-translation was used
    // File attachment fields
    file_id: v.optional(v.id("_storage")), // Convex file storage ID
    file_name: v.optional(v.string()), // Original filename
    file_type: v.optional(v.string()), // MIME type
    file_size: v.optional(v.number()), // File size in bytes
    file_url: v.optional(v.string()), // Convex file URL for access
  }).index("by_thread", ["thread_id"]).index("by_created_at", ["created_at"]),

  // Project file organization system
  project_folders: defineTable({
    project_id: v.id("projects"),
    name: v.string(),
    parent_folder_id: v.optional(v.id("project_folders")), // For nested folders
    color: v.optional(v.string()), // Folder color theme
    icon: v.optional(v.string()), // Folder emoji/icon
    created_by: v.union(v.literal("client"), v.literal("developer")),
    created_at: v.string(),
  }).index("by_project", ["project_id"]).index("by_parent", ["parent_folder_id"]),

  project_files: defineTable({
    project_id: v.id("projects"),
    folder_id: v.optional(v.id("project_folders")), // null for root level
    file_id: v.id("_storage"), // Convex storage ID
    message_id: v.optional(v.id("messages")), // Source message if from conversation
    file_name: v.string(),
    file_type: v.string(),
    file_size: v.number(),
    file_url: v.optional(v.string()),
    tags: v.array(v.string()), // Custom tags for organization
    uploaded_by: v.union(v.literal("client"), v.literal("developer")),
    uploaded_at: v.string(),
    moved_at: v.optional(v.string()), // When file was last moved between folders
  }).index("by_project", ["project_id"]).index("by_folder", ["folder_id"]).index("by_file_type", ["file_type"]).index("by_message", ["message_id"]),

  // === LEGACY TABLES (PRESERVED FOR MIGRATION) ===
  
  feedback: defineTable({
    category: v.union(v.literal("suggestion"), v.literal("bug"), v.literal("change_request")),
    subject: v.string(),
    description: v.string(),
    status: v.union(v.literal("new"), v.literal("in_progress"), v.literal("completed"), v.literal("released")),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    developer_notes: v.optional(v.string()),
    client_response: v.optional(v.string()),
  }),

  legacy_feedback: defineTable({
    category: v.union(v.literal("suggestion"), v.literal("bug"), v.literal("change_request")),
    subject: v.string(),
    description: v.string(),
    status: v.union(v.literal("new"), v.literal("in_progress"), v.literal("completed"), v.literal("released")),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    developer_notes: v.optional(v.string()),
    client_response: v.optional(v.string()),
    migrated_to_thread: v.optional(v.id("threads")),
    migration_date: v.optional(v.string()),
    created_at: v.string(),
  }),
  
  changelog: defineTable({
    version: v.string(),
    release_date: v.string(),
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
  }).index("by_version", ["version"]),

  // === SYSTEM TABLES ===
  
  notifications: defineTable({
    type: v.union(v.literal("telegram"), v.literal("email")),
    recipient: v.string(), // chat_id for telegram, email for email
    message: v.string(),
    thread_id: v.optional(v.id("threads")),
    project_id: v.optional(v.id("projects")),
    sent_at: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("sent"), v.literal("failed")),
    created_at: v.string(),
  }).index("by_status", ["status"]).index("by_created_at", ["created_at"]),
});