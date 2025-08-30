import React, { useState } from 'react';
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { X, Folder, Presentation, CreditCard, Target, Globe } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';

interface NewProjectModalProps {
  clientId: string;
  onClose: () => void;
  onProjectCreated: (projectId: string) => void;
}

const NewProjectModal: React.FC<NewProjectModalProps> = ({
  clientId,
  onClose,
  onProjectCreated
}) => {
  const { t } = useLanguage();

  const projectTypes = [
    {
      id: 'presentation',
      name: t('platform.type.presentation'),
      description: t('platform.type.presentation.description'),
      icon: <Presentation className="w-6 h-6" />,
      color: '#0EA5E9',
      emoji: '📊'
    },
    {
      id: 'cards',
      name: t('platform.type.cards'),
      description: t('platform.type.cards.description'),
      icon: <CreditCard className="w-6 h-6" />,
      color: '#10B981',
      emoji: '🃏'
    },
    {
      id: 'lead_gen',
      name: t('platform.type.lead_gen'),
      description: t('platform.type.lead_gen.description'),
      icon: <Target className="w-6 h-6" />,
      color: '#F59E0B',
      emoji: '🎯'
    },
    {
      id: 'website',
      name: t('platform.type.website'),
      description: t('platform.type.website.description'),
      icon: <Globe className="w-6 h-6" />,
      color: '#8B5CF6',
      emoji: '🌐'
    },
    {
      id: 'other',
      name: t('platform.type.other'),
      description: t('platform.type.other.description'),
      icon: <Folder className="w-6 h-6" />,
      color: '#6B7280',
      emoji: '📁'
    }
  ];
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'presentation' as const,
    priority: 'medium' as const
  });
  const [selectedType, setSelectedType] = useState('presentation');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createProject = useMutation(api.projects.createProject);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const selectedProjectType = projectTypes.find(t => t.id === selectedType);
      
      const projectId = await createProject({
        client_id: clientId as any,
        name: formData.name.trim(),
        type: selectedType as any,
        icon: selectedProjectType?.emoji || '📁',
        color: selectedProjectType?.color || '#6B7280',
        description: formData.description.trim() || undefined,
        priority: formData.priority as any,
      });

      onProjectCreated(projectId);
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTypeSelect = (typeId: string) => {
    setSelectedType(typeId);
    setFormData(prev => ({ ...prev, type: typeId as any }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('platform.project.create.title')}
          </h2>
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
          {/* Project Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('platform.project.create.name')}
            </label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('platform.project.create.name.placeholder')}
              className="w-full"
              required
            />
          </div>

          {/* Project Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              {t('platform.project.create.type')}
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {projectTypes.map((type) => (
                <Card
                  key={type.id}
                  className={`cursor-pointer transition-all duration-200 bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 ${
                    selectedType === type.id
                      ? 'ring-2 ring-blue-500 shadow-md'
                      : 'hover:shadow-sm dark:hover:shadow-gray-900/20'
                  }`}
                  onClick={() => handleTypeSelect(type.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                        style={{ backgroundColor: type.color }}
                      >
                        {type.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 dark:text-white text-sm">
                          {type.name}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {type.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('platform.project.create.description')}
            </label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder={t('platform.project.create.description.placeholder')}
              className="w-full"
              rows={3}
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('platform.project.create.priority')}
            </label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="low">{t('platform.project.create.priority.low')}</option>
              <option value="medium">{t('platform.project.create.priority.medium')}</option>
              <option value="high">{t('platform.project.create.priority.high')}</option>
              <option value="urgent">{t('platform.project.create.priority.urgent')}</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t('platform.project.create.cancel')}
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!formData.name.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>{t('platform.project.create.creating')}</span>
                </div>
              ) : (
                t('platform.project.create.submit')
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewProjectModal;