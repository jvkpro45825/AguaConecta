import React, { useState, useEffect } from 'react';
import { useQuery } from "convex/react";
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

  // Set language based on user role immediately
  useEffect(() => {
    const targetLanguage = userRole === 'client' ? 'es' : 'en';
    if (language !== targetLanguage) {
      setLanguage(targetLanguage);
    }
  }, [userRole, language, setLanguage]);

  // Get total unread count for badge notifications (temporarily disabled)
  // const totalUnreadCount = useQuery(api.threads.getTotalUnreadCount, {
  //   viewer: userRole
  // });
  const totalUnreadCount = 0;

  // Get main client directly
  const clients = useQuery(api.clients.getAllClients);
  const [mainClientId, setMainClientId] = useState<string | null>(null);

  useEffect(() => {
    if (clients && clients.length > 0) {
      setMainClientId(clients[0]._id);
    }
  }, [clients]);

  // Update badge count for PWA notifications
  useEffect(() => {
    if (totalUnreadCount !== undefined && notificationService.isSupported()) {
      notificationService.updateBadge(totalUnreadCount);
    }
  }, [totalUnreadCount]);

  // Navigation handlers
  const handleViewProject = (projectId: string, activeTab?: 'conversations' | 'files') => {
    setCurrentView({ type: 'project', projectId, activeTab });
  };

  const handleViewThread = (threadId: string, projectId: string) => {
    setCurrentView({ type: 'thread', threadId, projectId });
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

  // Loading state while getting client data
  if (!mainClientId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Loading AguaConecta...
          </h2>
          <p className="text-gray-600">
            Preparing your communication platform
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
          onProjectSelect={handleViewProject}
          onNewProject={() => setShowNewProjectModal(true)}
          userRole={userRole}
        />
      )}

      {currentView.type === 'project' && currentView.projectId && (
        <ProjectView
          projectId={currentView.projectId}
          onBack={handleBackToDashboard}
          onThreadSelect={handleViewThread}
          onNewThread={() => setShowNewThreadModal(true)}
          userRole={userRole}
          initialTab={currentView.activeTab}
        />
      )}

      {currentView.type === 'thread' && currentView.threadId && (
        <ThreadView
          threadId={currentView.threadId}
          onBack={handleBackToProject}
          onProjectFiles={handleViewProjectFiles}
          userRole={userRole}
        />
      )}

      {/* Modals */}
      <NewProjectModal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        onProjectCreated={(projectId) => {
          handleViewProject(projectId);
          setShowNewProjectModal(false);
        }}
        clientId={mainClientId}
      />

      <NewThreadModal
        isOpen={showNewThreadModal}
        onClose={() => setShowNewThreadModal(false)}
        onThreadCreated={(threadId) => {
          if (currentView.projectId) {
            handleViewThread(threadId, currentView.projectId);
          }
          setShowNewThreadModal(false);
        }}
        projectId={currentView.projectId || ''}
        userRole={userRole}
      />
    </>
  );
};

export default PlatformRouter;