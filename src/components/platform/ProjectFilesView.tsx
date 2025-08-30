import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { 
  Folder, 
  FolderPlus, 
  Upload, 
  Search, 
  Filter,
  Grid3X3,
  List,
  Trash2,
  Tag,
  FileImage,
  FileText,
  File,
  FolderOpen,
  ArrowLeft
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileUpload } from '@/components/ui/file-upload';
import CreateFolderModal from './CreateFolderModal';

interface ProjectFilesViewProps {
  projectId: string;
  userRole?: 'client' | 'developer';
}

interface Folder {
  _id: string;
  name: string;
  color?: string;
  icon?: string;
  file_count: number;
  created_at: string;
  parent_folder_id?: string;
}

interface ProjectFile {
  _id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url?: string;
  tags: string[];
  uploaded_by: string;
  uploaded_at: string;
  folder_id?: string;
  messageContext?: {
    thread_title?: string;
    author: string;
    created_at: string;
  };
}

const ProjectFilesView: React.FC<ProjectFilesViewProps> = ({
  projectId,
  userRole = 'client'
}) => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { toast } = useToast();
  
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('');
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  // Queries
  const projectSetup = useQuery(api.projectSetup.checkProjectSetup, {
    project_id: projectId as any,
  });
  
  const folders = useQuery(api.projectFiles.getProjectFolders, {
    project_id: projectId as any,
    parent_folder_id: currentFolderId as any,
  }) || [];

  const allFolders = useQuery(api.projectFiles.getProjectFolders, {
    project_id: projectId as any,
    parent_folder_id: undefined, // Get all top-level folders
  }) || [];

  const files = useQuery(api.projectFiles.getProjectFiles, {
    project_id: projectId as any,
    folder_id: currentFolderId as any,
    search: searchTerm || undefined,
    file_type_filter: fileTypeFilter || undefined,
  }) || [];


  const fileStats = useQuery(api.projectFiles.getProjectFileStats, {
    project_id: projectId as any,
  });


  // Mutations
  const createFolder = useMutation(api.projectFiles.createFolder);
  const moveFileToFolder = useMutation(api.projectFiles.moveFileToFolder);
  const deleteFile = useMutation(api.projectFiles.deleteFileFromProject);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const addFileToProject = useMutation(api.projectFiles.addFileToProject);
  const setupProjectFileSystem = useMutation(api.projectSetup.setupProjectFileSystem);

  // Auto-setup project file system when first accessed
  useEffect(() => {
    if (projectSetup && projectSetup.needsSetup) {
      setupProjectFileSystem({
        project_id: projectId as any,
        created_by: userRole,
      }).catch((error) => {
        console.error("Failed to setup project file system:", error);
      });
    }
  }, [projectSetup, projectId, userRole, setupProjectFileSystem]);

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <FileImage className="w-8 h-8 text-green-600 dark:text-green-400" />;
    } else if (fileType.includes('pdf')) {
      return <FileText className="w-8 h-8 text-red-600 dark:text-red-400" />;
    } else if (fileType.includes('document') || fileType.includes('application/')) {
      return <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />;
    }
    return <File className="w-8 h-8 text-gray-500 dark:text-gray-400" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleCreateFolder = async (name: string, color: string, icon: string) => {
    try {
      await createFolder({
        project_id: projectId as any,
        name,
        parent_folder_id: currentFolderId as any,
        color,
        icon,
        created_by: userRole,
      });
      
      toast({
        title: t('platform.files.folder_created'),
      });
      
      setShowNewFolderModal(false);
    } catch (error) {
      toast({
        title: t('platform.files.folder_create_error'),
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      // Get upload URL
      const uploadUrl = await generateUploadUrl();
      
      // Upload file to Convex storage
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: file,
      });
      
      if (!response.ok) throw new Error('Upload failed');
      
      const { storageId } = await response.json();
      
      // Add to project files
      await addFileToProject({
        project_id: projectId as any,
        folder_id: currentFolderId as any,
        file_id: storageId,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        uploaded_by: userRole,
      });
      
      toast({
        title: t('platform.files.file_uploaded'),
      });
    } catch (error) {
      toast({
        title: t('platform.files.upload_error'),
        variant: "destructive",
      });
    }
  };


  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, fileId: string) => {
    setDraggedFileId(fileId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', fileId);
  };

  const handleDragEnd = () => {
    setDraggedFileId(null);
    setDragOverFolderId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (folderId: string | undefined) => {
    setDragOverFolderId(folderId || 'root');
  };

  const handleDragLeave = () => {
    setDragOverFolderId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetFolderId: string | undefined) => {
    e.preventDefault();
    const fileId = e.dataTransfer.getData('text/plain');
    
    if (fileId && draggedFileId) {
      try {
        await moveFileToFolder({
          file_id: fileId,
          folder_id: targetFolderId,
        });
        
        toast({
          title: t('platform.files.file_moved'),
          description: t('platform.files.file_moved_success'),
        });
      } catch (error) {
        toast({
          title: t('platform.files.move_error'),
          variant: "destructive",
        });
      }
    }
    
    setDraggedFileId(null);
    setDragOverFolderId(null);
  };

  const breadcrumbs = [
    { name: t('platform.files.all_files'), id: undefined }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('platform.files.title')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {t('platform.files.subtitle')}
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowNewFolderModal(true)}
          >
            <FolderPlus className="w-4 h-4 mr-2" />
            {t('platform.files.new_folder')}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {fileStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <File className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('platform.files.total_files')}
                  </p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">
                    {fileStats.totalFiles}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <Upload className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('platform.files.total_size')}
                  </p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">
                    {formatFileSize(fileStats.totalSize)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                  <Folder className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('platform.files.folders')}
                  </p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">
                    {folders.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <FileImage className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('platform.files.recent_files')}
                  </p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">
                    {fileStats.recentFiles}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Mobile-Optimized Controls */}
      <div className="space-y-4">
        {/* Search and Upload Row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('platform.files.search_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-[44px] pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex items-center space-x-2 flex-shrink-0">
            <FileUpload onFileSelect={handleFileUpload} />
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="h-[44px] w-[44px] rounded-xl"
            >
              {viewMode === 'grid' ? <List className="w-5 h-5" /> : <Grid3X3 className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Filter Row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={fileTypeFilter}
            onChange={(e) => setFileTypeFilter(e.target.value)}
            className="h-[44px] px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 flex-1 sm:flex-none sm:w-48"
          >
            <option value="">{t('platform.files.all_types')}</option>
            <option value="image/">{t('platform.files.images')}</option>
            <option value="application/pdf">{t('platform.files.pdfs')}</option>
            <option value="application/">{t('platform.files.documents')}</option>
            <option value="text/">{t('platform.files.text_files')}</option>
          </select>
        </div>
      </div>

      {/* Breadcrumb Navigation */}
      {currentFolderId && (
        <div className="flex items-center space-x-2 py-3 px-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <FolderOpen className="w-5 h-5 text-blue-600" />
          <span className="text-blue-800 dark:text-blue-200 font-medium">
            {allFolders.find(f => f._id === currentFolderId)?.name || 'Folder'}
          </span>
          
          {/* Root Drop Zone */}
          <div 
            className={`flex items-center space-x-2 ml-auto px-3 py-2 rounded-lg border-2 border-dashed transition-all ${
              dragOverFolderId === 'root' 
                ? 'border-green-400 bg-green-50 dark:bg-green-900/20' 
                : draggedFileId 
                  ? 'border-gray-300 bg-gray-50 dark:bg-gray-800 opacity-70' 
                  : 'border-transparent'
            }`}
            onDragOver={handleDragOver}
            onDragEnter={() => handleDragEnter(undefined)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, undefined)}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentFolderId(undefined)}
              className="flex items-center space-x-1 text-blue-600 hover:text-blue-800"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{dragOverFolderId === 'root' ? t('platform.files.drop_to_root') : t('platform.files.back_to_all')}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Folders */}
      {folders.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('platform.files.folders')}
          </h3>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {folders.map((folder) => (
              <Card
                key={folder._id}
                className={`bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-md dark:hover:shadow-gray-900/20 transition-all active:scale-95 min-h-[100px] flex items-center border-2 ${
                  dragOverFolderId === folder._id 
                    ? 'border-dashed border-green-400 bg-green-50 dark:bg-green-900/20' 
                    : draggedFileId 
                      ? 'border-dashed border-gray-300 bg-gray-50 dark:bg-gray-800 opacity-70' 
                      : 'border-solid'
                }`}
                onClick={() => setCurrentFolderId(folder._id)}
                onDragOver={handleDragOver}
                onDragEnter={() => handleDragEnter(folder._id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, folder._id)}
              >
                <CardContent className="p-4 text-center w-full">
                  <div className="text-3xl mb-2" style={{ color: folder.color }}>
                    {folder.icon}
                  </div>
                  <h4 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                    {folder.name}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {folder.file_count} {t('platform.files.files')}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Files */}
      <div 
        className={`space-y-4 ${
          dragOverFolderId === 'root' ? 'bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border-2 border-dashed border-blue-300' : ''
        }`}
        onDragOver={handleDragOver}
        onDragEnter={() => handleDragEnter(undefined)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, undefined)}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('platform.files.files')} {dragOverFolderId === 'root' && '(Drop here to move to root)'}
          </h3>
          {files.length > 0 && !draggedFileId && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('platform.files.drag_hint')}
            </p>
          )}
        </div>
        
        {files.length === 0 ? (
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="p-8 text-center">
              <File className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {t('platform.files.no_files')}
              </h4>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {t('platform.files.no_files_description')}
              </p>
              <FileUpload onFileSelect={handleFileUpload} />
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {files.map((file) => (
              <Card
                key={file._id}
                className={`bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-md dark:hover:shadow-gray-900/20 transition-all group active:scale-95 h-[200px] cursor-pointer ${
                  draggedFileId === file._id ? 'opacity-50 scale-95' : ''
                }`}
                draggable
                onDragStart={(e) => handleDragStart(e, file._id)}
                onDragEnd={handleDragEnd}
                onClick={() => {
                  if (file.file_url && !draggedFileId) {
                    window.open(file.file_url, '_blank');
                  }
                }}
              >
                <CardContent className="p-3">
                  <div className="flex flex-col h-full">
                    {/* Enhanced File icon/image */}
                    <div className="flex justify-center mb-3">
                      {file.file_type.startsWith('image/') && file.file_url ? (
                        <img
                          src={file.file_url}
                          alt={file.file_name}
                          className="w-24 h-24 object-cover rounded-xl shadow-sm hover:shadow-md transition-shadow"
                        />
                      ) : (
                        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center shadow-sm">
                          {getFileIcon(file.file_type)}
                        </div>
                      )}
                    </div>
                    
                    {/* File info */}
                    <div className="flex-1 flex flex-col justify-between text-center min-h-0">
                      <div className="mb-2">
                        <h4 
                          className="font-medium text-gray-900 dark:text-white text-xs leading-tight mb-1 line-clamp-2 break-all" 
                          title={file.file_name}
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            wordBreak: 'break-all',
                            hyphens: 'auto'
                          }}
                        >
                          {file.file_name}
                        </h4>
                        
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatFileSize(file.file_size)}
                        </p>
                      </div>
                      
                      {/* Badge at bottom */}
                      {file.messageContext && (
                        <Badge variant="outline" className="text-xs mx-auto w-fit">
                          {t('platform.files.from_chat')}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {files.map((file) => (
              <Card
                key={file._id}
                className={`bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-md dark:hover:shadow-gray-900/20 transition-all active:scale-[0.98] cursor-pointer group ${
                  draggedFileId === file._id ? 'opacity-50 scale-95' : ''
                }`}
                draggable
                onDragStart={(e) => handleDragStart(e, file._id)}
                onDragEnd={handleDragEnd}
                onClick={() => {
                  if (file.file_url && !draggedFileId) {
                    window.open(file.file_url, '_blank');
                  }
                }}
              >
                <CardContent className="p-4 relative">
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    {file.file_type.startsWith('image/') && file.file_url ? (
                      <img
                        src={file.file_url}
                        alt={file.file_name}
                        className="w-12 h-12 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                        {getFileIcon(file.file_type)}
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">
                        {file.file_name}
                      </h4>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-1 sm:space-y-0 text-sm text-gray-500 dark:text-gray-400">
                        <span>{formatFileSize(file.file_size)}</span>
                        <span className="hidden sm:inline">{new Date(file.uploaded_at).toLocaleDateString()}</span>
                        <span className="sm:hidden text-xs">{new Date(file.uploaded_at).toLocaleDateString()}</span>
                        {file.messageContext && (
                          <Badge variant="outline" className="text-xs self-start sm:self-auto">
                            {file.messageContext.thread_title}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {file.file_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(file.file_url, '_blank');
                          }}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>


      {/* Create Folder Modal */}
      <CreateFolderModal
        isOpen={showNewFolderModal}
        onClose={() => setShowNewFolderModal(false)}
        onConfirm={handleCreateFolder}
      />
    </div>
  );
};

export default ProjectFilesView;