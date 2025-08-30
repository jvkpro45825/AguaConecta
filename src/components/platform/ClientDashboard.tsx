import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Plus, MessageCircle, Clock, CheckCircle, AlertCircle, Folder, ArrowRight, Archive, Sun, Moon, MoreHorizontal, Trash2, ArchiveRestore, Play, Pause, Eye, RotateCcw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import LanguageToggle from '../LanguageToggle';

interface Project {
  _id: string;
  name: string;
  type: string;
  status: string;
  priority: string;
  icon: string;
  color: string;
  description?: string;
  unread_count: number;
  active_threads: number;
  total_threads: number;
  updated_at: string;
  archived?: boolean;
}

interface ClientDashboardProps {
  clientId: string;
  onProjectSelect: (projectId: string) => void;
  onNewProject: () => void;
  userRole?: 'client' | 'developer';
}

const ClientDashboard: React.FC<ClientDashboardProps> = ({ 
  clientId, 
  onProjectSelect, 
  onNewProject,
  userRole = 'client'
}) => {
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showDropdown, setShowDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Set language based on user role
  useEffect(() => {
    if (userRole === 'client' && language === 'en') {
      setLanguage('es'); // Client defaults to Spanish
    } else if (userRole === 'developer' && language === 'es') {
      setLanguage('en'); // Developer defaults to English
    }
  }, [userRole]);

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(null);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const projects = useQuery(api.projects.getClientProjects, { 
    client_id: clientId as any,
    include_archived: showArchived
  }) || [];

  const deleteProject = useMutation(api.projects.deleteProject);
  const toggleProjectArchive = useMutation(api.projects.toggleProjectArchive);
  const updateProjectStatus = useMutation(api.projects.updateProjectStatus);

  const handleProjectClick = (projectId: string) => {
    setSelectedProject(projectId);
    onProjectSelect(projectId);
  };

  const handleArchiveProject = async (projectId: string, setToArchived: boolean) => {
    try {
      await toggleProjectArchive({ 
        project_id: projectId as any,
        archived: setToArchived // true = archive, false = restore
      });
      
      toast({
        title: setToArchived
          ? t('platform.project.archive.success')
          : t('platform.project.restore.success'),
      });
      
      setShowDropdown(null);
    } catch (error) {
      console.error('Error toggling project archive:', error);
      toast({
        title: setToArchived
          ? t('platform.project.archive.error')
          : t('platform.project.restore.error'),
        variant: "destructive",
      });
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await deleteProject({ project_id: projectId as any });
      
      toast({
        title: t('platform.project.delete.success'),
      });
      
      setShowDropdown(null);
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({
        title: t('platform.project.delete.error'),
        variant: "destructive",
      });
    }
  };

  const handleUpdateStatus = async (projectId: string, status: string) => {
    try {
      await updateProjectStatus({ 
        project_id: projectId as any,
        status: status as any
      });
      
      toast({
        title: t('platform.project.status_updated'),
        description: t(`platform.status.${status}`),
      });
      
      setShowDropdown(null);
    } catch (error) {
      console.error('Error updating project status:', error);
      toast({
        title: t('platform.project.status_update_error'),
        variant: "destructive",
      });
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return t('platform.time.just_now');
    if (diffInSeconds < 3600) return t('platform.time.minutes_ago').replace('{count}', Math.floor(diffInSeconds / 60).toString());
    if (diffInSeconds < 86400) return t('platform.time.hours_ago').replace('{count}', Math.floor(diffInSeconds / 3600).toString());
    if (diffInSeconds < 2592000) return t('platform.time.days_ago').replace('{count}', Math.floor(diffInSeconds / 86400).toString());
    
    // For older dates, show the actual date
    return date.toLocaleDateString('es-MX', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    const colors = {
      not_started: 'text-gray-500 bg-gray-100',
      in_progress: 'text-blue-600 bg-blue-100', 
      review: 'text-yellow-600 bg-yellow-100',
      complete: 'text-green-600 bg-green-100',
      paused: 'text-orange-600 bg-orange-100'
    };
    return colors[status] || colors.not_started;
  };

  const getStatusText = (status: string) => {
    const statusMap = {
      not_started: t('platform.status.not_started'),
      in_progress: t('platform.status.in_progress'),
      review: t('platform.status.review'),
      complete: t('platform.status.complete'),
      paused: t('platform.status.paused')
    };
    return statusMap[status] || status;
  };

  const getTypeIcon = (type: string) => {
    const icons = {
      presentation: '📊',
      cards: '🃏',
      lead_gen: '🎯',
      website: '🌐',
      other: '📁'
    };
    return icons[type] || icons.other;
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: 'border-l-gray-300',
      medium: 'border-l-blue-400',
      high: 'border-l-orange-400',
      urgent: 'border-l-red-500'
    };
    return colors[priority] || colors.medium;
  };

  if (!projects) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
        <LanguageToggle />
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 transition-colors duration-200">
      {/* Mobile-optimized header */}
      <div className="flex justify-between items-center p-3 sm:p-4">
        <LanguageToggle />
        
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
      </div>
      
      <div className="px-3 sm:px-4 lg:px-6 pb-6 sm:pb-8">
        {/* Compact Header */}
        <div className="mb-4 sm:mb-6">
          <div className="text-center mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {t(`platform.dashboard.title.${userRole}`)}
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              {t(`platform.dashboard.subtitle.${userRole}`)}
            </p>
          </div>
          
          {/* Compact Archive Toggle */}
          <div className="flex items-center justify-center space-x-2">
            <Button
              variant={!showArchived ? "default" : "outline"}
              size="sm"
              onClick={() => setShowArchived(false)}
              className={`text-xs sm:text-sm px-3 py-2 ${!showArchived ? "bg-blue-600 hover:bg-blue-700" : ""}`}
            >
              <Folder className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">{t('platform.dashboard.show_active')}</span>
              <span className="sm:hidden">Active</span>
            </Button>
            <Button
              variant={showArchived ? "default" : "outline"}
              size="sm"
              onClick={() => setShowArchived(true)}
              className={`text-xs sm:text-sm px-3 py-2 ${showArchived ? "bg-blue-600 hover:bg-blue-700" : ""}`}
            >
              <Archive className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">{t('platform.dashboard.show_archived')}</span>
              <span className="sm:hidden">Archive</span>
            </Button>
          </div>
        </div>

        {/* Compact Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-8">
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="p-1.5 sm:p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Folder className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{t('platform.stats.total_projects')}</p>
                  <p className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">{projects.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="p-1.5 sm:p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{t('platform.stats.active_projects')}</p>
                  <p className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                    {projects.filter(p => p.status === 'in_progress').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="p-1.5 sm:p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                  <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{t('platform.stats.unread_messages')}</p>
                  <p className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                    {projects.reduce((total, p) => total + p.unread_count, 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="p-1.5 sm:p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{t('platform.stats.active_conversations')}</p>
                  <p className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                    {projects.reduce((total, p) => total + p.active_threads, 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Compact Projects Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
          {projects.map((project: Project) => (
            <Card 
              key={project._id}
              className={`bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 cursor-pointer transition-all duration-200 hover:shadow-lg dark:hover:shadow-gray-900/20 border-l-4 ${getPriorityColor(project.priority)} ${
                selectedProject === project._id ? 'ring-2 ring-blue-500 shadow-lg' : ''
              }`}
              onClick={() => handleProjectClick(project._id)}
            >
              <CardHeader className="pb-2 sm:pb-3 px-4 pt-4 sm:px-6 sm:pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                    <div 
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center text-lg sm:text-xl flex-shrink-0"
                      style={{ backgroundColor: project.color + '20' }}
                    >
                      {project.icon || getTypeIcon(project.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-base sm:text-lg truncate">
                        {project.name}
                      </h3>
                      <Badge className={`text-xs ${getStatusColor(project.status)}`}>
                        {getStatusText(project.status)}
                      </Badge>
                    </div>
                  </div>
                  <div className="relative flex-shrink-0 ml-2" ref={showDropdown === project._id ? dropdownRef : undefined}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDropdown(showDropdown === project._id ? null : project._id);
                      }}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <MoreHorizontal className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    </Button>
                    
                    {showDropdown === project._id && (
                      <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                        {/* Status Options */}
                        {!showArchived && (
                          <>
                            <div className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
                              {t('platform.project.change_status')}
                            </div>
                            {project.status !== 'in_progress' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateStatus(project._id, 'in_progress');
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                              >
                                <Play className="w-4 h-4" />
                                <span>{t('platform.status.in_progress')}</span>
                              </button>
                            )}
                            {project.status !== 'review' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateStatus(project._id, 'review');
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                              >
                                <Eye className="w-4 h-4" />
                                <span>{t('platform.status.review')}</span>
                              </button>
                            )}
                            {project.status !== 'complete' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateStatus(project._id, 'complete');
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                              >
                                <CheckCircle className="w-4 h-4" />
                                <span>{t('platform.status.complete')}</span>
                              </button>
                            )}
                            {project.status !== 'paused' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateStatus(project._id, 'paused');
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                              >
                                <Pause className="w-4 h-4" />
                                <span>{t('platform.status.paused')}</span>
                              </button>
                            )}
                            {project.status !== 'not_started' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateStatus(project._id, 'not_started');
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                              >
                                <RotateCcw className="w-4 h-4" />
                                <span>{t('platform.status.not_started')}</span>
                              </button>
                            )}
                            <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>
                          </>
                        )}
                        
                        {/* Archive/Restore */}
                        {showArchived ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleArchiveProject(project._id, false); // Restore = set archived to false
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                          >
                            <ArchiveRestore className="w-4 h-4" />
                            <span>{t('platform.project.restore')}</span>
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleArchiveProject(project._id, true); // Archive = set archived to true
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                          >
                            <Archive className="w-4 h-4" />
                            <span>{t('platform.project.archive')}</span>
                          </button>
                        )}
                        {/* Delete option - only show for developers */}
                        {userRole === 'developer' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProject(project._id);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>{t('platform.project.delete')}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0 px-4 pb-4 sm:px-6 sm:pb-6">
                {project.description && (
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mb-2 sm:mb-3 line-clamp-2">
                    {project.description}
                  </p>
                )}

                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    <div className="flex items-center space-x-1 text-gray-500 dark:text-gray-400">
                      <MessageCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span>{project.active_threads}</span>
                    </div>
                    
                    {project.unread_count > 0 && (
                      <div className="flex items-center space-x-1 text-orange-600 dark:text-orange-400">
                        <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="font-medium">{project.unread_count}</span>
                      </div>
                    )}
                  </div>

                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {formatRelativeTime(project.updated_at)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Compact New Project Card */}
          <Card 
            className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 cursor-pointer transition-all duration-200 hover:shadow-lg dark:hover:shadow-gray-900/20 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500"
            onClick={onNewProject}
          >
            <CardContent className="p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-center text-center space-y-2 sm:space-y-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 dark:text-gray-500" />
              </div>
              <div>
                <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-1 text-sm sm:text-base">
                  {t('platform.dashboard.new_project')}
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  {t('platform.dashboard.new_project_subtitle')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Compact Empty State */}
        {projects.length === 0 && (
          <div className="text-center py-8 sm:py-12 px-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-3 sm:mb-4">
              {showArchived ? (
                <Archive className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400 dark:text-gray-500" />
              ) : (
                <Folder className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400 dark:text-gray-500" />
              )}
            </div>
            <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-2">
              {showArchived ? t('platform.dashboard.no_archived') : t('platform.dashboard.no_projects')}
            </h3>
            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mb-4 sm:mb-6">
              {showArchived ? t('platform.dashboard.no_archived.subtitle') : t('platform.dashboard.no_projects.subtitle')}
            </p>
            {!showArchived && (
              <Button onClick={onNewProject} className="bg-blue-600 hover:bg-blue-700 text-sm sm:text-base px-4 py-2">
                <Plus className="w-4 h-4 mr-2" />
                {t('platform.dashboard.create_first_project')}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientDashboard;