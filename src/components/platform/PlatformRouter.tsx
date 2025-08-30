import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { notificationService } from '@/services/notificationService';
import ClientDashboard from './ClientDashboard';
import ProjectView from './ProjectView';
import ThreadView from './ThreadView';
import NewProjectModal from './NewProjectModal';
import NewThreadModal from './NewThreadModal';

type ViewType = 'dashboard' | 'project' | 'thread';

interface ViewState {
  type: ViewType;
  projectId?: string;
  threadId?: string;
  activeTab?: 'conversations' | 'files';
}

interface PlatformRouterProps {
  userRole?: 'client' | 'developer';
}

const PlatformRouter: React.FC<PlatformRouterProps> = ({ userRole = 'client' }) => {
  const { t, language, setLanguage } = useLanguage();
  const { toast } = useToast();
  
  const [currentView, setCurrentView] = useState<ViewState>({ type: 'dashboard' });
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showNewThreadModal, setShowNewThreadModal] = useState(false);

  // Set language based on user role
  useEffect(() => {
    if (userRole === 'client' && language === 'en') {
      setLanguage('es'); // Client defaults to Spanish
    } else if (userRole === 'developer' && language === 'es') {
      setLanguage('en'); // Developer defaults to English
    }
  }, [userRole]);

  // Check migration status and get main client
  const migrationStatus = useQuery(api.migration.getMigrationStatus);
  const migrateFeedback = useMutation(api.migration.migrateFeedbackData);
  const cleanupWelcomeMessages = useMutation(api.migration.cleanupWelcomeMessages);

  // Get total unread count for badge notifications
  const totalUnreadCount = useQuery(api.threads.getTotalUnreadCount, {
    viewer: userRole
  });

  // Get main client ID (first client or migrate if none exist)
  const [mainClientId, setMainClientId] = useState<string | null>(null);

  useEffect(() => {
    if (migrationStatus) {
      if (migrationStatus.migration_completed && migrationStatus.main_client) {
        setMainClientId(migrationStatus.main_client._id);
      } else if (!migrationStatus.migration_completed) {
        // Auto-run migration on first load
        handleMigration();
      }
    }
  }, [migrationStatus]);

  const [hasRunCleanup, setHasRunCleanup] = useState(false);

  const handleCleanup = async () => {
    if (hasRunCleanup) return;
    
    try {
      await cleanupWelcomeMessages({});
      setHasRunCleanup(true);
      console.log('Welcome message cleanup completed');
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  };

  // Run cleanup when platform loads and main client is set
  useEffect(() => {
    if (mainClientId && !hasRunCleanup) {
      handleCleanup();
    }
  }, [mainClientId, hasRunCleanup]);

  // Update badge count for PWA notifications
  useEffect(() => {
    if (totalUnreadCount !== undefined && notificationService.isSupported()) {
      notificationService.updateBadge(totalUnreadCount);
    }
  }, [totalUnreadCount]);

  // PWA initialization will be handled separately on subdomain

  // Request notification permissions only when user interacts (not automatically)
  const requestNotificationPermissions = async () => {
    if (notificationService.isSupported()) {
      const permission = await notificationService.requestPermission();
      if (permission === 'granted') {
        console.log('✅ Notifications enabled for PWA');
        toast({
          title: "Notifications Enabled",
          description: "You'll receive notifications for new messages",
        });
      }
    }
  };

  const handleMigration = async () => {
    try {
      const result = await migrateFeedback({
        client_name: t('platform.system.main_client')
      });

      if (result.success) {
        setMainClientId(result.client_id);
        
        
        toast({
          title: t('platform.system.welcome.title'),
          description: t('platform.system.welcome.description').replace('{count}', result.migrated_feedback_count).replace('{projects}', result.total_projects),
        });
      }
    } catch (error) {
      toast({
        title: t('platform.system.migration_error'),
        description: t('platform.system.migration_error.description'),
        variant: "destructive",
      });
    }
  };

  const handleProjectSelect = (projectId: string) => {
    setCurrentView({ type: 'project', projectId });
  };

  const handleThreadSelect = (threadId: string) => {
    setCurrentView({ 
      type: 'thread', 
      projectId: currentView.projectId, 
      threadId 
    });
  };

  const handleBackToDashboard = () => {
    setCurrentView({ type: 'dashboard' });
  };

  const handleBackToProject = () => {
    if (currentView.projectId) {
      setCurrentView({ type: 'project', projectId: currentView.projectId });
    } else {
      handleBackToDashboard();
    }
  };

  const handleViewProjectFiles = (projectId: string) => {
    setCurrentView({ type: 'project', projectId: projectId, activeTab: 'files' });
  };

  const handleNewProject = () => {
    setShowNewProjectModal(true);
  };

  const handleNewThread = () => {
    setShowNewThreadModal(true);
  };

  const handleProjectCreated = (projectId: string) => {
    setShowNewProjectModal(false);
    setCurrentView({ type: 'project', projectId });
    
    toast({
      title: t('platform.system.project_created'),
      description: t('platform.system.project_created.description'),
    });
  };

  const handleThreadCreated = (threadId: string) => {
    setShowNewThreadModal(false);
    setCurrentView({ 
      type: 'thread', 
      projectId: currentView.projectId, 
      threadId 
    });
    
    toast({
      title: t('platform.system.thread_created'),
      description: t('platform.system.thread_created.description'),
    });
  };

  // Loading state during migration
  if (!migrationStatus || !mainClientId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {migrationStatus?.migration_completed ? 
              t('platform.system.loading') : 
              t('platform.system.setting_up')
            }
          </h2>
          <p className="text-gray-600">
            {migrationStatus?.migration_completed ? 
              t('platform.system.preparing') : 
              t('platform.system.migrating')
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Main Content */}
      {currentView.type === 'dashboard' && (
        <ClientDashboard
          clientId={mainClientId}
          onProjectSelect={handleProjectSelect}
          onNewProject={handleNewProject}
          userRole={userRole}
        />
      )}

      {currentView.type === 'project' && currentView.projectId && (
        <ProjectView
          projectId={currentView.projectId}
          onBack={handleBackToDashboard}
          onThreadSelect={handleThreadSelect}
          onNewThread={handleNewThread}
          onProjectDeleted={handleBackToDashboard}
          userRole={userRole}
          initialTab={currentView.activeTab}
        />
      )}

      {currentView.type === 'thread' && currentView.threadId && (
        <ThreadView
          threadId={currentView.threadId}
          onBack={handleBackToProject}
          onProjectFiles={() => handleViewProjectFiles(currentView.projectId!)}
          userRole={userRole}
        />
      )}

      {/* Modals */}
      {showNewProjectModal && (
        <NewProjectModal
          clientId={mainClientId}
          onClose={() => setShowNewProjectModal(false)}
          onProjectCreated={handleProjectCreated}
        />
      )}

      {showNewThreadModal && currentView.projectId && (
        <NewThreadModal
          projectId={currentView.projectId}
          onClose={() => setShowNewThreadModal(false)}
          onThreadCreated={handleThreadCreated}
          userRole={userRole}
        />
      )}
    </>
  );
};

export default PlatformRouter;