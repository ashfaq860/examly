import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper function to sort questions based on selected order
function sortQuestionsByOrder(questions: any[], selectedIds: string[]): any[] {
  return questions.sort((a, b) => {
    return selectedIds.indexOf(a.id) - selectedIds.indexOf(b.id);
  });
}

// Function to map frontend source_type to database source_type
function mapSourceType(sourceType: string): string {
  const sourceTypeMap: Record<string, string> = {
    'model': 'model_paper',
    'past': 'past_paper',
    'book': 'book',
    'all': 'all'
  };
  
  return sourceTypeMap[sourceType] || sourceType;
}

// Function to replicate the same question selection logic as generate-paper
async function findQuestionsWithFallback(
  supabase: any,
  type: string,
  subjectId: string,
  chapterIds: string[],
  source_type: string | undefined,
  difficulty: string | undefined,
  count: number
) {
  console.log(`\n🔍 Finding ${count} ${type} questions with fallback...`);
  console.log(`📋 Filters: source_type=${source_type}, difficulty=${difficulty}`);
  
  // Map source_type to database values
  const dbSourceType = source_type ? mapSourceType(source_type) : undefined;
  
  // Try with all filters first - USING THE SAME ORDERING AS GENERATE-PAPER
  let query = supabase
    .from('questions')
    .select('id')
    .eq('question_type', type)
    .eq('subject_id', subjectId);

  if (chapterIds.length > 0) {
    query = query.in('chapter_id', chapterIds);
  }
  
  // Filter by source type if specified and not 'all'
  if (dbSourceType && dbSourceType !== 'all') {
    query = query.eq('source_type', dbSourceType);
  }
  
  if (difficulty && difficulty !== 'any') {
    query = query.eq('difficulty', difficulty);
  }

  // CRITICAL: Use the same ordering as generate-paper
  query = query.order('id', { ascending: false }).limit(count);
  const { data: questions, error } = await query;

  if (error) {
    console.error(`Error in initial query:`, error);
    return [];
  }

  if (questions && questions.length >= count) {
    console.log(`✅ Found ${questions.length} questions with all filters`);
    return questions;
  }

  // Fallback 1: Remove difficulty filter
  console.log(`🔄 Fallback 1: Removing difficulty filter for ${type}`);
  let fallbackQuery = supabase
    .from('questions')
    .select('id')
    .eq('question_type', type)
    .eq('subject_id', subjectId);

  if (chapterIds.length > 0) {
    fallbackQuery = fallbackQuery.in('chapter_id', chapterIds);
  }
  
  // Keep source type filter if specified
  if (dbSourceType && dbSourceType !== 'all') {
    fallbackQuery = fallbackQuery.eq('source_type', dbSourceType);
  }

  // CRITICAL: Use the same ordering as generate-paper
  fallbackQuery = fallbackQuery.order('id', { ascending: false }).limit(count);
  const { data: fallbackQuestions1 } = await fallbackQuery;

  if (fallbackQuestions1 && fallbackQuestions1.length >= count) {
    console.log(`✅ Found ${fallbackQuestions1.length} questions without difficulty filter`);
    return fallbackQuestions1;
  }

  // Fallback 2: Remove source type filter (only if it was specified)
  if (dbSourceType && dbSourceType !== 'all') {
    console.log(`🔄 Fallback 2: Removing source type filter for ${type}`);
    let fallbackQuery2 = supabase
      .from('questions')
      .select('id')
      .eq('question_type', type)
      .eq('subject_id', subjectId);

    if (chapterIds.length > 0) {
      fallbackQuery2 = fallbackQuery2.in('chapter_id', chapterIds);
    }

    // CRITICAL: Use the same ordering as generate-paper
    fallbackQuery2 = fallbackQuery2.order('id', { ascending: false }).limit(count);
    const { data: fallbackQuestions2 } = await fallbackQuery2;

    if (fallbackQuestions2 && fallbackQuestions2.length >= count) {
      console.log(`✅ Found ${fallbackQuestions2.length} questions without source type filter`);
      return fallbackQuestions2;
    }
  }

  // Fallback 3: Only subject and type filter
  console.log(`🔄 Fallback 3: Using only subject and type filter for ${type}`);
  const { data: fallbackQuestions3 } = await supabase
    .from('questions')
    .select('id')
    .eq('question_type', type)
    .eq('subject_id', subjectId)
    // CRITICAL: Use the same ordering as generate-paper
    .order('id', { ascending: false })
    .limit(count);

  if (fallbackQuestions3 && fallbackQuestions3.length > 0) {
    console.log(`✅ Found ${fallbackQuestions3.length} questions with basic filters`);
    return fallbackQuestions3;
  }

  console.log(`❌ No ${type} questions found even with fallbacks`);
  return [];
}

