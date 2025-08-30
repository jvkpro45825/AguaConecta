import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

// Get all files for a project with folder structure
export const getProjectFiles = query({
  args: { 
    project_id: v.id("projects"),
    folder_id: v.optional(v.id("project_folders")), // null for root files
    search: v.optional(v.string()),
    file_type_filter: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let filesQuery = ctx.db
      .query("project_files")
      .withIndex("by_project", (q) => q.eq("project_id", args.project_id));

    const allProjectFiles = await filesQuery.collect();
    
    // Filter by folder
    let filteredFiles = allProjectFiles.filter(file => {
      if (args.folder_id === undefined) {
        return file.folder_id === undefined; // Root level files
      }
      return file.folder_id === args.folder_id;
    });

    // Filter by file type if specified
    if (args.file_type_filter) {
      filteredFiles = filteredFiles.filter(file => 
        file.file_type.toLowerCase().includes(args.file_type_filter!.toLowerCase())
      );
    }

    // Filter by search term if specified
    if (args.search) {
      const searchTerm = args.search.toLowerCase();
      filteredFiles = filteredFiles.filter(file =>
        file.file_name.toLowerCase().includes(searchTerm) ||
        file.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      );
    }

    // Add file URLs and context info
    const filesWithContext = await Promise.all(
      filteredFiles.map(async (file) => {
        let messageContext = null;
        if (file.message_id) {
          const message = await ctx.db.get(file.message_id);
          if (message) {
            const thread = await ctx.db.get(message.thread_id);
            messageContext = {
              thread_title: thread?.title,
              author: message.author,
              created_at: message.created_at,
            };
          }
        }

        // Get fresh file URL from storage
        const file_url = await ctx.storage.getUrl(file.file_id);

        return {
          ...file,
          file_url,
          messageContext,
        };
      })
    );

    return filesWithContext.sort((a, b) => 
      new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
    );
  },
});

// Get folder structure for a project
export const getProjectFolders = query({
  args: { 
    project_id: v.id("projects"),
    parent_folder_id: v.optional(v.id("project_folders")),
  },
  handler: async (ctx, args) => {
    let foldersQuery = ctx.db
      .query("project_folders")
      .withIndex("by_project", (q) => q.eq("project_id", args.project_id));

    const allFolders = await foldersQuery.collect();
    
    // Filter by parent folder (for hierarchical structure)
    const filteredFolders = allFolders.filter(folder => {
      if (args.parent_folder_id === undefined) {
        return folder.parent_folder_id === undefined; // Root level folders
      }
      return folder.parent_folder_id === args.parent_folder_id;
    });

    // Add file counts for each folder
    const foldersWithCounts = await Promise.all(
      filteredFolders.map(async (folder) => {
        const folderFiles = await ctx.db
          .query("project_files")
          .withIndex("by_folder", (q) => q.eq("folder_id", folder._id))
          .collect();
        
        return {
          ...folder,
          file_count: folderFiles.length,
        };
      })
    );

    return foldersWithCounts.sort((a, b) => a.name.localeCompare(b.name));
  },
});

// Create a new folder
export const createFolder = mutation({
  args: {
    project_id: v.id("projects"),
    name: v.string(),
    parent_folder_id: v.optional(v.id("project_folders")),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    created_by: v.union(v.literal("client"), v.literal("developer")),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    
    const folderId = await ctx.db.insert("project_folders", {
      project_id: args.project_id,
      name: args.name,
      parent_folder_id: args.parent_folder_id,
      color: args.color || "#3B82F6",
      icon: args.icon || "📁",
      created_by: args.created_by,
      created_at: now,
    });

    return folderId;
  },
});

// Move file to different folder
export const moveFileToFolder = mutation({
  args: {
    file_id: v.id("project_files"),
    folder_id: v.optional(v.id("project_folders")),
  },
  handler: async (ctx, args) => {
    console.log("moveFile called with args:", args);
    
    const now = new Date().toISOString();
    
    // Simple patch without validation for now
    await ctx.db.patch(args.file_id, {
      folder_id: args.folder_id,
      moved_at: now,
    });

    console.log("moveFile completed successfully");
    return { success: true };
  },
});

