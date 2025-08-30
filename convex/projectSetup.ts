import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

// Setup default folders for a project
export const setupDefaultFolders = mutation({
  args: {
    project_id: v.id("projects"),
    created_by: v.union(v.literal("client"), v.literal("developer")),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    
    // Check if default folders already exist
    const existingFolders = await ctx.db
      .query("project_folders")
      .withIndex("by_project", (q) => q.eq("project_id", args.project_id))
      .collect();

    if (existingFolders.length > 0) {
      return { message: "Default folders already exist", foldersCreated: 0 };
    }

    // Create default folders
    const defaultFolders = [
      {
        name: "Images",
        name_es: "Imágenes", 
        icon: "🖼️",
        color: "#10B981", // Green
      },
      {
        name: "Documents", 
        name_es: "Documentos",
        icon: "📄",
        color: "#3B82F6", // Blue
      },
      {
        name: "PDFs",
        name_es: "PDFs", 
        icon: "📑",
        color: "#EF4444", // Red
      },
      {
        name: "Other",
        name_es: "Otros",
        icon: "📁",
        color: "#6B7280", // Gray
      }
    ];

    const createdFolders = [];
    
    for (const folder of defaultFolders) {
      const folderId = await ctx.db.insert("project_folders", {
        project_id: args.project_id,
        name: folder.name, // Always use English for consistency
        icon: folder.icon,
        color: folder.color,
        created_by: args.created_by,
        created_at: now,
      });
      
      createdFolders.push({
        id: folderId,
        name: folder.name,
        icon: folder.icon,
        color: folder.color,
      });
    }

    return {
      message: "Default folders created successfully",
      foldersCreated: createdFolders.length,
      folders: createdFolders,
    };
  },
});

// Auto-organize files into appropriate default folders
export const autoOrganizeProjectFiles = mutation({
  args: {
    project_id: v.id("projects"),
  },
  handler: async (ctx, args) => {
    // Get all folders for this project
    const folders = await ctx.db
      .query("project_folders")
      .withIndex("by_project", (q) => q.eq("project_id", args.project_id))
      .collect();

    // Create folder mapping
    const folderMap: Record<string, string> = {};
    folders.forEach(folder => {
      if (folder.name === "Images") folderMap.images = folder._id;
      else if (folder.name === "Documents") folderMap.documents = folder._id;  
      else if (folder.name === "PDFs") folderMap.pdfs = folder._id;
      else if (folder.name === "Other") folderMap.other = folder._id;
    });

    // Get all unorganized files (those without folder_id)
    const unorganizedFiles = await ctx.db
      .query("project_files")
      .withIndex("by_project", (q) => q.eq("project_id", args.project_id))
      .filter((q) => q.eq(q.field("folder_id"), undefined))
      .collect();

    let organizedCount = 0;

    for (const file of unorganizedFiles) {
      let targetFolderId = folderMap.other; // Default to "Other"

      // Determine appropriate folder based on file type
      if (file.file_type.startsWith('image/')) {
        targetFolderId = folderMap.images || folderMap.other;
      } else if (file.file_type === 'application/pdf') {
        targetFolderId = folderMap.pdfs || folderMap.other;
      } else if (
        file.file_type.includes('document') ||
        file.file_type.includes('text') ||
        file.file_type.includes('word') ||
        file.file_type.includes('excel') ||
        file.file_type.includes('powerpoint')
      ) {
        targetFolderId = folderMap.documents || folderMap.other;
      }

      // Move file to appropriate folder
      await ctx.db.patch(file._id, {
        folder_id: targetFolderId as any,
        moved_at: new Date().toISOString(),
      });

      organizedCount++;
    }

    return {
      message: "Files organized successfully",
      filesOrganized: organizedCount,
    };
  },
});

// Complete project file system setup
export const setupProjectFileSystem = mutation({
  args: {
    project_id: v.id("projects"),
    created_by: v.union(v.literal("client"), v.literal("developer")),
  },
  handler: async (ctx, args): Promise<any> => {
    // Step 1: Create default folders
    const foldersResult: any = await ctx.runMutation(api.projectSetup.setupDefaultFolders, {
      project_id: args.project_id,
      created_by: args.created_by,
    });

    // Step 2: Sync files from messages  
    const syncResult: any = await ctx.runMutation(api.projectFiles.syncMessageFilesToProject, {
      project_id: args.project_id,
    });

    // Step 3: Auto-organize files into folders
    const organizeResult: any = await ctx.runMutation(api.projectSetup.autoOrganizeProjectFiles, {
      project_id: args.project_id,
    });

    return {
      success: true,
      foldersCreated: foldersResult.foldersCreated,
      filesSynced: syncResult.syncedCount,
      filesOrganized: organizeResult.filesOrganized,
      summary: `Created ${foldersResult.foldersCreated} folders, synced ${syncResult.syncedCount} files from conversations, and organized ${organizeResult.filesOrganized} files`,
    };
  },
});

// Check if project file system is already setup
export const checkProjectSetup = query({
  args: {
    project_id: v.id("projects"),
  },
  handler: async (ctx, args) => {
    // Check if default folders exist
    const folders = await ctx.db
      .query("project_folders") 
      .withIndex("by_project", (q) => q.eq("project_id", args.project_id))
      .collect();

    // Check if any project files exist
    const projectFiles = await ctx.db
      .query("project_files")
      .withIndex("by_project", (q) => q.eq("project_id", args.project_id))
      .collect();

    const hasDefaultFolders = folders.length >= 3; // At least 3 default folders
    const hasProjectFiles = projectFiles.length > 0;
    
    return {
      isSetup: hasDefaultFolders,
      foldersCount: folders.length,
      filesCount: projectFiles.length,
      needsSetup: !hasDefaultFolders || (!hasProjectFiles && folders.length > 0),
    };
  },
});