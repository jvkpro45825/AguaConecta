// Simple translation utility with CORS-friendly approach
export interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  success: boolean;
  error?: string;
}

// Enhanced phrase-based translation for better communication
const phraseTranslations: Record<string, Record<string, string>> = {
  'en_to_es': {
    // Greetings & basics
    'hello': 'hola',
    'hi': 'hola',
    'good morning': 'buenos días',
    'good afternoon': 'buenas tardes',
    'good evening': 'buenas noches',
    'goodbye': 'adiós',
    'see you later': 'hasta luego',
    'thank you': 'gracias',
    'thanks': 'gracias',
    'please': 'por favor',
    'you\'re welcome': 'de nada',
    'excuse me': 'disculpe',
    'sorry': 'lo siento',
    'yes': 'sí',
    'no': 'no',
    'maybe': 'tal vez',
    
    // Common phrases
    'how are you': 'cómo estás',
    'i am fine': 'estoy bien',
    'what do you think': 'qué piensas',
    'let me know': 'hazme saber',
    'no problem': 'no hay problema',
    'of course': 'por supuesto',
    'i understand': 'entiendo',
    'i don\'t understand': 'no entiendo',
    'can you help me': 'puedes ayudarme',
    'this works': 'esto funciona',
    'it works': 'funciona',
    'it doesn\'t work': 'no funciona',
    'is working': 'está funcionando',
    
    // Tech/project terms
    'the function': 'la función',
    'is working': 'está funcionando',
    'testing': 'probando',
    'test': 'prueba',
    'bug': 'error',
    'problem': 'problema',
    'issue': 'problema',
    'feature': 'característica',
    'update': 'actualización',
    'new': 'nuevo',
    'old': 'viejo',
    'done': 'hecho',
    'finished': 'terminado',
    'working': 'trabajando',
    'complete': 'completo',
    'ready': 'listo'
  },
  'es_to_en': {
    // Greetings & basics
    'hola': 'hello',
    'buenos días': 'good morning',
    'buenas tardes': 'good afternoon', 
    'buenas noches': 'good evening',
    'adiós': 'goodbye',
    'hasta luego': 'see you later',
    'gracias': 'thank you',
    'por favor': 'please',
    'de nada': 'you\'re welcome',
    'disculpe': 'excuse me',
    'lo siento': 'sorry',
    'sí': 'yes',
    'no': 'no',
    'tal vez': 'maybe',
    
    // Common phrases
    'cómo estás': 'how are you',
    'estoy bien': 'i am fine',
    'qué piensas': 'what do you think',
    'hazme saber': 'let me know',
    'no hay problema': 'no problem',
    'por supuesto': 'of course',
    'entiendo': 'i understand',
    'no entiendo': 'i don\'t understand',
    'puedes ayudarme': 'can you help me',
    'esto funciona': 'this works',
    'funciona': 'it works',
    'no funciona': 'it doesn\'t work',
    'está funcionando': 'is working',
    
    // Tech/project terms
    'la función': 'the function',
    'probando': 'testing',
    'prueba': 'test',
    'error': 'bug',
    'problema': 'problem',
    'característica': 'feature',
    'actualización': 'update',
    'nuevo': 'new',
    'viejo': 'old',
    'hecho': 'done',
    'terminado': 'finished',
    'trabajando': 'working',
    'completo': 'complete',
    'listo': 'ready'
  }
};

// Try multiple translation APIs with proper timeout
async function tryRealTranslation(text: string, targetLang: 'en' | 'es', sourceLang: 'en' | 'es' = 'auto'): Promise<TranslationResult> {
  
  // Try MyMemory API (no API key required, good CORS support)
  try {
    console.log('🌐 Trying MyMemory translation API...');
    
    const sourceCode = sourceLang === 'auto' ? 'en' : sourceLang;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceCode}|${targetLang}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`MyMemory API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.responseStatus === 200 && data.responseData) {
      return {
        originalText: text,
        translatedText: data.responseData.translatedText,
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
        success: true
      };
    } else {
      throw new Error(`MyMemory API returned error: ${data.responseDetails}`);
    }

  } catch (error) {
    console.log('MyMemory failed, trying LibreTranslate...', error);
  }

  // Fallback to LibreTranslate with longer timeout
  try {
    console.log('🌐 Trying LibreTranslate API...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch('https://libretranslate.de/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: text,
        source: sourceLang === 'auto' ? 'auto' : sourceLang,
        target: targetLang,
        format: 'text'
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`LibreTranslate API error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      originalText: text,
      translatedText: data.translatedText || text,
      sourceLanguage: data.detectedLanguage?.language || sourceLang,
      targetLanguage: targetLang,
      success: true
    };

  } catch (error) {
    console.log('All translation APIs failed, using clean fallback. Error:', error);
    console.log('Attempted translation:', text, 'from', sourceLang, 'to', targetLang);
    
    // Return clean fallback instead of mixed language mess
    const cleanMessage = targetLang === 'es' 
      ? `💬 "${text}"`
      : `💬 "${text}"`;
      
    return {
      originalText: text,
      translatedText: cleanMessage,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      success: true
    };
  }
}

