import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ArrowLeft, Plus, MessageCircle, Clock, CheckCircle, AlertTriangle, MoreHorizontal, Trash2, Archive, ArchiveRestore, Sun, Moon, Folder, FileText, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import DeleteProjectModal from './DeleteProjectModal';
import ProjectFilesView from './ProjectFilesView';

interface Thread {
  _id: string;
  title: string;
  status: string;
  priority: string;
  created_by: string;
  last_activity: string;
  unread_count: number;
  last_message?: {
    content: string;
    author: string;
    created_at: string;
  };
  created_at: string;
  is_archived?: boolean;
}

interface ProjectViewProps {
  projectId: string;
  onBack: () => void;
  onThreadSelect: (threadId: string) => void;
  onNewThread: () => void;
  onProjectDeleted?: () => void;
  userRole?: 'client' | 'developer';
  initialTab?: 'conversations' | 'files' | 'archive';
}

const ProjectView: React.FC<ProjectViewProps> = ({
  projectId,
  onBack,
  onThreadSelect,
  onNewThread,
  onProjectDeleted,
  userRole = 'client',
  initialTab = 'conversations'
}) => {
  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<'conversations' | 'files' | 'archive'>(initialTab);
  const [showThreadDropdown, setShowThreadDropdown] = useState<string | null>(null);

  const project = useQuery(api.projects.getProject, 
    projectId ? { project_id: projectId as any } : "skip"
  );
  
  const deleteProject = useMutation(api.projects.deleteProject);
  const toggleProjectArchive = useMutation(api.projects.toggleProjectArchive);
  const deleteThread = useMutation(api.threads.deleteThread);
  const toggleThreadArchive = useMutation(api.threads.toggleThreadArchive);

  const allThreads = useQuery(api.threads.getProjectThreads, 
    projectId ? {
      project_id: projectId as any,
      viewer: "client"
    } : "skip"
  ) || [];

  // Filter threads based on active tab
  const threads = activeTab === 'archive' 
    ? allThreads.filter(thread => thread.is_archived)
    : allThreads.filter(thread => !thread.is_archived);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showThreadDropdown && !target.closest('.thread-dropdown')) {
        setShowThreadDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showThreadDropdown]);

  const handleThreadClick = (threadId: string) => {
    setSelectedThread(threadId);
    onThreadSelect(threadId);
  };

  const handleDeleteProject = async () => {
    setIsDeleting(true);
    try {
      await deleteProject({ project_id: projectId as any });
      
      toast({
        title: t('platform.project.delete.success'),
      });
      
      setShowDeleteModal(false);
      if (onProjectDeleted) {
        onProjectDeleted();
      } else {
        onBack();
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({
        title: t('platform.project.delete.error'),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleArchiveProject = async () => {
    if (!project) return;
    
    try {
      await toggleProjectArchive({ 
        project_id: projectId as any, 
        archived: !project.is_archived 
      });
      
      toast({
        title: project.is_archived 
          ? t('platform.project.unarchive.success')
          : t('platform.project.archive.success'),
      });
      
      // Go back to dashboard after archiving/unarchiving
      onBack();
    } catch (error) {
      console.error('Error archiving project:', error);
      toast({
        title: t('platform.project.archive.error'),
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      new: 'text-blue-600 bg-blue-100',
      acknowledged: 'text-purple-600 bg-purple-100',
      in_progress: 'text-orange-600 bg-orange-100',
      resolved: 'text-green-600 bg-green-100',
      closed: 'text-gray-600 bg-gray-100'
    };
    return colors[status] || colors.new;
  };

  const getStatusText = (status: string) => {
    const statusMap = {
      new: t('platform.thread_status.new'),
      acknowledged: t('platform.thread_status.acknowledged'), 
      in_progress: t('platform.thread_status.in_progress'),
      resolved: t('platform.thread_status.resolved'),
      closed: t('platform.thread_status.closed')
    };
    return statusMap[status] || status;
  };

  const getPriorityIcon = (priority: string) => {
    return priority === 'urgent' ? (
      <AlertTriangle className="w-4 h-4 text-red-500" />
    ) : null;
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'Hace menos de 1 hora';
    } else if (diffInHours < 24) {
      return `Hace ${diffInHours} hora${diffInHours > 1 ? 's' : ''}`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `Hace ${diffInDays} día${diffInDays > 1 ? 's' : ''}`;
    }
  };

  const getCreatedByName = (createdBy: string, currentUserRole: string) => {
    // If current user created it, show "You" or "Tú"
    if (createdBy === currentUserRole) {
      return t('platform.author.you');
    }
    
    // Otherwise show the person's name
    if (createdBy === 'client') {
      return 'Willy';
    } else {
      return 'Justin';
    }
  };

  const getMessageAuthorName = (messageAuthor: string, currentUserRole: string) => {
    // If current user wrote the message, show "You" or "Tú"
    if (messageAuthor === currentUserRole) {
      return t('platform.author.you');
    }
    
    // Otherwise show the person's name
    if (messageAuthor === 'client') {
      return 'Willy';
    } else {
      return 'Justin';
    }
  };

  const handleViewProjectFiles = () => {
    console.log('handleViewProjectFiles called');
    setActiveTab('files');
    setShowThreadDropdown(null);
  };

  const handleDeleteConversation = async (threadId: string) => {
    try {
      await deleteThread({ thread_id: threadId as any });
      
      toast({
        title: t('platform.thread.delete.success'),
        description: t('platform.thread.delete.description'),
      });
      
      setShowThreadDropdown(null);
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast({
        title: t('platform.thread.delete.error'),
        variant: "destructive",
      });
    }
  };

  const handleArchiveConversation = async (threadId: string, isArchived: boolean) => {
    console.log('handleArchiveConversation called', threadId, isArchived);
    try {
      await toggleThreadArchive({ 
        thread_id: threadId as any,
        archived: !isArchived
      });
      
      toast({
        title: isArchived 
          ? t('platform.thread.restore.success')
          : t('platform.thread.archive.success'),
      });
      
      setShowThreadDropdown(null);
    } catch (error) {
      console.error('Error toggling conversation archive:', error);
      toast({
        title: t('platform.thread.archive.error'),
        variant: "destructive",
      });
    }
  };

  if (!project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 transition-colors duration-200">
      <div className="px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        {/* Mobile-optimized Header */}
        <div className="space-y-4 mb-4 sm:mb-6">
          {/* Top row: Back button and action buttons */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="p-2"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>

            <div className="flex items-center space-x-1 sm:space-x-2">
              {/* Theme toggle */}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={toggleTheme}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />
                ) : (
                  <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleArchiveProject}
                className="text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500 p-2"
                title={project?.is_archived ? t('platform.project.unarchive') : t('platform.project.archive')}
              >
                {project?.is_archived ? (
                  <ArchiveRestore className="w-4 h-4" />
                ) : (
                  <Archive className="w-4 h-4" />
                )}
              </Button>

              {/* Delete button - only show for developers */}
              {userRole === 'developer' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteModal(true)}
                  className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-500 p-2"
                  title={t('platform.project.delete')}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Project info row */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div 
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center text-lg sm:text-xl flex-shrink-0"
              style={{ backgroundColor: project.color + '20' }}
            >
              {project.icon}
            </div>
            
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
                {project.name}
              </h1>
              <div className="flex items-center space-x-2 mt-1">
                <Badge className={`text-xs ${getStatusColor(project.status)}`}>
                  {getStatusText(project.status)}
                </Badge>
                {project.client && (
                  <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">
                    • {project.client.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* New conversation button */}
          <Button
            onClick={onNewThread}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-sm sm:text-base py-2.5 sm:py-2"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('platform.project.new_conversation')}
          </Button>
        </div>

        {/* Project Description */}
        {project.description && (
          <Card className="mb-4 sm:mb-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="p-3 sm:p-4">
              <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300">{project.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Compact Project Stats */}
        <div className="grid grid-cols-3 sm:grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="p-2 sm:p-4">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="p-1.5 sm:p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <MessageCircle className="w-3 h-3 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{t('platform.stats.total_conversations')}</p>
                  <p className="text-base sm:text-xl font-semibold text-gray-900 dark:text-white">{project.thread_count}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="p-2 sm:p-4">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="p-1.5 sm:p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <CheckCircle className="w-3 h-3 sm:w-5 sm:h-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{t('platform.stats.active_conversations')}</p>
                  <p className="text-base sm:text-xl font-semibold text-gray-900 dark:text-white">{project.active_threads}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="p-2 sm:p-4">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="p-1.5 sm:p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                  <Clock className="w-3 h-3 sm:w-5 sm:h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{t('platform.stats.unread_messages')}</p>
                  <p className="text-base sm:text-xl font-semibold text-gray-900 dark:text-white">{project.unread_count}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mobile-optimized Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-4 sm:mb-6">
          <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto">
            <button
              onClick={() => setActiveTab('conversations')}
              className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors flex-shrink-0 ${
                activeTab === 'conversations'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-xs sm:text-sm">{t('platform.project.conversations')}</span>
              {allThreads.filter(t => !t.is_archived).length > 0 && (
                <span className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 ml-1 sm:ml-2 py-0.5 px-1.5 sm:px-2 rounded-full text-xs">
                  {allThreads.filter(t => !t.is_archived).length}
                </span>
              )}
            </button>
            
            <button
              onClick={() => setActiveTab('archive')}
              className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors flex-shrink-0 ${
                activeTab === 'archive'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <Archive className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-xs sm:text-sm">{t('platform.project.archived_conversations')}</span>
              {allThreads.filter(t => t.is_archived).length > 0 && (
                <span className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 ml-1 sm:ml-2 py-0.5 px-1.5 sm:px-2 rounded-full text-xs">
                  {allThreads.filter(t => t.is_archived).length}
                </span>
              )}
            </button>
            
            <button
              onClick={() => setActiveTab('files')}
              className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors flex-shrink-0 ${
                activeTab === 'files'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <Folder className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-xs sm:text-sm">{t('platform.files.title')}</span>
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {(activeTab === 'conversations' || activeTab === 'archive') && (
        <div className="space-y-3 sm:space-y-4">
          {threads.map((thread: Thread) => (
            <Card 
              key={thread._id}
              className={`bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 cursor-pointer transition-all duration-200 hover:shadow-md dark:hover:shadow-gray-900/20 ${
                selectedThread === thread._id ? 'ring-2 ring-blue-500 shadow-lg' : ''
              } ${thread.unread_count > 0 ? 'border-l-4 border-l-orange-400' : ''}`}
              onClick={() => handleThreadClick(thread._id)}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start space-x-2 mb-2">
                      {getPriorityIcon(thread.priority)}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base line-clamp-2 leading-tight">
                          {thread.title}
                        </h3>
                        <div className="mt-1">
                          <Badge className={`text-xs ${getStatusColor(thread.status)}`}>
                            {getStatusText(thread.status)}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {thread.last_message && (
                      <div className="mb-2">
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                          <span className="font-medium">
                            {getMessageAuthorName(thread.last_message.author, userRole)}:
                          </span>
                          {' '}{thread.last_message.content}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span className="truncate">
                        {t('platform.thread.created_by')} {getCreatedByName(thread.created_by, userRole)}
                      </span>
                      <span className="ml-2 flex-shrink-0">{formatRelativeTime(thread.last_activity)}</span>
                    </div>
                  </div>

                  <div className="flex items-start space-x-2 ml-3 sm:ml-4 flex-shrink-0">
                    {thread.unread_count > 0 && (
                      <div className="bg-orange-500 text-white text-xs font-medium px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
                        {thread.unread_count}
                      </div>
                    )}
                    
                    {/* Thread actions dropdown */}
                    <div className="relative thread-dropdown">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('Dropdown clicked for thread:', thread._id);
                          setShowThreadDropdown(showThreadDropdown === thread._id ? null : thread._id);
                        }}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <MoreHorizontal className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 dark:text-gray-500" />
                      </button>
                      
                      {showThreadDropdown === thread._id && (
                        <div 
                          className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-[60]"
                          onClick={(e) => console.log('Dropdown menu clicked')}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewProjectFiles();
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                          >
                            <Folder className="w-4 h-4" />
                            <span>{t('platform.thread.see_project_files')}</span>
                          </button>
                          
                          <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleArchiveConversation(thread._id, thread.is_archived || false);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                          >
                            {thread.is_archived ? (
                              <>
                                <ArchiveRestore className="w-4 h-4" />
                                <span>{t('platform.thread.restore')}</span>
                              </>
                            ) : (
                              <>
                                <Archive className="w-4 h-4" />
                                <span>{t('platform.thread.archive')}</span>
                              </>
                            )}
                          </button>
                          
                          {/* Delete option - only show for developers */}
                          {userRole === 'developer' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteConversation(thread._id);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>{t('platform.thread.delete')}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Compact New Conversation Card - only show in conversations tab */}
          {activeTab === 'conversations' && (
            <Card 
              className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 cursor-pointer transition-all duration-200 hover:shadow-md dark:hover:shadow-gray-900/20 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500"
              onClick={onNewThread}
            >
              <CardContent className="p-4 sm:p-6 flex items-center justify-center text-center space-x-2 sm:space-x-3">
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 dark:text-gray-500" />
                </div>
                <span className="text-sm sm:text-base text-gray-600 dark:text-gray-300 font-medium">
                  {t('platform.project.start_new_conversation')}
                </span>
              </CardContent>
            </Card>
          )}

          {/* Compact Empty State */}
          {threads.length === 0 && (
            <div className="text-center py-8 sm:py-12 px-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-3 sm:mb-4">
                {activeTab === 'archive' ? (
                  <Archive className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400 dark:text-gray-500" />
                ) : (
                  <MessageCircle className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400 dark:text-gray-500" />
                )}
              </div>
              <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-2">
                {activeTab === 'archive' ? t('platform.project.no_archived_conversations') : t('platform.project.no_conversations')}
              </h3>
              <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mb-4 sm:mb-6">
                {activeTab === 'archive' ? t('platform.project.no_archived_conversations_subtitle') : t('platform.project.no_conversations_subtitle')}
              </p>
              {activeTab === 'conversations' && (
                <Button onClick={onNewThread} className="bg-blue-600 hover:bg-blue-700 text-sm sm:text-base px-4 py-2">
                  <Plus className="w-4 h-4 mr-2" />
                  {t('platform.project.start_first_conversation')}
                </Button>
              )}
            </div>
          )}
        </div>
        )}

        {/* Files Tab */}
        {activeTab === 'files' && (
          <ProjectFilesView 
            projectId={projectId} 
            userRole={userRole}
          />
        )}
      </div>
      </div>
      
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <DeleteProjectModal
          projectName={project.name}
          onConfirm={handleDeleteProject}
          onCancel={() => setShowDeleteModal(false)}
          isDeleting={isDeleting}
        />
      )}
    </>
  );
};

export default ProjectView;