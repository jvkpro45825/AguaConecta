import React from 'react';
import FootnoteLink from '@/components/FootnoteLink';

// Map superscript characters to numbers
const superscriptMap: { [key: string]: number } = {
  '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9,
  '¹⁰': 10, '¹¹': 11, '¹²': 12, '¹³': 13, '¹⁴': 14, '¹⁵': 15, '¹⁶': 16,
  '¹⁷': 17, '¹⁸': 18, '¹⁹': 19, '²⁰': 20, '²¹': 21, '²²': 22
};

/**
 * Parses text containing superscript footnote characters and converts them to clickable FootnoteLink components
 * @param text - The text containing superscript footnotes
 * @returns JSX with footnotes converted to clickable links
 */
export const parseFootnotes = (text: string): React.ReactNode => {
  // If no superscript characters found, return original text
  const footnotePattern = /[¹²³⁴⁵⁶⁷⁸⁹]|¹[⁰¹²³⁴⁵⁶⁷⁸⁹]|²[⁰¹²]/g;
  const matches = text.match(footnotePattern);
  
  if (!matches) {
    return text;
  }

  // Split text by footnotes and create components
  const parts = text.split(footnotePattern);
  const result: React.ReactNode[] = [];

  parts.forEach((part, index) => {
    // Add the text part
    if (part) {
      result.push(part);
    }
    
    // Add the footnote link if there's a corresponding match
    if (matches[index]) {
      const footnoteNumber = superscriptMap[matches[index]];
      if (footnoteNumber) {
        result.push(
          <FootnoteLink 
            key={`footnote-${footnoteNumber}-${index}`}
            number={footnoteNumber}
          />
        );
      }
    }
  });

  return <>{result}</>;
};

/**
 * Simple function to extract just the footnote numbers from text (for simpler cases)
 * @param text - Text containing superscript footnotes
 * @returns Array of footnote numbers found
 */
export const extractFootnoteNumbers = (text: string): number[] => {
  const footnotePattern = /[¹²³⁴⁵⁶⁷⁸⁹]|¹[⁰¹²³⁴⁵⁶⁷⁸⁹]|²[⁰¹²]/g;
  const matches = text.match(footnotePattern);
  
  if (!matches) return [];
  
  return matches.map(match => superscriptMap[match]).filter(num => num !== undefined);
};