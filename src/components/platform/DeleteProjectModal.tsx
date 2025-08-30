import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';

interface DeleteProjectModalProps {
  projectName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

const DeleteProjectModal: React.FC<DeleteProjectModalProps> = ({
  projectName,
  onConfirm,
  onCancel,
  isDeleting = false
}) => {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {t('platform.project.delete.confirm.title')}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="p-2"
            disabled={isDeleting}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 text-sm leading-relaxed">
            {t('platform.project.delete.confirm.message').replace('{name}', projectName)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t bg-gray-50">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isDeleting}
          >
            {t('platform.project.delete.confirm.cancel')}
          </Button>
          <Button
            type="button"
            className="bg-red-600 hover:bg-red-700"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>{t('platform.project.delete.confirm.delete')}...</span>
              </div>
            ) : (
              t('platform.project.delete.confirm.delete')
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DeleteProjectModal;