// Simple test function to debug the issue
export const testMove = mutation({
  args: {
    file_id: v.string(),
    folder_id: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    console.log("testMove called with:", args);
    return { success: true, message: "Test function works" };
  },
});

// Add file to project (from upload or message sync)
// Helper function to auto-assign folder based on file type
const getAutoFolderId = async (ctx: any, projectId: any, fileType: string) => {
  // First ensure default folders exist
  try {
    await ctx.runMutation(api.projectSetup.setupDefaultFolders, {
      project_id: projectId,
      created_by: "client",
    });
  } catch (error) {
    // Ignore if folders already exist
  }

  const folders = await ctx.db
    .query("project_folders")
    .withIndex("by_project", (q: any) => q.eq("project_id", projectId))
    .collect();

  // Create folder mapping
  const folderMap: Record<string, string> = {};
  folders.forEach((folder: any) => {
    if (folder.name === "Images") folderMap.images = folder._id;
    else if (folder.name === "Documents") folderMap.documents = folder._id;  
    else if (folder.name === "PDFs") folderMap.pdfs = folder._id;
    else if (folder.name === "Other") folderMap.other = folder._id;
  });

  // Determine appropriate folder based on file type
  if (fileType.startsWith('image/')) {
    return folderMap.images || folderMap.other || folders[0]?._id;
  } else if (fileType === 'application/pdf') {
    return folderMap.pdfs || folderMap.other || folders[0]?._id;
  } else if (
    fileType.includes('document') ||
    fileType.includes('text') ||
    fileType.includes('word') ||
    fileType.includes('excel') ||
    fileType.includes('powerpoint')
  ) {
    return folderMap.documents || folderMap.other || folders[0]?._id;
  }
  
  return folderMap.other || folders[0]?._id; // Fallback to first available folder
};

export const addFileToProject = mutation({
  args: {
    project_id: v.id("projects"),
    folder_id: v.optional(v.id("project_folders")),
    file_id: v.id("_storage"),
    message_id: v.optional(v.id("messages")),
    file_name: v.string(),
    file_type: v.string(),
    file_size: v.number(),
    tags: v.optional(v.array(v.string())),
    uploaded_by: v.union(v.literal("client"), v.literal("developer")),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    
    // Get file URL from storage
    const file_url = await ctx.storage.getUrl(args.file_id);
    
    // If no folder_id specified, auto-assign based on file type
    let targetFolderId = args.folder_id;
    if (!targetFolderId) {
      targetFolderId = await getAutoFolderId(ctx, args.project_id, args.file_type);
    }
    
    const projectFileId = await ctx.db.insert("project_files", {
      project_id: args.project_id,
      folder_id: targetFolderId as any,
      file_id: args.file_id,
      message_id: args.message_id,
      file_name: args.file_name,
      file_type: args.file_type,
      file_size: args.file_size,
      file_url: file_url || undefined,
      tags: args.tags || [],
      uploaded_by: args.uploaded_by,
      uploaded_at: now,
    });

    return projectFileId;
  },
});

// Auto-organize all unorganized files in a project
export const autoOrganizeFiles = mutation({
  args: {
    project_id: v.id("projects"),
  },
  handler: async (ctx, args) => {
    // Get all unorganized files (those without folder_id)
    const unorganizedFiles = await ctx.db
      .query("project_files")
      .withIndex("by_project", (q) => q.eq("project_id", args.project_id))
      .filter((q) => q.eq(q.field("folder_id"), undefined))
      .collect();

    let organizedCount = 0;

    for (const file of unorganizedFiles) {
      const targetFolderId = await getAutoFolderId(ctx, args.project_id, file.file_type);
      
      if (targetFolderId) {
        await ctx.db.patch(file._id, {
          folder_id: targetFolderId as any,
          moved_at: new Date().toISOString(),
        });
        organizedCount++;
      }
    }

    return {
      message: "Files organized successfully",
      filesOrganized: organizedCount,
    };
  },
});

