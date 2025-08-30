import { 
  PresentationExport, 
  SlideExportData, 
  VersionExportData, 
  ImportValidationResult,
  EXPORT_VERSION,
  SUPPORTED_IMPORT_VERSIONS 
} from '@/types/PresentationExport';

class PresentationService {
  /**
   * Export current presentation state to a standardized format
   */
  exportPresentation(
    slides: any[], 
    versions: any[], 
    currentPresentation: string,
    isEditMode: boolean
  ): PresentationExport {
    const exportData: PresentationExport = {
      metadata: {
        version: EXPORT_VERSION,
        timestamp: Date.now(),
        presentationType: currentPresentation,
        exportedBy: 'Clean Future Visuals Web',
        appVersion: '1.0.0'
      },
      slides: slides.map(slide => this.transformSlideForExport(slide)),
      versions: versions.map(version => this.transformVersionForExport(version)),
      settings: {
        currentPresentation,
        isEditMode
      }
    };

    return exportData;
  }

  /**
   * Download presentation data as JSON file
   */
  downloadPresentationFile(exportData: PresentationExport, filename?: string): void {
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || this.generateFilename(exportData.metadata.presentationType);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  /**
   * Read and parse JSON file from file input
   */
  async readPresentationFile(file: File): Promise<PresentationExport> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const result = event.target?.result as string;
          const data = JSON.parse(result);
          resolve(data);
        } catch (error) {
          reject(new Error(`Failed to parse JSON file: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsText(file);
    });
  }

  /**
   * Validate imported presentation data
   */
  validateImportData(data: any): ImportValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if data exists and is an object
    if (!data || typeof data !== 'object') {
      errors.push('Invalid file format: Expected JSON object');
      return { isValid: false, errors, warnings };
    }

    // Check required top-level properties
    if (!data.metadata) {
      errors.push('Missing metadata section');
    } else {
      // Validate metadata
      if (!data.metadata.version) {
        errors.push('Missing version in metadata');
      } else if (!SUPPORTED_IMPORT_VERSIONS.includes(data.metadata.version)) {
        errors.push(`Unsupported version: ${data.metadata.version}. Supported versions: ${SUPPORTED_IMPORT_VERSIONS.join(', ')}`);
      }

      if (!data.metadata.timestamp || typeof data.metadata.timestamp !== 'number') {
        warnings.push('Invalid or missing timestamp in metadata');
      }

      if (!data.metadata.presentationType) {
        warnings.push('Missing presentation type in metadata');
      }
    }

    if (!data.slides || !Array.isArray(data.slides)) {
      errors.push('Missing or invalid slides array');
    } else {
      // Validate slides structure
      data.slides.forEach((slide: any, index: number) => {
        if (!slide.id) {
          errors.push(`Slide ${index + 1}: Missing id`);
        }
        if (!slide.type) {
          errors.push(`Slide ${index + 1}: Missing type`);
        }
        if (!slide.title) {
          warnings.push(`Slide ${index + 1}: Missing title`);
        }
      });
    }

    if (!data.versions || !Array.isArray(data.versions)) {
      warnings.push('Missing or invalid versions array - version history will be empty');
    }

    if (!data.settings || typeof data.settings !== 'object') {
      warnings.push('Missing settings - will use defaults');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Transform slide data for export (ensure compatibility)
   */
  private transformSlideForExport(slide: any): SlideExportData {
    return {
      id: slide.id,
      type: slide.type,
      title: slide.title,
      content: slide.content || {},
      htmlContent: slide.htmlContent,
      layout: slide.layout,
      colors: slide.colors
    };
  }

  /**
   * Transform version data for export
   */
  private transformVersionForExport(version: any): VersionExportData {
    return {
      id: version.id,
      timestamp: version.timestamp,
      name: version.name,
      slides: version.slides.map((slide: any) => this.transformSlideForExport(slide))
    };
  }

  /**
   * Generate filename based on presentation type and timestamp
   */
  private generateFilename(presentationType: string): string {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return `presentation-${presentationType}-${timestamp}.cfv`;
  }

  /**
   * Transform imported data for use in EditModeContext
   */
  transformImportedData(exportData: PresentationExport) {
    return {
      slides: exportData.slides,
      versions: exportData.versions || [],
      settings: {
        currentPresentation: exportData.settings?.currentPresentation || exportData.metadata.presentationType,
        isEditMode: exportData.settings?.isEditMode || false
      },
      metadata: exportData.metadata
    };
  }

  /**
   * Create import summary for user display
   */
  createImportSummary(exportData: PresentationExport) {
    return {
      slideCount: exportData.slides.length,
      versionCount: exportData.versions.length,
      presentationType: exportData.metadata.presentationType,
      exportDate: new Date(exportData.metadata.timestamp).toLocaleDateString(),
      exportedBy: exportData.metadata.exportedBy
    };
  }
}

export default new PresentationService();