export async function POST(req: Request) {
  try {
    const { 
      subjectId, 
      selectedChapters, 
      paperTitle, 
      chapterOption, 
      selectionMethod, 
      selectedQuestions, // This should contain the actual MCQ IDs from the generated paper
      mcqCount,
      mcqDifficulty = 'any',
      sourceType = 'all',
      paperId // Optional: if you have a paper ID to reference
    } = await req.json();

    // Validate input
    if (!subjectId) {
      return NextResponse.json({ message: 'Subject ID is required' }, { status: 400 });
    }

    let mcqs = [];

    // If we have specific question IDs from manual selection, use them in the exact order
    if (selectedQuestions && selectedQuestions.mcq && selectedQuestions.mcq.length > 0) {
      const { data, error } = await supabase
        .from('questions')
        .select(`
          id,
          question_text,
          option_a,
          option_b,
          option_c,
          option_d,
          correct_option,
          difficulty,
          chapter_id,
          chapters!inner(chapterNo, name)
        `)
        .in('id', selectedQuestions.mcq);
      
      if (error) throw error;
      
      // CRITICAL: Reorder the questions to match the exact sequence from the paper
      mcqs = selectedQuestions.mcq.map(id => 
        data.find(q => q.id === id)
      ).filter(q => q !== undefined); // Remove any undefined values
    } 
    // For auto-selection, we need to replicate the exact same selection logic as generate-paper
    else {
      // Use the same fallback function as generate-paper
      const questions = await findQuestionsWithFallback(
        supabase,
        'mcq',
        subjectId,
        chapterOption === 'custom' && selectedChapters ? selectedChapters : [],
        sourceType,
        mcqDifficulty,
        mcqCount
      );

      mcqs = questions || [];
      
      // Now fetch the full question details for these IDs
      if (mcqs.length > 0) {
        const { data: fullQuestions, error: fullError } = await supabase
          .from('questions')
          .select(`
            id,
            question_text,
            option_a,
            option_b,
            option_c,
            option_d,
            correct_option,
            difficulty,
            chapter_id,
            chapters!inner(chapterNo, name)
          `)
          .in('id', mcqs.map(q => q.id))
          // CRITICAL: Maintain the same order as returned by findQuestionsWithFallback
          .order('id', { ascending: false });
        
        if (fullError) throw fullError;
        mcqs = fullQuestions || [];
      }
    }

    // If no questions found, return error
    if (mcqs.length === 0) {
      return NextResponse.json(
        { message: 'No MCQs found for the given criteria' }, 
        { status: 404 }
      );
    }

    // Generate PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]);
    const { height, width } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Header
    page.drawText(`${paperTitle || 'Generated Paper'} - MCQ Answer Key`, {
      x: 50,
      y: height - 50,
      size: 18,
      font,
      color: rgb(0, 0, 0),
    });

    // Paper info
    page.drawText(`Selection Method: ${selectionMethod}`, {
      x: 50,
      y: height - 80,
      size: 12,
      font: regularFont,
    });

    page.drawText(`Total MCQs: ${mcqs.length}`, {
      x: 50,
      y: height - 100,
      size: 12,
      font: regularFont,
    });

    // MCQ Answers
    let yPosition = height - 140;
    let currentPage = page;
    let pageNumber = 1;
    
    mcqs.forEach((mcq: any, index: number) => {
      // Check if we need a new page
      if (yPosition < 100) {
        currentPage = pdfDoc.addPage([600, 800]);
        yPosition = height - 50;
        pageNumber++;
        
        // Add header to new page
        currentPage.drawText(`${paperTitle || 'Generated Paper'} - MCQ Answer Key (Page ${pageNumber})`, {
          x: 50,
          y: height - 50,
          size: 18,
          font,
          color: rgb(0, 0, 0),
        });
        yPosition -= 30;
      }

      // Question number and text
      currentPage.drawText(`${index + 1}. ${mcq.question_text || 'No question text available'}`, {
        x: 50,
        y: yPosition,
        size: 10,
        font: regularFont,
        maxWidth: width - 100,
      });
      yPosition -= 15;

      // Correct answer
      let correctOptionText = 'Correct answer not specified';
      let correctOptionLetter = '?';
      
      if (mcq.correct_option) {
        const optionLetter = mcq.correct_option.toUpperCase();
        const optionKey = `option_${optionLetter.toLowerCase()}` as keyof typeof mcq;
        
        // Validate that the option exists and has content
        if (['A', 'B', 'C', 'D'].includes(optionLetter) && mcq[optionKey]) {
          correctOptionLetter = optionLetter;
          correctOptionText = mcq[optionKey] as string;
        } else {
          // Fallback: try to find the first non-empty option
          const options = ['A', 'B', 'C', 'D'];
          for (const opt of options) {
            const optKey = `option_${opt.toLowerCase()}` as keyof typeof mcq;
            if (mcq[optKey]) {
              correctOptionLetter = opt;
              correctOptionText = mcq[optKey] as string;
              break;
            }
          }
        }
      }

      // Draw correct answer
      currentPage.drawText('Correct:', {
        x: 60,
        y: yPosition,
        size: 10,
        font: regularFont,
        color: rgb(0, 0.5, 0),
      });

      currentPage.drawText(`${correctOptionLetter}. ${correctOptionText}`, {
        x: 110,
        y: yPosition,
        size: 10,
        font: regularFont,
        color: rgb(0, 0, 0),
      });

      yPosition -= 25;
      yPosition -= 10; // Additional spacing
    });

    // Footer
    const lastPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
    lastPage.drawText(`Generated on ${new Date().toLocaleDateString()}`, {
      x: 50,
      y: 30,
      size: 8,
      font: regularFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    const pdfBytes = await pdfDoc.save();
    
    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${(paperTitle || 'mcq-key').replace(/[^a-z0-9]/gi, '_')}-key.pdf"`,
      },
    });

  } catch (error) {
    console.error('Error generating MCQ key:', error);
    return NextResponse.json(
      { message: 'Internal server error', error: (error as Error).message }, 
      { status: 500 }
    );
  }
}