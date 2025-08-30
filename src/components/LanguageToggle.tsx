import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';

const LanguageToggle = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="fixed top-4 left-4 z-50">
      <div className="glass-card px-2 py-1 flex flex-col gap-1" data-testid="language-toggle">
        <Button
          variant={language === 'en' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setLanguage('en')}
          className="text-xs font-medium px-2 py-1 h-auto"
        >
          🇺🇸 English
        </Button>
        <Button
          variant={language === 'es' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setLanguage('es')}
          className="text-xs font-medium px-2 py-1 h-auto"
        >
          🇪🇸 Español
        </Button>
      </div>
    </div>
  );
};

export default LanguageToggle;