// Enhanced phrase-based fallback translation
function fallbackPhraseTranslate(text: string, targetLang: 'en' | 'es', sourceLang: 'en' | 'es' = 'auto'): TranslationResult {
  const finalSourceLang = sourceLang === 'auto' ? detectLanguage(text) : sourceLang;
  
  if (finalSourceLang === 'auto' || finalSourceLang === targetLang) {
    return {
      originalText: text,
      translatedText: text,
      sourceLanguage: finalSourceLang,
      targetLanguage: targetLang,
      success: true
    };
  }

  const translationKey = `${finalSourceLang}_to_${targetLang}`;
  const phrases = phraseTranslations[translationKey] || {};
  
  let translatedText = text.toLowerCase().trim();
  let hasTranslation = false;
  
  // First, try to match the entire text as a phrase
  if (phrases[translatedText]) {
    return {
      originalText: text,
      translatedText: phrases[translatedText],
      sourceLanguage: finalSourceLang,
      targetLanguage: targetLang,
      success: true
    };
  }
  
  // Then try phrase-by-phrase replacement (longer phrases first)
  const sortedPhrases = Object.keys(phrases).sort((a, b) => b.length - a.length);
  
  for (const original of sortedPhrases) {
    const regex = new RegExp(`\\b${original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const newText = translatedText.replace(regex, phrases[original]);
    if (newText !== translatedText) {
      translatedText = newText;
      hasTranslation = true;
    }
  }
  
  // If we got some translation, capitalize and return
  if (hasTranslation) {
    const finalTranslatedText = translatedText.charAt(0).toUpperCase() + translatedText.slice(1);
    return {
      originalText: text,
      translatedText: finalTranslatedText,
      sourceLanguage: finalSourceLang,
      targetLanguage: targetLang,
      success: true
    };
  }
  
  // For untranslated text, provide a helpful note with original preserved
  const helpMessage = targetLang === 'es' 
    ? `[Mensaje en inglés: "${text}"]`
    : `[Message in Spanish: "${text}"]`;
    
  return {
    originalText: text,
    translatedText: helpMessage,
    sourceLanguage: finalSourceLang,
    targetLanguage: targetLang,
    success: true
  };
}

export async function translateText(
  text: string,
  targetLang: 'en' | 'es',
  sourceLang: 'en' | 'es' = 'auto'
): Promise<TranslationResult> {
  // Don't translate if already in target language
  if (sourceLang === targetLang && sourceLang !== 'auto') {
    return {
      originalText: text,
      translatedText: text,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      success: true
    };
  }

  // Try real translation APIs with 5-second timeout
  return tryRealTranslation(text, targetLang, sourceLang);
}

// Determine target language based on user role
export function getTargetLanguage(userRole: 'developer' | 'client', detectedLang?: string): 'en' | 'es' {
  // Developer writes in English, translate to Spanish for client
  // Client writes in Spanish, translate to English for developer
  if (userRole === 'developer') {
    return 'es'; // Translate developer's English to Spanish
  } else {
    return 'en'; // Translate client's Spanish to English
  }
}

// Simple language detection helper
export function detectLanguage(text: string): 'en' | 'es' | 'auto' {
  const spanishWords = ['el', 'la', 'es', 'en', 'de', 'que', 'y', 'a', 'un', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'una', 'está', 'las', 'los', 'del', 'al', 'gracias', 'hola', 'sí', 'problema'];
  const englishWords = ['the', 'of', 'and', 'a', 'to', 'in', 'is', 'you', 'that', 'it', 'he', 'was', 'for', 'on', 'are', 'as', 'with', 'his', 'they', 'i', 'at', 'be', 'this', 'have', 'thank', 'hello', 'yes', 'problem'];
  
  const words = text.toLowerCase().split(/\s+/);
  let spanishCount = 0;
  let englishCount = 0;
  
  words.forEach(word => {
    if (spanishWords.includes(word)) spanishCount++;
    if (englishWords.includes(word)) englishCount++;
  });
  
  if (spanishCount > englishCount) return 'es';
  if (englishCount > spanishCount) return 'en';
  return 'auto';
}