import React, { useState } from 'react';
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { X, MessageCircle, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { translateText, detectLanguage, getTargetLanguage } from '@/utils/translation';

interface NewThreadModalProps {
  projectId: string;
  onClose: () => void;
  onThreadCreated: (threadId: string) => void;
  userRole?: 'client' | 'developer';
}

const getThreadCategories = (t: any) => [
  {
    id: 'question',
    title: t('platform.category.question'),
    description: t('platform.category.question.description'),
    icon: '❓',
    color: '#0EA5E9',
    placeholder: t('platform.category.question.placeholder')
  },
  {
    id: 'feedback',
    title: t('platform.category.feedback'),
    description: t('platform.category.feedback.description'),
    icon: '💭',
    color: '#10B981',
    placeholder: t('platform.category.feedback.placeholder')
  },
  {
    id: 'issue',
    title: t('platform.category.issue'),
    description: t('platform.category.issue.description'),
    icon: '🐛',
    color: '#F59E0B',
    placeholder: t('platform.category.issue.placeholder')
  },
  {
    id: 'request',
    title: t('platform.category.request'),
    description: t('platform.category.request.description'),
    icon: '🔧',
    color: '#8B5CF6',
    placeholder: t('platform.category.request.placeholder')
  },
  {
    id: 'general',
    title: t('platform.category.general'),
    description: t('platform.category.general.description'),
    icon: '💬',
    color: '#6B7280',
    placeholder: t('platform.category.general.placeholder')
  }
];

const NewThreadModal: React.FC<NewThreadModalProps> = ({
  projectId,
  onClose,
  onThreadCreated,
  userRole = 'client'
}) => {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    priority: 'normal' as const,
    category: 'general'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const project = useQuery(api.projects.getProject, 
    projectId ? { project_id: projectId as any } : "skip"
  );
  
  const createThread = useMutation(api.threads.createThread);
  
  const threadCategories = getThreadCategories(t);
  const selectedCategory = threadCategories.find(c => c.id === formData.category) || threadCategories[4];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.message.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const originalMessage = formData.message.trim();
      
      // Auto-translate message using same logic as ThreadView
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
          console.log('🔄 Attempting translation for new thread:', {
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
            console.warn('Translation failed:', result.error);
            translationData.translation_enabled = false;
          }
        } catch (translationError) {
          console.warn('Translation service error:', translationError);
          translationData.translation_enabled = false;
        }
      }

      const threadId = await createThread({
        project_id: projectId as any,
        title: formData.title.trim(),
        priority: formData.priority as any,
        initial_message: originalMessage,
        created_by: userRole,
        // Add translation data
        original_content: translationData.original_content,
        original_language: translationData.original_language as any,
        translated_content: translationData.translated_content,
        target_language: translationData.target_language as any,
        translation_enabled: translationData.translation_enabled,
      });

      onThreadCreated(threadId);
    } catch (error) {
      console.error('Error creating thread:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCategorySelect = (categoryId: string) => {
    const category = threadCategories.find(c => c.id === categoryId);
    setFormData(prev => ({ 
      ...prev, 
      category: categoryId,
      title: category?.id === 'issue' && prev.title === '' ? '🐛 ' : prev.title,
      priority: category?.id === 'issue' ? 'urgent' : prev.priority
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t('platform.thread.create.title')}
            </h2>
            {project && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t('platform.thread.create.in')} {project.name}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="p-2"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              {t('platform.thread.create.category')}
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {threadCategories.map((category) => (
                <Card
                  key={category.id}
                  className={`cursor-pointer transition-all duration-200 bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 ${
                    formData.category === category.id
                      ? 'ring-2 ring-blue-500 shadow-md'
                      : 'hover:shadow-sm dark:hover:bg-gray-600'
                  }`}
                  onClick={() => handleCategorySelect(category.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start space-x-3">
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm"
                        style={{ backgroundColor: category.color }}
                      >
                        {category.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 dark:text-white text-sm">
                          {category.title}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {category.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Thread Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('platform.thread.create.thread_title')}
            </label>
            <Input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder={t('platform.thread.create.thread_title.placeholder')}
              className="w-full bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              required
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('platform.thread.create.message')}
            </label>
            <Textarea
              value={formData.message}
              onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
              placeholder={selectedCategory.placeholder}
              className="w-full bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              rows={4}
              required
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('platform.thread.create.priority')}
            </label>
            <div className="flex items-center space-x-3">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="normal"
                  checked={formData.priority === 'normal'}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as any }))}
                  className="mr-2 text-blue-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-blue-600"
                />
                <span className="text-sm text-gray-900 dark:text-white">{t('platform.thread.create.priority.normal')}</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="urgent"
                  checked={formData.priority === 'urgent'}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as any }))}
                  className="mr-2 text-red-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-red-500 dark:focus:ring-red-600"
                />
                <div className="flex items-center">
                  <AlertTriangle className="w-4 h-4 text-red-500 mr-1" />
                  <span className="text-sm text-red-600 dark:text-red-400">{t('platform.thread.create.priority.urgent')}</span>
                </div>
              </label>
            </div>
          </div>

          {/* Info Note */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <MessageCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <p className="font-medium mb-1">{t('platform.thread.create.info')}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  {t('platform.thread.create.info.description')}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t('platform.thread.create.cancel')}
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!formData.title.trim() || !formData.message.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>{t('platform.thread.create.creating')}</span>
                </div>
              ) : (
                t('platform.thread.create.submit')
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewThreadModal;