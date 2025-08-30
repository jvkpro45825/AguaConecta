import React, { createContext, useContext, useState, useCallback } from 'react';

interface TextFormattingContextType {
  // Active text selection state
  hasActiveSelection: boolean;
  selectedText: string;
  activeEditorId: string | null;
  
  // Formatting functions
  applyColor: (color: string) => void;
  applyFormatting: (command: string) => void;
  
  // Registration functions for editors
  registerEditor: (editorId: string, applyColorFn: (color: string) => void, applyFormattingFn: (command: string) => void) => void;
  unregisterEditor: (editorId: string) => void;
  setActiveEditor: (editorId: string, selectedText?: string) => void;
  clearActiveEditor: () => void;
}

const TextFormattingContext = createContext<TextFormattingContextType | undefined>(undefined);

interface EditorCallbacks {
  applyColor: (color: string) => void;
  applyFormatting: (command: string) => void;
}

export function TextFormattingProvider({ children }: { children: React.ReactNode }) {
  const [hasActiveSelection, setHasActiveSelection] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [activeEditorId, setActiveEditorId] = useState<string | null>(null);
  const [registeredEditors, setRegisteredEditors] = useState<Map<string, EditorCallbacks>>(new Map());

  const registerEditor = useCallback((
    editorId: string, 
    applyColorFn: (color: string) => void, 
    applyFormattingFn: (command: string) => void
  ) => {
    setRegisteredEditors(prev => {
      const newMap = new Map(prev);
      newMap.set(editorId, {
        applyColor: applyColorFn,
        applyFormatting: applyFormattingFn
      });
      return newMap;
    });
  }, []);

  const unregisterEditor = useCallback((editorId: string) => {
    setRegisteredEditors(prev => {
      const newMap = new Map(prev);
      newMap.delete(editorId);
      return newMap;
    });
    
    if (activeEditorId === editorId) {
      setActiveEditorId(null);
      setHasActiveSelection(false);
      setSelectedText('');
    }
  }, [activeEditorId]);

  const setActiveEditor = useCallback((editorId: string, selectedText: string = '') => {
    setActiveEditorId(editorId);
    setSelectedText(selectedText);
    setHasActiveSelection(selectedText.length > 0);
  }, []);

  const clearActiveEditor = useCallback(() => {
    setActiveEditorId(null);
    setSelectedText('');
    setHasActiveSelection(false);
  }, []);

  const applyColor = useCallback((color: string) => {
    console.log('TextFormattingContext.applyColor called:', color, 'activeEditorId:', activeEditorId);
    if (activeEditorId && registeredEditors.has(activeEditorId)) {
      console.log('Found registered editor, calling applyColor');
      const editor = registeredEditors.get(activeEditorId);
      editor?.applyColor(color);
    } else {
      console.log('No active editor or editor not registered');
    }
  }, [activeEditorId, registeredEditors]);

  const applyFormatting = useCallback((command: string) => {
    if (activeEditorId && registeredEditors.has(activeEditorId)) {
      const editor = registeredEditors.get(activeEditorId);
      editor?.applyFormatting(command);
    }
  }, [activeEditorId, registeredEditors]);

  return (
    <TextFormattingContext.Provider value={{
      hasActiveSelection,
      selectedText,
      activeEditorId,
      applyColor,
      applyFormatting,
      registerEditor,
      unregisterEditor,
      setActiveEditor,
      clearActiveEditor,
    }}>
      {children}
    </TextFormattingContext.Provider>
  );
}

export function useTextFormatting() {
  const context = useContext(TextFormattingContext);
  if (context === undefined) {
    throw new Error('useTextFormatting must be used within a TextFormattingProvider');
  }
  return context;
}

export default TextFormattingContext;