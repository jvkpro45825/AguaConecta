/**
 * Notification Service for PWA
 * Handles push notifications, badge counts, and user permissions
 */

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

class NotificationService {
  private registration: ServiceWorkerRegistration | null = null;

  async init() {
    if ('serviceWorker' in navigator) {
      try {
        this.registration = await navigator.serviceWorker.ready;
        console.log('🔔 Notification service initialized');
        
        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage);
        
        return true;
      } catch (error) {
        console.error('Failed to initialize notification service:', error);
        return false;
      }
    }
    return false;
  }

  private handleServiceWorkerMessage = (event: MessageEvent) => {
    const { type, data } = event.data;
    
    switch (type) {
      case 'NOTIFICATION_CLICKED':
        this.handleNotificationClick(data);
        break;
      case 'BADGE_UPDATE':
        this.updateBadge(data.count);
        break;
    }
  };

  private handleNotificationClick(data: any) {
    // Handle notification click - navigate to specific conversation or project
    if (data.threadId) {
      window.location.href = `/project/${data.projectId}?thread=${data.threadId}`;
    } else if (data.projectId) {
      window.location.href = `/project/${data.projectId}`;
    } else {
      window.location.href = '/';
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      console.log('🔔 Notification permission:', permission);
      return permission;
    }

    return Notification.permission;
  }

  async showNotification(payload: NotificationPayload) {
    const permission = await this.requestPermission();
    
    if (permission !== 'granted' || !this.registration) {
      console.warn('Cannot show notification: permission denied or no service worker');
      return false;
    }

    try {
      await this.registration.showNotification(payload.title, {
        body: payload.body,
        icon: payload.icon || '/icon-192.png',
        badge: payload.badge || '/apple-touch-icon.png',
        tag: payload.tag || 'agua-limpia-notification',
        data: payload.data,
        actions: payload.actions || [
          {
            action: 'view',
            title: 'View',
            icon: '/icon-192.png'
          },
          {
            action: 'dismiss',
            title: 'Dismiss'
          }
        ],
        requireInteraction: true,
        silent: false,
        vibrate: [200, 100, 200]
      });

      console.log('🔔 Notification shown:', payload.title);
      return true;
    } catch (error) {
      console.error('Failed to show notification:', error);
      return false;
    }
  }

  async showMessageNotification(threadId: string, projectId: string, author: string, message: string) {
    const authorName = author === 'client' ? 'Willy' : 'Justin';
    
    return this.showNotification({
      title: `New message from ${authorName}`,
      body: message.length > 100 ? message.substring(0, 100) + '...' : message,
      icon: '/icon-192.png',
      tag: `message-${threadId}`,
      data: {
        type: 'message',
        threadId,
        projectId,
        author
      },
      actions: [
        {
          action: 'reply',
          title: 'Reply',
          icon: '/icon-192.png'
        },
        {
          action: 'view',
          title: 'View Conversation'
        }
      ]
    });
  }

  async showProjectNotification(projectId: string, title: string, message: string) {
    return this.showNotification({
      title: `Project Update: ${title}`,
      body: message,
      icon: '/icon-192.png',
      tag: `project-${projectId}`,
      data: {
        type: 'project',
        projectId
      }
    });
  }

  async updateBadge(count: number) {
    try {
      if ('setAppBadge' in navigator) {
        // Modern browsers with badge API
        if (count > 0) {
          await (navigator as any).setAppBadge(count);
        } else {
          await (navigator as any).clearAppBadge();
        }
        console.log('🔢 Badge updated:', count);
      } else {
        // Fallback for older browsers - update document title
        const baseTitle = 'Agua Limpia';
        if (count > 0) {
          document.title = `(${count}) ${baseTitle}`;
        } else {
          document.title = baseTitle;
        }
        console.log('🔢 Title badge updated:', count);
      }
    } catch (error) {
      console.error('Failed to update badge:', error);
    }
  }

  async clearBadge() {
    return this.updateBadge(0);
  }

  async getUnreadCount(): Promise<number> {
    // This method is kept for compatibility but badge updates should be handled externally
    // The actual unread count integration is handled in PlatformRouter component
    try {
      return 0;
    } catch (error) {
      console.error('Failed to get unread count:', error);
      return 0;
    }
  }

  isSupported(): boolean {
    return 'Notification' in window && 'serviceWorker' in navigator;
  }

  getPermissionStatus(): NotificationPermission {
    return Notification.permission;
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

// Auto-initialize when module is imported
if (typeof window !== 'undefined') {
  notificationService.init();
}