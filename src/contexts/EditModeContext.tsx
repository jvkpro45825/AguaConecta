import React, { createContext, useContext, useState, useEffect } from 'react';
import { PresentationExport } from '@/types/PresentationExport';
import PresentationService from '@/services/PresentationService';

interface SlideData {
  id: string;
  type: string;
  title: string;
  content: any;
  htmlContent?: {
    titleHtml?: string;
    subtitleHtml?: string;
    descriptionHtml?: string;
    [key: string]: string | undefined;
  };
  layout?: string;
  colors?: {
    background?: string;
    text?: string;
    accent?: string;
  };
}

interface PresentationVersion {
  id: string;
  timestamp: number;
  name: string;
  slides: SlideData[];
}

interface EditModeContextType {
  isEditMode: boolean;
  toggleEditMode: () => void;
  slides: SlideData[];
  addSlide: (type: string, afterIndex?: number) => void;
  removeSlide: (index: number) => void;
  updateSlide: (index: number, updates: Partial<SlideData>) => void;
  updateSlideHtmlContent: (slideId: string, field: string, htmlContent: string) => void;
  moveSlide: (fromIndex: number, toIndex: number) => void;
  versions: PresentationVersion[];
  saveVersion: (name: string) => void;
  restoreVersion: (versionId: string) => void;
  currentPresentation: string;
  setCurrentPresentation: (type: string) => void;
  exportPresentation: () => PresentationExport;
  importPresentation: (data: PresentationExport) => Promise<void>;
}

const EditModeContext = createContext<EditModeContextType | undefined>(undefined);

const defaultSlides: SlideData[] = [
  {
    id: '1',
    type: 'title',
    title: 'Clean Water, Clear Future',
    content: {},
    htmlContent: {}
  },
  {
    id: '2',
    type: 'hook',
    title: 'What\'s Really in Your Water?',
    content: {},
    htmlContent: {
      statHtml: "<span style=\"color: #009FE3\"><span style=\"color: rgb(255, 77, 79);\"><span style=\"color: rgb(255, 77, 79);\"><span style=\"color: rgb(251, 146, 60);\">45%+</span></span></span></span>"
    }
  },
  {
    id: '3',
    type: 'pfas',
    title: 'PFAS Forever Chemicals',
    content: {}
  },
  {
    id: '4',
    type: 'local contaminants',
    title: 'Invisible Threats',
    content: {}
  },
  {
    id: '5',
    type: 'hard-water',
    title: 'Real Health Consequences',
    content: {}
  },
  {
    id: '6',
    type: 'financial',
    title: 'Stop Wasting Money',
    content: {}
  },
  {
    id: '7',
    type: 'carbon',
    title: 'Tap vs Bottled',
    content: {}
  },
  {
    id: '8',
    type: 'protection',
    title: 'Complete Protection System',
    content: {}
  },
  {
    id: '9',
    type: 'results',
    title: 'Proven Local Results',
    content: {}
  },
  {
    id: '10',
    type: 'cta',
    title: 'Take Action Today',
    content: {}
  },
  {
    id: '11',
    type: 'close',
    title: 'Let\'s Get Started',
    content: {}
  },
  {
    id: '12',
    type: 'references',
    title: 'References',
    content: {}
  }
];