// Update file tags
export const updateFileTags = mutation({
  args: {
    file_id: v.id("project_files"),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.file_id, {
      tags: args.tags,
    });

    return { success: true };
  },
});

// Delete file from project (keeps in messages)
export const deleteFileFromProject = mutation({
  args: {
    file_id: v.id("project_files"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.file_id);
    return { success: true };
  },
});

// Get project file statistics
export const getProjectFileStats = query({
  args: { 
    project_id: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const projectFiles = await ctx.db
      .query("project_files")
      .withIndex("by_project", (q) => q.eq("project_id", args.project_id))
      .collect();

    const totalFiles = projectFiles.length;
    const totalSize = projectFiles.reduce((sum, file) => sum + file.file_size, 0);
    
    // Count by file type
    const fileTypes: Record<string, number> = {};
    projectFiles.forEach(file => {
      const baseType = file.file_type.split('/')[0]; // e.g., 'image' from 'image/jpeg'
      fileTypes[baseType] = (fileTypes[baseType] || 0) + 1;
    });

    // Recent files (last 7 days)
    const recentFiles = projectFiles.filter(file => {
      const fileDate = new Date(file.uploaded_at);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return fileDate > sevenDaysAgo;
    }).length;

    return {
      totalFiles,
      totalSize,
      fileTypes,
      recentFiles,
    };
  },
});

// Sync files from messages to project files (migration helper)
export const syncMessageFilesToProject = mutation({
  args: {
    project_id: v.id("projects"),
  },
  handler: async (ctx, args) => {
    // Get all threads for this project
    const threads = await ctx.db
      .query("threads")
      .withIndex("by_project", (q) => q.eq("project_id", args.project_id))
      .collect();

    let syncedCount = 0;

    for (const thread of threads) {
      // Get all file messages in this thread
      const fileMessages = await ctx.db
        .query("messages")
        .withIndex("by_thread", (q) => q.eq("thread_id", thread._id))
        .filter((q) => q.eq(q.field("message_type"), "file"))
        .collect();

      for (const message of fileMessages) {
        if (message.file_id) {
          // Check if file already exists in project files
          const existingFile = await ctx.db
            .query("project_files")
            .withIndex("by_message", (q) => q.eq("message_id", message._id))
            .first();

          if (!existingFile) {
            // Add to project files directly
            const file_url = await ctx.storage.getUrl(message.file_id);
            await ctx.db.insert("project_files", {
              project_id: args.project_id,
              folder_id: undefined, // Root level for synced files
              file_id: message.file_id,
              message_id: message._id,
              file_name: message.file_name!,
              file_type: message.file_type!,
              file_size: message.file_size!,
              file_url: file_url || undefined,
              tags: [],
              uploaded_by: message.author,
              uploaded_at: message.created_at,
            });
            syncedCount++;
          }
        }
      }
    }

    return { syncedCount };
  },
});


// Search files across project
export const searchProjectFiles = query({
  args: {
    project_id: v.id("projects"),
    search_term: v.string(),
    file_type_filter: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const projectFiles = await ctx.db
      .query("project_files")
      .withIndex("by_project", (q) => q.eq("project_id", args.project_id))
      .collect();

    const searchTerm = args.search_term.toLowerCase();
    let filteredFiles = projectFiles.filter(file =>
      file.file_name.toLowerCase().includes(searchTerm) ||
      file.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    );

    if (args.file_type_filter) {
      filteredFiles = filteredFiles.filter(file =>
        file.file_type.toLowerCase().includes(args.file_type_filter!.toLowerCase())
      );
    }

    return filteredFiles.sort((a, b) =>
      new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
    );
  },
});