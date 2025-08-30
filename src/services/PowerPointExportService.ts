import html2canvas from 'html2canvas';
import PptxGenJS from 'pptxgenjs';

interface SlideExportData {
  id: string;
  title: string;
  htmlContent?: string;
  type: string;
}

class PowerPointExportService {
  private async captureSlideAsImage(slideElement: HTMLElement): Promise<string> {
    const canvas = await html2canvas(slideElement, {
      width: 1920,
      height: 1080,
      scale: 1,
      useCORS: true,
      backgroundColor: '#ffffff',
      allowTaint: true,
      foreignObjectRendering: true,
      logging: false
    });
    
    return canvas.toDataURL('image/png', 0.9);
  }

  private async renderSlideOffScreen(slideData: SlideExportData, slideComponent: any): Promise<HTMLElement> {
    const container = document.createElement('div');
    container.style.cssText = `
      position: absolute;
      left: -9999px;
      top: 0;
      width: 1920px;
      height: 1080px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      overflow: hidden;
      padding: 60px;
      box-sizing: border-box;
      font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
    `;
    
    // Create slide content wrapper
    const slideContent = document.createElement('div');
    slideContent.style.cssText = `
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
    `;
    
    // Add slide title
    const titleElement = document.createElement('h1');
    titleElement.style.cssText = `
      font-size: 72px;
      font-weight: bold;
      color: #ffffff;
      margin: 0 0 40px 0;
      line-height: 1.2;
      text-shadow: 0 2px 4px rgba(0,0,0,0.3);
    `;
    
    // Use HTML content if available, otherwise use plain title
    if (slideData.htmlContent) {
      titleElement.innerHTML = slideData.htmlContent;
    } else {
      titleElement.textContent = slideData.title;
    }
    
    // Add slide type indicator
    const typeIndicator = document.createElement('div');
    typeIndicator.style.cssText = `
      position: absolute;
      top: 40px;
      right: 40px;
      background: rgba(255,255,255,0.1);
      color: #ffffff;
      padding: 10px 20px;
      border-radius: 20px;
      font-size: 16px;
      font-weight: 500;
      backdrop-filter: blur(10px);
    `;
    typeIndicator.textContent = slideData.type.toUpperCase();
    
    // Add decorative elements
    const decorator = document.createElement('div');
    decorator.style.cssText = `
      width: 100px;
      height: 4px;
      background: linear-gradient(90deg, #009FE3, #FFD600);
      margin: 40px auto 0 auto;
      border-radius: 2px;
    `;
    
    slideContent.appendChild(titleElement);
    slideContent.appendChild(decorator);
    container.appendChild(slideContent);
    container.appendChild(typeIndicator);
    
    document.body.appendChild(container);
    
    return container;
  }

  async exportToPowerPoint(slides: SlideExportData[], filename: string = 'water-presentation.pptx'): Promise<void> {
    const pptx = new PptxGenJS();
    
    // Set presentation properties
    pptx.author = 'Water Filtration Presentation';
    pptx.company = 'Clean Future Visuals';
    pptx.title = 'Water Safety & Filtration Solutions';
    pptx.subject = 'Water Quality Presentation';
    
    // Define slide layout
    pptx.defineLayout({ 
      name: 'LAYOUT_16x9', 
      width: 13.33, 
      height: 7.5 
    });
    
    for (let i = 0; i < slides.length; i++) {
      const slideData = slides[i];
      
      try {
        console.log(`Processing slide ${i + 1}/${slides.length}: ${slideData.title}`);
        
        const slideElement = await this.renderSlideOffScreen(slideData, null);
        
        // Wait for fonts and styles to load
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const imageData = await this.captureSlideAsImage(slideElement);
        
        const pptxSlide = pptx.addSlide();
        pptxSlide.addImage({
          data: imageData,
          x: 0,
          y: 0,
          w: '100%',
          h: '100%'
        });
        
        // Add slide notes
        pptxSlide.addNotes(`Slide ${i + 1}: ${slideData.title}\nType: ${slideData.type}`);
        
        // Cleanup
        document.body.removeChild(slideElement);
        
      } catch (error) {
        console.error(`Failed to process slide ${i + 1}:`, error);
        
        // Create fallback slide with text only
        const fallbackSlide = pptx.addSlide();
        fallbackSlide.addText(slideData.title, {
          x: 1,
          y: 3,
          w: 11.33,
          h: 1.5,
          fontSize: 44,
          bold: true,
          color: '333333',
          align: 'center'
        });
        
        fallbackSlide.addText(`Error rendering slide: ${slideData.type}`, {
          x: 1,
          y: 5,
          w: 11.33,
          h: 1,
          fontSize: 18,
          color: '666666',
          align: 'center'
        });
      }
    }
    
    console.log('Generating PowerPoint file...');
    await pptx.writeFile(filename);
    console.log(`PowerPoint export complete: ${filename}`);
  }

  // Export current presentation state
  async exportCurrentPresentation(presentationType: string = 'classic'): Promise<void> {
    // This will be called from the UI component with actual slide data
    const defaultSlides: SlideExportData[] = [
      { id: '1', title: 'Clean Water, Clear Future', type: 'title', htmlContent: '<span style="color: #009FE3">Clean Water</span>, Clear Future' },
      { id: '2', title: 'Is Your Home\'s Water Really Safe?', type: 'hook', htmlContent: 'Is Your Home\'s Water <span style="color: #009FE3">Really Safe?</span>' },
      { id: '3', title: 'The Invisible Threat in Your Tap', type: 'problem', htmlContent: 'The <span style="color: #009FE3">Invisible Threat</span> in Your Tap' },
      { id: '4', title: 'What\'s Really in Your Water?', type: 'contaminants' },
      { id: '5', title: 'The Hidden Cost to Your Health', type: 'health' },
      { id: '6', title: 'Old Paradigm vs. New Solution', type: 'comparison' },
      { id: '7', title: 'Pure Water, Pure Life', type: 'solution' },
      { id: '8', title: 'Life-Changing Benefits', type: 'benefits' },
      { id: '9', title: 'Certified Excellence', type: 'certifications' },
      { id: '10', title: 'Your Family Deserves Pure Water Today', type: 'cta' },
      { id: '11', title: 'References & Sources', type: 'references' }
    ];
    
    await this.exportToPowerPoint(defaultSlides, `water-presentation-${presentationType}.pptx`);
  }
}

export default new PowerPointExportService();