export function EditModeProvider({ children }: { children: React.ReactNode }) {
  const [isEditMode, setIsEditMode] = useState(false); // Disabled for Spanish client - always false
  const [currentPresentation, setCurrentPresentation] = useState('classic');
  const [slides, setSlides] = useState<SlideData[]>(defaultSlides);
  const [versions, setVersions] = useState<PresentationVersion[]>([]);

  // Load data from localStorage on mount
  useEffect(() => {
    // Clear any old localStorage data to force use of new defaults
    localStorage.removeItem(`presentation-${currentPresentation}`);
    localStorage.removeItem('presentation-classic');
    localStorage.removeItem('presentation-premium');
    localStorage.removeItem('presentation-natural');
    localStorage.removeItem('presentation-modern');
    
    // Always use the updated default slides with your customizations
    setSlides(defaultSlides);

    const savedVersions = localStorage.getItem(`versions-${currentPresentation}`);
    if (savedVersions) {
      try {
        setVersions(JSON.parse(savedVersions));
      } catch (e) {
        console.warn('Invalid versions data, using empty array');
        setVersions([]);
      }
    }
  }, [currentPresentation]);

  // Save to localStorage whenever slides change
  useEffect(() => {
    localStorage.setItem(`presentation-${currentPresentation}`, JSON.stringify({ slides }));
  }, [slides, currentPresentation]);

  const toggleEditMode = () => {
    // Disabled for Spanish client - edit mode always stays false
    // setIsEditMode(!isEditMode);
  };

  const addSlide = (type: string, afterIndex?: number) => {
    const newSlide: SlideData = {
      id: Date.now().toString(),
      type,
      title: `New ${type} Slide`,
      content: {},
    };

    const insertIndex = afterIndex !== undefined ? afterIndex + 1 : slides.length;
    const newSlides = [...slides];
    newSlides.splice(insertIndex, 0, newSlide);
    setSlides(newSlides);
  };

  const removeSlide = (index: number) => {
    if (slides.length > 1) {
      const newSlides = slides.filter((_, i) => i !== index);
      setSlides(newSlides);
    }
  };

  const updateSlide = (index: number, updates: Partial<SlideData>) => {
    const newSlides = [...slides];
    newSlides[index] = { ...newSlides[index], ...updates };
    setSlides(newSlides);
  };

  const moveSlide = (fromIndex: number, toIndex: number) => {
    const newSlides = [...slides];
    const [movedSlide] = newSlides.splice(fromIndex, 1);
    newSlides.splice(toIndex, 0, movedSlide);
    setSlides(newSlides);
  };

  const saveVersion = (name: string) => {
    const newVersion: PresentationVersion = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      name,
      slides: [...slides],
    };
    
    const newVersions = [newVersion, ...versions].slice(0, 10); // Keep last 10 versions
    setVersions(newVersions);
    localStorage.setItem(`versions-${currentPresentation}`, JSON.stringify(newVersions));
  };

  const restoreVersion = (versionId: string) => {
    const version = versions.find(v => v.id === versionId);
    if (version) {
      setSlides(version.slides);
    }
  };

  const updateSlideHtmlContent = (slideId: string, field: string, htmlContent: string) => {
    setSlides(slides => slides.map(slide => 
      slide.id === slideId 
        ? {
            ...slide,
            htmlContent: {
              ...slide.htmlContent,
              [field]: htmlContent
            }
          }
        : slide
    ));
  };

  const exportPresentation = (): PresentationExport => {
    return PresentationService.exportPresentation(
      slides,
      versions,
      currentPresentation,
      isEditMode
    );
  };

  const importPresentation = async (data: PresentationExport): Promise<void> => {
    try {
      // Validate the data first
      const validation = PresentationService.validateImportData(data);
      if (!validation.isValid) {
        throw new Error(`Invalid import data: ${validation.errors.join(', ')}`);
      }

      // Transform the imported data
      const transformedData = PresentationService.transformImportedData(data);

      // Update the state
      setSlides(transformedData.slides);
      setVersions(transformedData.versions);
      setCurrentPresentation(transformedData.settings.currentPresentation);
      
      // Save to localStorage
      localStorage.setItem(`presentation-${transformedData.settings.currentPresentation}`, JSON.stringify({ slides: transformedData.slides }));
      localStorage.setItem(`versions-${transformedData.settings.currentPresentation}`, JSON.stringify(transformedData.versions));
      
    } catch (error) {
      console.error('Import failed in context:', error);
      throw error;
    }
  };

  return (
    <EditModeContext.Provider value={{
      isEditMode,
      toggleEditMode,
      slides,
      addSlide,
      removeSlide,
      updateSlide,
      updateSlideHtmlContent,
      moveSlide,
      versions,
      saveVersion,
      restoreVersion,
      currentPresentation,
      setCurrentPresentation,
      exportPresentation,
      importPresentation,
    }}>
      {children}
    </EditModeContext.Provider>
  );
}

export function useEditMode() {
  const context = useContext(EditModeContext);
  if (context === undefined) {
    throw new Error('useEditMode must be used within an EditModeProvider');
  }
  return context;
}