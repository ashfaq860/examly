// services/layoutConfigEngine.ts

import { 
  LayoutConfig, 
  ContentFlow, 
  PaperSides, 
  Imposition, 
  ImpositionConfig,
  DuplexConfig,
  PaperGenerationConfig 
} from '@/types/paperConfig';
import { PaperSection } from '@/types/paperBuilderTypes';

/**
 * Layout Configuration Engine
 * Converts UI selections to structured layout configurations
 */
export class LayoutConfigEngine {
  
  /**
   * Convert legacy layout type to new config
   */
  static fromLegacyType(legacyType: string, cutMarks = false): LayoutConfig {
    const baseImposition: ImpositionConfig = {
      type: 'single',
      pagesPerSheet: 1,
      cutMarks: false,
      spacing: 0
    };

    switch (legacyType) {
      case 'same_page':
      case 'combined':
        return {
          contentFlow: 'same_page',
          sides: 'single',
          imposition: baseImposition,
          duplex: { enabled: false, mode: 'front_only' },
          legacyType: 'same_page'
        };

      case 'separate':
        return {
          contentFlow: 'separate_page',
          sides: 'single',
          imposition: baseImposition,
          duplex: { enabled: false, mode: 'front_only' },
          legacyType: 'separate'
        };

      case 'two_papers':
        return {
          contentFlow: 'separate_page',
          sides: 'single',
          imposition: {
            type: 'vertical',
            pagesPerSheet: 2,
            rows: 2,
            cols: 1,
            cutMarks,
            spacing: 2
          },
          duplex: { enabled: false, mode: 'front_only' },
          legacyType: 'two_papers'
        };

      case 'three_papers':
        return {
          contentFlow: 'separate_page',
          sides: 'single',
          imposition: {
            type: 'vertical',
            pagesPerSheet: 3,
            rows: 3,
            cols: 1,
            cutMarks,
            spacing: 2
          },
          duplex: { enabled: false, mode: 'front_only' },
          legacyType: 'three_papers'
        };

      default:
        return {
          contentFlow: 'separate_page',
          sides: 'single',
          imposition: baseImposition,
          duplex: { enabled: false, mode: 'front_only' }
        };
    }
  }

  /**
   * Create custom layout configuration
   */
  static createCustom(
    contentFlow: ContentFlow,
    impositionPages: Imposition = 1,
    cutMarks = false,
    sides: PaperSides = 'single',
    duplexMode: 'front_only' | 'front_back_mirror' = 'front_only'
  ): LayoutConfig {
    const impositionConfig = LayoutConfigEngine.getImpositionConfig(impositionPages, cutMarks);

    return {
      contentFlow,
      sides,
      imposition: impositionConfig,
      duplex: {
        enabled: sides === 'front_back',
        mode: sides === 'front_back' ? duplexMode : 'front_only'
      }
    };
  }

  /**
   * Get imposition configuration based on pages per sheet
   */
  private static getImpositionConfig(pages: Imposition, cutMarks: boolean): ImpositionConfig {
    switch (pages) {
      case 1:
        return {
          type: 'single',
          pagesPerSheet: 1,
          cutMarks: false,
          spacing: 0
        };
      
      case 2:
        return {
          type: 'vertical', // Could be horizontal based on preference
          pagesPerSheet: 2,
          rows: 2,
          cols: 1,
          cutMarks,
          spacing: 2
        };
      
      case 3:
        return {
          type: 'vertical',
          pagesPerSheet: 3,
          rows: 3,
          cols: 1,
          cutMarks,
          spacing: 2
        };
      
      case 4:
        return {
          type: 'grid',
          pagesPerSheet: 4,
          rows: 2,
          cols: 2,
          cutMarks,
          spacing: 2
        };
    }
  }

  /**
   * Calculate page dimensions based on imposition
   */
  static calculatePageDimensions(config: ImpositionConfig): {
    width: string;
    height: string;
    scale: number;
  } {
    const A4_WIDTH = '210mm';
    const A4_HEIGHT = '297mm';
    
    switch (config.type) {
      case 'single':
        return {
          width: A4_WIDTH,
          height: A4_HEIGHT,
          scale: 1
        };
      
      case 'vertical':
        return {
          width: A4_WIDTH,
          height: `calc(${A4_HEIGHT} / ${config.pagesPerSheet})`,
          scale: 1 / config.pagesPerSheet
        };
      
      case 'horizontal':
        return {
          width: `calc(${A4_WIDTH} / ${config.pagesPerSheet})`,
          height: A4_HEIGHT,
          scale: 1 / config.pagesPerSheet
        };
      
      case 'grid':
        return {
          width: `calc(${A4_WIDTH} / ${config.cols})`,
          height: `calc(${A4_HEIGHT} / ${config.rows})`,
          scale: 1 / Math.max(config.rows || 2, config.cols || 2)
        };
    }
  }

  /**
   * Split content into pages based on layout config
   */
  static splitContent(
    mcqSections: PaperSection[],
    subjectiveSections: PaperSection[],
    config: LayoutConfig
  ): Array<{
    sections: PaperSection[];
    marks: number;
    type: 'mcq' | 'subjective' | 'mixed';
  }> {
    const pages: Array<{
      sections: PaperSection[];
      marks: number;
      type: 'mcq' | 'subjective' | 'mixed';
    }> = [];

    const calculateMarks = (sections: PaperSection[]) => 
      sections.reduce((sum, s) => sum + (s.totalMarks || 0), 0);

    if (config.contentFlow === 'same_page') {
      // Single page with both MCQ and Subjective
      const combined = [...mcqSections, ...subjectiveSections];
      if (combined.length > 0) {
        pages.push({
          sections: combined,
          marks: calculateMarks(combined),
          type: 'mixed'
        });
      }
    } else {
      // Separate pages for MCQ and Subjective
      if (mcqSections.length > 0) {
        pages.push({
          sections: mcqSections,
          marks: calculateMarks(mcqSections),
          type: 'mcq'
        });
      }
      
      if (subjectiveSections.length > 0) {
        pages.push({
          sections: subjectiveSections,
          marks: calculateMarks(subjectiveSections),
          type: 'subjective'
        });
      }
    }

    return pages;
  }

  /**
   * Generate complete paper configuration
   */
  static generatePaperConfig(
    sections: PaperSection[],
    layoutType: string,
    language: string,
    metadata: {
      title?: string;
      subject?: string;
      className?: string;
    } = {}
  ): PaperGenerationConfig {
    const layoutConfig = LayoutConfigEngine.fromLegacyType(layoutType);
    
    const mcqs = sections.filter(s => s.type === 'mcq');
    const subjectives = sections.filter(s => s.type !== 'mcq');
    
    return {
      layout: layoutConfig,
      language: language as 'english' | 'urdu' | 'bilingual',
      content: sections,
      metadata: {
        title: metadata.title || 'Question Paper',
        subject: metadata.subject || '',
        class: metadata.className || '',
        totalMarks: sections.reduce((sum, s) => sum + (s.totalMarks || 0), 0),
        totalQuestions: sections.reduce((sum, s) => sum + (s.totalQuestions || 0), 0)
      }
    };
  }
}