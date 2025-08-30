import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ArrowLeft, Send, MoreHorizontal, User, Bot, Languages, Loader2, Image, FileText, Download, Sun, Moon, Folder, ChevronDown, Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { FileUpload, FilePreview } from '@/components/ui/file-upload';
import { translateText, getTargetLanguage, detectLanguage } from '@/utils/translation';
import { notificationService } from '@/services/notificationService';

interface Message {
  _id: string;
  author: 'client' | 'developer';
  content: string;
  message_type: 'text' | 'system' | 'status_update' | 'file';
  is_private: boolean;
  is_edited: boolean;
  created_at: string;
  edited_at?: string;
  // Translation fields
  original_content?: string;
  original_language?: 'en' | 'es';
  translated_content?: string;
  target_language?: 'en' | 'es';
  translation_enabled?: boolean;
  // File attachment fields
  file_id?: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
  file_url?: string;
}

interface ThreadViewProps {
  threadId: string;
  onBack: () => void;
  onProjectFiles?: (projectId: string) => void;
  userRole?: 'client' | 'developer';
}

const ThreadView: React.FC<ThreadViewProps> = ({ threadId, onBack, onProjectFiles, userRole = 'client' }) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const [newMessage, setNewMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOriginal, setShowOriginal] = useState<{[key: string]: boolean}>({}); // Track which messages show original
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const thread = useQuery(api.threads.getThread, {
    thread_id: threadId as any,
    viewer: "client"
  });

  const messages = useQuery(api.messages.getThreadMessages, {
    thread_id: threadId as any,
    include_private: false // Client can't see private developer notes
  }) || [];

  const sendMessage = useMutation(api.messages.sendMessage);
  const markAsRead = useMutation(api.threads.markThreadAsRead);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const sendFileMessage = useMutation(api.files.sendFileMessage);
  const deleteThread = useMutation(api.threads.deleteThread);
  const toggleThreadArchive = useMutation(api.threads.toggleThreadArchive);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark thread as read when opened
  useEffect(() => {
    if (threadId) {
      markAsRead({
        thread_id: threadId as any,
        reader: userRole
      });
    }
  }, [threadId, markAsRead]);

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  // Notification service for new messages
  useEffect(() => {
    if (messages && messages.length > 0 && thread) {
      const latestMessage = messages[messages.length - 1];
      
      // Only notify for messages from the other party (not self)
      if (latestMessage.author !== userRole && latestMessage.message_type === 'text') {
        // Check if this is a genuinely new message (created within last 10 seconds)
        const messageAge = new Date().getTime() - new Date(latestMessage.created_at).getTime();
        
        if (messageAge < 10000 && notificationService.isSupported()) {
          notificationService.showMessageNotification(
            threadId,
            thread.project_id,
            latestMessage.author,
            latestMessage.content
          );
        }
      }
    }
  }, [messages, thread, threadId, userRole]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [newMessage]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSubmitting) return;

    // Request notification permissions on first message send (user-triggered)
    if (notificationService.isSupported() && notificationService.getPermissionStatus() === 'default') {
      try {
        await notificationService.requestPermission();
      } catch (error) {
        // Ignore permission errors - not critical for sending messages
        console.log('Notification permission not granted');
      }
    }

    setIsSubmitting(true);
    const originalMessage = newMessage.trim();
    
    try {
      // Auto-translate message
      const detectedLang = detectLanguage(originalMessage);
      const finalDetectedLang = detectedLang === 'auto' ? (userRole === 'developer' ? 'en' : 'es') : detectedLang;
      const targetLang = getTargetLanguage(userRole, finalDetectedLang);
      
      let translationData = {
        original_content: originalMessage,
        original_language: finalDetectedLang,
        translated_content: undefined as string | undefined,
        target_language: targetLang,
        translation_enabled: true
      };

      // Only translate if we need to (different languages)
      if (finalDetectedLang !== targetLang) {
        try {
          console.log('🔄 Attempting translation:', {
            original: originalMessage,
            from: finalDetectedLang,
            to: targetLang,
            userRole
          });
          
          const result = await translateText(originalMessage, targetLang, finalDetectedLang);
          
          console.log('✅ Translation result:', result);
          
          if (result.success) {
            translationData.translated_content = result.translatedText;
          } else {
            // Translation failed, use original but log the error
            console.warn('Translation failed:', result.error);
            translationData.translation_enabled = false;
          }
        } catch (translationError) {
          // Handle translation service errors gracefully
          console.warn('Translation service error:', translationError);
          translationData.translation_enabled = false;
        }
      }

      // Send message with translation data
      await sendMessage({
        thread_id: threadId as any,
        content: translationData.translated_content || originalMessage,
        author: userRole,
        message_type: "text",
        is_private: false,
        ...translationData
      });

      setNewMessage('');
    } catch (error) {
      toast({
        title: t('platform.messages.sent_error'),
        description: t('platform.messages.sent_error_description'),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setIsUploading(true);

    try {
      console.log('📎 Uploading file:', file.name, file.type, file.size);

      // Generate upload URL
      const uploadUrl = await generateUploadUrl();
      
      // Upload file to Convex storage
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) {
        throw new Error(`Upload failed: ${result.status}`);
      }

      const { storageId } = await result.json();
      console.log('✅ File uploaded with ID:', storageId);

      // Send file message
      await sendFileMessage({
        thread_id: threadId as any,
        author: userRole,
        file_id: storageId,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        caption: newMessage.trim() || undefined, // Use text as caption if provided
      });

      // Clear form
      setNewMessage('');
      setSelectedFile(null);
      
      console.log('✅ File message sent successfully');

    } catch (error) {
      console.error('❌ File upload error:', error);
      toast({
        title: 'Error uploading file',
        description: 'Failed to upload file. Please try again.',
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
  };

  const handleViewProjectFiles = () => {
    if (thread?.project_id && onProjectFiles) {
      onProjectFiles(thread.project_id);
    }
    setShowDropdown(false);
  };

  const handleDeleteConversation = async () => {
    if (!thread) return;
    
    try {
      await deleteThread({ thread_id: threadId as any });
      
      toast({
        title: t('platform.thread.delete.success'),
        description: t('platform.thread.delete.description'),
      });
      
      setShowDropdown(false);
      onBack(); // Navigate back to project view
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast({
        title: t('platform.thread.delete.error'),
        variant: "destructive",
      });
    }
  };

  const handleArchiveConversation = async () => {
    if (!thread) return;
    
    try {
      const isArchived = thread.is_archived || false;
      await toggleThreadArchive({ 
        thread_id: threadId as any,
        archived: !isArchived
      });
      
      toast({
        title: isArchived 
          ? t('platform.thread.restore.success')
          : t('platform.thread.archive.success'),
      });
      
      setShowDropdown(false);
      onBack(); // Navigate back to project view
    } catch (error) {
      console.error('Error toggling conversation archive:', error);
      toast({
        title: t('platform.thread.archive.error'),
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

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      return date.toLocaleDateString('es-MX', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const toggleOriginal = (messageId: string) => {
    setShowOriginal(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const renderMessageContent = (message: Message) => {
    if (message.message_type === 'status_update') {
      return (
        <div className="text-sm text-gray-600 italic bg-gray-50 rounded p-2">
          {message.content}
        </div>
      );
    }

    if (message.message_type === 'file') {
      const isImage = message.file_type?.startsWith('image/');
      const isPdf = message.file_type?.includes('pdf');
      const isDocument = message.file_type?.includes('document') || message.file_type?.includes('application/');
      
      return (
        <div className="space-y-3">
          {/* Enhanced File attachment display */}
          <div className={`border rounded-2xl overflow-hidden ${
            message.author === userRole 
              ? 'bg-blue-500/10 border-blue-300/30' 
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600'
          }`}>
            {/* Image Preview */}
            {isImage && message.file_url ? (
              <div className="relative group cursor-pointer" onClick={() => window.open(message.file_url, '_blank')}>
                <img 
                  src={message.file_url} 
                  alt={message.file_name}
                  className="w-full max-w-sm rounded-t-2xl object-cover hover:opacity-95 transition-opacity"
                  style={{ maxHeight: '300px' }}
                />
                {/* Image overlay on hover */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-t-2xl flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-white dark:bg-gray-800 rounded-full p-2 shadow-lg">
                      <Download className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Document/File Preview */
              <div className="p-4">
                <div className="flex items-center space-x-4">
                  {/* Enhanced File icon */}
                  <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${
                    isPdf ? 'bg-red-100 dark:bg-red-900/30' :
                    isDocument ? 'bg-blue-100 dark:bg-blue-900/30' :
                    'bg-gray-100 dark:bg-gray-700'
                  }`}>
                    {isPdf ? (
                      <FileText className="w-8 h-8 text-red-600 dark:text-red-400" />
                    ) : isDocument ? (
                      <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    ) : isImage ? (
                      <Image className="w-8 h-8 text-green-600 dark:text-green-400" />
                    ) : (
                      <FileText className="w-8 h-8 text-gray-500 dark:text-gray-400" />
                    )}
                  </div>

                  {/* Enhanced File info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white truncate text-base">
                      {message.file_name}
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {message.file_size ? formatFileSize(message.file_size) : 'Unknown size'}
                      </span>
                      {/* File type badge */}
                      <div className={`px-2 py-1 rounded-md text-xs font-medium ${
                        isPdf ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        isDocument ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        isImage ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                      }`}>
                        {isPdf ? 'PDF' :
                         isDocument ? 'DOC' :
                         isImage ? 'IMAGE' :
                         'FILE'}
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Download button */}
                  {message.file_url && (
                    <a 
                      href={message.file_url}
                      download={message.file_name}
                      className="flex-shrink-0 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Download className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* File details footer for images */}
            {isImage && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                      {message.file_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {message.file_size ? formatFileSize(message.file_size) : 'Unknown size'}
                    </p>
                  </div>
                  {message.file_url && (
                    <a 
                      href={message.file_url}
                      download={message.file_name}
                      className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Download className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Caption if provided */}
          {message.content && !message.content.startsWith('📎') && (
            <div className="prose prose-sm max-w-none">
              <p className="mb-0 whitespace-pre-wrap text-sm">{message.content}</p>
            </div>
          )}
        </div>
      );
    }

    const isShowingOriginal = showOriginal[message._id];
    const hasTranslation = message.translation_enabled && message.original_content && message.translated_content;
    
    // Smart display logic: show original for own messages, translated for others
    let displayContent = message.content;
    let isTranslated = false;
    
    if (hasTranslation && message.author !== userRole) {
      // For messages from the other person, show translation by default
      if (!isShowingOriginal) {
        displayContent = message.content; // This contains the translated version
        isTranslated = true;
      } else {
        displayContent = message.original_content || message.content;
        isTranslated = false;
      }
    } else if (hasTranslation && message.author === userRole) {
      // For own messages with translation, show original but allow viewing translation
      if (!isShowingOriginal) {
        displayContent = message.original_content || message.content;
      } else {
        displayContent = message.content; // Show what was sent to the other person
      }
    } else {
      // For own messages without translation, always show original
      displayContent = message.original_content || message.content;
    }

    return (
      <div className="prose prose-sm max-w-none">
        <p className="mb-0 whitespace-pre-wrap">{displayContent}</p>
        {hasTranslation && (
          <div className="mt-2 pt-2 border-t border-opacity-20">
            <button
              onClick={() => toggleOriginal(message._id)}
              className="text-xs opacity-60 hover:opacity-80 flex items-center space-x-1"
            >
              <Languages className="w-3 h-3" />
              <span>
                {message.author === userRole 
                  ? (isShowingOriginal ? 'Ver mi mensaje' : 'Ver traducción enviada')
                  : (isShowingOriginal ? 'Ver traducción' : 'Ver original')
                }
              </span>
            </button>
          </div>
        )}
      </div>
    );
  };

  if (!thread) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex flex-col transition-colors duration-200">
      {/* Header - Sticky */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 sticky top-0 z-40">
        <div className="px-3 py-4 sm:px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-4 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4 text-gray-700 dark:text-gray-300" />
              </Button>

              <div className="flex-1 min-w-0">
                <h1 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate">
                  {thread.title}
                </h1>
                <div className="flex items-center space-x-2 mt-1">
                  <Badge className={`text-xs ${getStatusColor(thread.status)}`}>
                    {getStatusText(thread.status)}
                  </Badge>
                  {thread.project && (
                    <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">
                      • {thread.project.name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
              {/* Theme toggle */}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={toggleTheme}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-yellow-500" />
                ) : (
                  <Moon className="w-4 h-4 text-gray-600" />
                )}
              </Button>
              
              {/* Dropdown Menu */}
              <div className="relative" ref={dropdownRef}>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="hover:bg-gray-100 dark:hover:bg-gray-700 p-2"
                >
                  <MoreHorizontal className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </Button>
                
                {showDropdown && (
                  <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                    <button
                      onClick={handleViewProjectFiles}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                    >
                      <Folder className="w-4 h-4" />
                      <span>{t('platform.thread.see_project_files')}</span>
                    </button>
                    
                    <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>
                    
                    <button
                      onClick={handleArchiveConversation}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                    >
                      {thread?.is_archived ? (
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
                        onClick={handleDeleteConversation}
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
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-4 space-y-4">
          {messages.map((message: Message) => (
            <div
              key={message._id}
              className={`flex ${message.author === userRole ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-md lg:max-w-2xl ${
                  message.author === userRole
                    ? 'bg-blue-600 dark:bg-blue-500 text-white rounded-2xl rounded-br-md'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-2xl rounded-bl-md shadow-sm'
                } p-3 sm:p-4`}
              >
                {/* Message Header */}
                <div className="flex items-center space-x-2 mb-2">
                  <div className="flex items-center space-x-2">
                    {message.author === userRole ? (
                      <User className="w-4 h-4 opacity-75" />
                    ) : (
                      <Bot className="w-4 h-4 opacity-75" />
                    )}
                    <span className="text-xs font-medium opacity-75">
                      {message.author === userRole ? t('platform.author.you') : 
                       (userRole === 'developer' ? 'Willy' : 'Justin')}
                    </span>
                  </div>
                  <span className="text-xs opacity-50">
                    {formatMessageTime(message.created_at)}
                  </span>
                  {message.is_edited && (
                    <span className="text-xs opacity-50">(editado)</span>
                  )}
                </div>

                {/* Translation indicator - only for messages from other person */}
                {message.translation_enabled && message.original_content && message.author !== userRole && (
                  <div className="flex items-center space-x-1 mb-1">
                    <Languages className="w-3 h-3 opacity-50" />
                    <span className="text-xs opacity-50">Traducido automáticamente</span>
                  </div>
                )}
                
                {/* Message Content */}
                {renderMessageContent(message)}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Enhanced Message Input for Mobile */}
        <div className="bg-white dark:bg-gray-800 border-t dark:border-gray-700 p-2 sm:p-4">
          <div className="w-full max-w-none px-2 sm:px-0 sm:max-w-4xl sm:mx-auto">
            {/* File preview if selected */}
            {selectedFile && (
              <div className="mb-4">
                <FilePreview 
                  file={selectedFile} 
                  onRemove={handleRemoveFile}
                />
              </div>
            )}

            {/* iMessage-style input container - edge-to-edge on mobile */}
            <div className="flex items-center space-x-2 w-full">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.txt"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
                className="hidden"
                disabled={isSubmitting || isUploading}
              />
              
              {/* Attachment button - far left */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting || isUploading}
                className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 flex items-center justify-center transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>

              {/* Text input - maximized width with minimal padding */}
              <div className="flex-1 relative">
                <div className="bg-gray-100 dark:bg-gray-700 rounded-full px-3 py-2 flex items-center min-h-[40px] border border-gray-200 dark:border-gray-600">
                  <Textarea
                    ref={textareaRef}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={selectedFile ? "Add a caption..." : t('platform.messages.type_message_placeholder')}
                    className="flex-1 bg-transparent border-none outline-none resize-none text-base text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 leading-5 max-h-32 overflow-y-auto pr-2"
                    style={{ minHeight: '20px', height: 'auto', paddingLeft: '0px' }}
                    rows={1}
                    disabled={isSubmitting || isUploading}
                  />
                </div>
              </div>

              {/* Send button - far right, symmetrical to attachment */}
              <button
                onClick={selectedFile ? () => handleFileSelect(selectedFile) : handleSendMessage}
                disabled={(!newMessage.trim() && !selectedFile) || isSubmitting || isUploading}
                className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                  (!newMessage.trim() && !selectedFile) || isSubmitting || isUploading
                    ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400' 
                    : 'bg-blue-500 hover:bg-blue-600 text-white shadow-sm hover:shadow-md'
                }`}
              >
                {isSubmitting || isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {messages.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Bot className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {t('platform.messages.no_messages')}
            </h3>
            <p className="text-gray-500 mb-6">
              {t('platform.messages.no_messages_subtitle')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThreadView;