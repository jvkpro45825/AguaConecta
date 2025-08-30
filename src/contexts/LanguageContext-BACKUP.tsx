import React, { createContext, useContext, useState } from 'react';

type Language = 'en' | 'es';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: React.ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

// ORIGINAL BACKUP CONTENT - PRESERVED FOR ROLLBACK
const translations = {
  en: {
    // Title Slide
    'title.main': 'Clean Water,',
    'title.subtitle': 'Clear Future',
    'title.description': 'Transform your home\'s water quality with advanced purification technology',

    // Hook Slide
    'hook.title': 'Is Your Home\'s Water',
    'hook.titleHighlight': 'Really Safe?',
    'hook.stat': '40%+',
    'hook.statDescription': 'of homes may contain invisible contaminants\nthat standard testing doesn\'t reveal',
    'hook.subtitle': 'What you can\'t see might be the biggest threat to your family\'s health',

    // Problem Overview
    'problem.title': 'The',
    'problem.titleHighlight': 'Invisible Threat',
    'problem.titleSuffix': 'in Your Tap',
    'problem.pfas': 'PFAS',
    'problem.pfasDesc': 'Forever chemicals that accumulate in your body',
    'problem.bpa': 'BPA',
    'problem.bpaDesc': 'Hormone disruptor affecting development',
    'problem.chlorine': 'Chlorine',
    'problem.chlorineDesc': 'Respiratory irritant and skin sensitizer',
    'problem.conclusion': 'These contaminants are present in millions of homes across America,\noften undetected by standard water testing methods.',

    // [Additional content would continue here - this is just a backup reference]
  }
};