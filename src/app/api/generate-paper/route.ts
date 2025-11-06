// app/api/generate-paper/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes
import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { PaperGenerationRequest } from '@/types/types';
import { translate } from '@vitalets/google-translate-api';
import type { Browser, Page } from 'puppeteer-core';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// --- Optimizations ---

// 1. Puppeteer browser instance singleton to avoid re-launching on every request.
let browserPromise: Promise<Browser> | null = null;

async function getPuppeteerBrowser() {
  if (browserPromise) {
    const browser = await browserPromise;
    if (browser.isConnected()) return browser;
  }

  const launchBrowser = async () => {
    try {
      // Configure Chromium for serverless environment
      chromium.setHeadlessMode = true;
      chromium.setGraphicsMode = false;

      const launchOptions: any = {
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-web-security',
          '--single-process',
          '--no-zygote',
          '--no-first-run',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--max-old-space-size=4096',
        ],
        headless: 'new',
        timeout: 180000, // Increased to 3 minutes
        ignoreHTTPSErrors: true,
      };

      // Use @sparticuz/chromium in production, system Chrome in development
      if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
        launchOptions.args = chromium.args;
        launchOptions.executablePath = await chromium.executablePath();
        launchOptions.defaultViewport = chromium.defaultViewport;
      } else {
        const chromePath = getChromePath();
        if (chromePath) {
          launchOptions.executablePath = chromePath;
        }
      }

      const browser = await puppeteer.launch(launchOptions);
      browser.on('disconnected', () => {
        browserPromise = null;
      });
      return browser;
    } catch (error) {
      console.error('Failed to launch puppeteer:', error);
      browserPromise = null;
      throw new Error('PDF generation is not available at this time');
    }
  };

  browserPromise = launchBrowser();
  return browserPromise;
}

// Get Chrome executable path for different environments
function getChromePath() {
  // In production, use Chromium from @sparticuz/chromium
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    return null;
  }

  const platform = process.platform;
  let paths: string[] = [];

  if (platform === 'win32') {
    paths = [
      process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
      process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
      process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    ];
  } else if (platform === 'darwin') {
    paths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    ];
  } else {
    paths = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium'
    ];
  }

  for (const p of paths) {
    if (p && fs.existsSync(p)) return p;
  }

  return null;
}

// 2. In-memory cache for fonts to avoid disk I/O on every request.
const fontCache = new Map<string, string>();

// Function to load font as base64
function loadFontAsBase64(fontFileName: string): string {
  if (fontCache.has(fontFileName)) {
    return fontCache.get(fontFileName)!;
  }
  try {
    const fontPath = path.join(process.cwd(), 'public', 'fonts', fontFileName);
    console.log(fontPath);
    if (fs.existsSync(fontPath)) {
      const fontBuffer = fs.readFileSync(fontPath);
      const base64Font = fontBuffer.toString('base64');
      fontCache.set(fontFileName, base64Font);
      return base64Font;
    } else {
      console.warn(`Font file not found: ${fontPath}`);
      return '';
    }
  } catch (error) {
    console.error('Error loading font:', error);
    return '';
  }
}

// 3. In-memory cache for translations to avoid network calls on every request.
const translationCache = new Map<string, string>();

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

// Fallback function to find questions with relaxed filters
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
  
  // Try with all filters first
  let query = supabaseAdmin
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
  let fallbackQuery = supabaseAdmin
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

  fallbackQuery = fallbackQuery.order('id', { ascending: false }).limit(count);
  const { data: fallbackQuestions1 } = await fallbackQuery;

  if (fallbackQuestions1 && fallbackQuestions1.length >= count) {
    console.log(`✅ Found ${fallbackQuestions1.length} questions without difficulty filter`);
    return fallbackQuestions1;
  }

  // Fallback 2: Remove source type filter (only if it was specified)
  if (dbSourceType && dbSourceType !== 'all') {
    console.log(`🔄 Fallback 2: Removing source type filter for ${type}`);
    let fallbackQuery2 = supabaseAdmin
      .from('questions')
      .select('id')
      .eq('question_type', type)
      .eq('subject_id', subjectId);

    if (chapterIds.length > 0) {
      fallbackQuery2 = fallbackQuery2.in('chapter_id', chapterIds);
    }

    fallbackQuery2 = fallbackQuery2.order('id', { ascending: false }).limit(count);
    const { data: fallbackQuestions2 } = await fallbackQuery2;

    if (fallbackQuestions2 && fallbackQuestions2.length >= count) {
      console.log(`✅ Found ${fallbackQuestions2.length} questions without source type filter`);
      return fallbackQuestions2;
    }
  }

  // Fallback 3: Only subject and type filter
  console.log(`🔄 Fallback 3: Using only subject and type filter for ${type}`);
  const { data: fallbackQuestions3 } = await supabaseAdmin
    .from('questions')
    .select('id')
    .eq('question_type', type)
    .eq('subject_id', subjectId)
    .order('id', { ascending: false })
    .limit(count);

  if (fallbackQuestions3 && fallbackQuestions3.length > 0) {
    console.log(`✅ Found ${fallbackQuestions3.length} questions with basic filters`);
    return fallbackQuestions3;
  }

  console.log(`❌ No ${type} questions found even with fallbacks`);
  return [];
}

// Function to format question text for better display
function formatQuestionText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold text
    .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic text
    .replace(/\n/g, '<br>'); // Line breaks
}

// Function to simplify HTML content
function simplifyHtmlContent(html: string): string {
  // Remove unnecessary whitespace and comments
  return html
    .replace(/\s+/g, ' ')
    .replace(/<!--.*?-->/g, '')
    .trim();
}

// Function to check if Urdu text exists and is not just English
function hasActualUrduText(text: string | null): boolean {
  if (!text) return false;
  
  // Check if text contains Urdu characters (Unicode range for Urdu/Arabic)
  const urduRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return urduRegex.test(text);
}

// increment function if paper is generated
// Function to increment papers_generated count for a user
async function incrementPapersGenerated(supabase: any, userId: string) {
  try {
    const { error } = await supabase.rpc('increment_papers_generated', {
      user_id: userId
    });

    if (error) {
      console.error('Error incrementing papers generated:', error);
      // Fallback: use update query if RPC fails
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('papers_generated')
        .eq('id', userId)
        .single();

      if (profile) {
        const newCount = (profile.papers_generated || 0) + 1;
        await supabase
          .from('profiles')
          .update({ papers_generated: newCount })
          .eq('id', userId);
      }
    }
  } catch (error) {
    console.error('Failed to update papers_generated:', error);
  }
}

// function to check user subscription if any
async function checkUserSubscription(supabaseAdmin: any, userId: string): Promise<boolean> {
  try {
    const { data: subscription, error } = await supabaseAdmin
      .from('user_subscriptions')
      .select('status, plan_type')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.warn('Error fetching subscription:', error);
      // Assume trial if no subscription found
      return true;
    }

    // Return true if user is on trial or has no active paid subscription
    return subscription?.status === 'trialing' || 
           subscription?.plan_type === 'free' || 
           !subscription;
  } catch (error) {
    console.warn('Error checking subscription:', error);
    return true; // Assume trial on error
  }
}

// Add this function to generate watermark CSS
// Watermark CSS
function getWatermarkStyle(): string {
  return `
    .watermark {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 9999;
      pointer-events: none;
      overflow: hidden;
    }

    .watermark-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 42px;
      line-height: 1.4;
      text-align: center;
      color: rgba(200, 0, 0, 0.08);
      font-weight: bold;
      font-family: Arial, sans-serif;
      white-space: pre-line; /* allows multi-line */
    }
  `;
}

// Function to optimize HTML for Puppeteer
function optimizeHtmlForPuppeteer(html: string): string {
  return html
    // Remove unnecessary whitespace
    .replace(/\s+/g, ' ')
    // Remove comments
    .replace(/<!--.*?-->/gs, '')
    // Remove empty styles
    .replace(/<style>\s*<\/style>/g, '')
    // Minify CSS in style tags
    .replace(/<style>([\s\S]*?)<\/style>/g, (match, css) => {
      const minifiedCSS = css
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
        .replace(/\s+/g, ' ') // Collapse whitespace
        .replace(/\s*([{};:,])\s*/g, '$1') // Remove spaces around braces/semicolons
        .trim();
      return `<style>${minifiedCSS}</style>`;
    })
    .trim();
}

export async function POST(request: Request) {
  console.log('📄 POST request received to generate paper');
  
  const token = request.headers.get('Authorization')?.split(' ')[1];
  if (!token) {
    return NextResponse.json({ error: 'Authorization token required' }, { status: 401 });
  }

  // Verify user
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !user) {
    console.error('Authentication error:', userError);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user is on trial
  const isTrialUser = await checkUserSubscription(supabaseAdmin, user.id);
  console.log(`👤 User ${user.id} is ${isTrialUser ? 'on trial' : 'paid'}`);

  try {
    const requestData: PaperGenerationRequest = await request.json();
    console.log('📋 Request data received');

    const { 
      language = 'bilingual', 
      mcqMarks = 1, 
      shortMarks = 2, 
      longMarks = 5, 
      mcqPlacement = 'separate',
      selectionMethod,
      selectedQuestions,
      paperType = 'all',
      title,
      subjectId,
      classId,
      chapterOption = 'full_book',
      selectedChapters = [],
      source_type = 'all',
      mcqCount = 0,
      shortCount = 0,
      longCount = 0,
      mcqDifficulty = 'any',
      shortDifficulty = 'any',
      longDifficulty = 'any',
      easyPercent,
      mediumPercent,
      hardPercent,
      timeMinutes = 60,
      mcqToAttempt,
      shortToAttempt,
      longToAttempt,
      mcqTimeMinutes,
      subjectiveTimeMinutes,
        dateOfPaper // 🆕 ADD THIS LINE
    } = requestData;
// Add this function near your other helper functions
function formatPaperDate(dateString: string | undefined): string {
  if (!dateString) {
    return new Date().toLocaleDateString('en-GB'); // Default to today
  }
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB'); // DD/MM/YYYY format
  } catch (error) {
    console.error('Error formatting date:', error);
    return new Date().toLocaleDateString('en-GB');
  }
}
    // Validation
    if (!title || !subjectId) {
      return NextResponse.json(
        { error: 'Title and subject ID are required' },
        { status: 400 }
      );
    }

    // Test database connection
    const { data: testQuestions, error: testError } = await supabaseAdmin
      .from('questions')
      .select('id')
      .limit(1);

    if (testError) {
      console.error('Database test failed:', testError);
      return NextResponse.json(
        { error: 'Database connection failed', details: testError.message },
        { status: 500 }
      );
    }

    console.log('✅ Database connection successful');
    console.log(`📋 Source type: ${source_type}`);
    console.log(`🌐 Language: ${language}`);

    // Determine chapters to include
    let chapterIds: string[] = [];
    if (chapterOption === 'full_book') {
      const { data: chapters, error: chaptersError } = await supabaseAdmin
        .from('chapters')
        .select('id')
        .eq('subject_id', subjectId);
      
      if (chaptersError) {
        console.error('Error fetching chapters:', chaptersError);
        return NextResponse.json(
          { error: 'Failed to fetch chapters' },
          { status: 500 }
        );
      }
      
      chapterIds = chapters?.map(c => c.id) || [];
      console.log(`📚 Full book chapters found: ${chapterIds.length}`);
    } else if (chapterOption === 'custom' && selectedChapters && selectedChapters.length > 0) {
      chapterIds = selectedChapters;
      console.log(`🎯 Custom chapters selected: ${chapterIds.length}`);
    }

    // Calculate total marks
    const totalMarks = (mcqToAttempt || mcqCount || 0) * mcqMarks + 
                      (shortToAttempt || shortCount || 0) * shortMarks + 
                      (longToAttempt || longCount || 0) * longMarks;
    const objectiveMarks = (mcqToAttempt || mcqCount || 0) * mcqMarks ; 
    const subjectMarks = (shortToAttempt || shortCount || 0) * shortMarks + 
                      (longToAttempt || longCount || 0) * longMarks;

    // Create paper record - handle source_type column gracefully
    const paperData: any = {
      title: title,
      subject_id: subjectId,
      class_id: classId,
      created_by: user.id,
      paper_type: paperType,
      chapter_ids: chapterOption === 'custom' ? selectedChapters : null,
      difficulty: 'medium',
      total_marks: totalMarks,
      time_minutes: timeMinutes,
      mcq_to_attempt: mcqToAttempt,
      short_to_attempt: shortToAttempt,
      long_to_attempt: longToAttempt,
      language: language
    };

    let paper;
    try {
      // Try to include source_type if the column exists
      const { data: paperWithSource, error: paperErrorWithSource } = await supabaseAdmin
        .from('papers')
        .insert({
          ...paperData,
          source_type: source_type
        })
        .select()
        .single();

      if (paperErrorWithSource) {
        // If error is about missing source_type column, try without it
        if (paperErrorWithSource.message.includes('source_type') && 
            paperErrorWithSource.message.includes('column')) {
          console.log('⚠️ source_type column not found in papers table, inserting without it');
          
          const { data: paperWithoutSource, error: paperErrorWithoutSource } = await supabaseAdmin
            .from('papers')
            .insert(paperData)
            .select()
            .single();
          
          if (paperErrorWithoutSource) {
            console.error('Error creating paper:', paperErrorWithoutSource);
            throw paperErrorWithoutSource;
          }
          
          paper = paperWithoutSource;
        } else {
          console.error('Error creating paper:', paperErrorWithSource);
          throw paperErrorWithSource;
        }
      } else {
        paper = paperWithSource;
      }

      console.log(`✅ Paper created with ID: ${paper.id}`);
    } catch (error) {
      console.error('Error creating paper:', error);
      throw error;
    }

    // Process question types with fallback
    const questionInserts = [];
    const questionTypes = [
      { type: 'mcq', count: mcqCount, difficulty: mcqDifficulty },
      { type: 'short', count: shortCount, difficulty: shortDifficulty },
      { type: 'long', count: longCount, difficulty: longDifficulty }
    ];

    for (const qType of questionTypes) {
      if (qType.count > 0) {
        const questions = await findQuestionsWithFallback(
          supabaseAdmin,
          qType.type,
          subjectId,
          chapterIds,
          source_type,
          qType.difficulty,
          qType.count
        );

        if (questions.length > 0) {
          questions.forEach((q) => {
            questionInserts.push({
              paper_id: paper.id,
              question_id: q.id,
              order_number: questionInserts.length + 1,
              question_type: qType.type
            });
          });
          console.log(`✅ Added ${questions.length} ${qType.type} questions`);
        } else {
          console.warn(`⚠️ No ${qType.type} questions found`);
        }
      }
    }

    // Insert paper questions
    if (questionInserts.length > 0) {
      console.log(`📝 Inserting ${questionInserts.length} questions into paper_questions`);
      
      const { error: insertError } = await supabaseAdmin
        .from('paper_questions')
        .insert(questionInserts);

      if (insertError) {
        console.error('Error inserting paper questions:', insertError);
        
        // Delete the paper since questions couldn't be added
        await supabaseAdmin
          .from('papers')
          .delete()
          .eq('id', paper.id);
        
        throw insertError;
      }

      console.log(`✅ Successfully inserted ${questionInserts.length} questions`);
    } else {
      console.warn('⚠️ No questions to insert');
      
      // Delete the empty paper
      await supabaseAdmin
        .from('papers')
        .delete()
        .eq('id', paper.id);
      
      return NextResponse.json(
        { 
          error: 'No questions found matching your criteria. Please try different filters.',
          details: {
            subjectId,
            chapterIds,
            source_type,
            mcqCount,
            shortCount,
            longCount
          }
        },
        { status: 400 }
      );
    }

    // Fetch paper questions with full question data
    console.log('📋 Fetching paper questions with details...');
    const { data: paperQuestions, error: pqError } = await supabaseAdmin
      .from('paper_questions')
      .select(`
        order_number, 
        question_type, 
        question_id, 
        questions (
          question_text, 
          question_text_ur,
          option_a, 
          option_a_ur,
          option_b, 
          option_b_ur,
          option_c, 
          option_c_ur,
          option_d, 
          option_d_ur,
          answer_text,
          answer_text_ur,
          difficulty,
          chapter_id,
          correct_option,
          source_type
        )
      `)
      .eq('paper_id', paper.id)
      .order('order_number', { ascending: true });

    if (pqError) {
      console.error('Error fetching paper questions:', pqError);
      throw pqError;
    }

    console.log(`✅ Found ${paperQuestions?.length || 0} paper questions`);

    if (!paperQuestions || paperQuestions.length === 0) {
      // Delete the paper if no questions were found
      await supabaseAdmin
        .from('papers')
        .delete()
        .eq('id', paper.id);
      
      return NextResponse.json(
        { error: 'No questions found for the generated paper' },
        { status: 404 }
      );
    }

    // Generate HTML content for PDF
    const isUrdu = language === 'urdu';
    const isBilingual = language === 'bilingual';
    const isEnglish = language === 'english';
    const separateMCQ = mcqPlacement === 'separate';
    
    // Handle title
    const englishTitle = `${paper.title}`;
    const urduTitle = paper.title;

    // Load fonts
    const jameelNooriBase64 = loadFontAsBase64('JameelNooriNastaleeqKasheeda.ttf');
    const notoNastaliqBase64 = loadFontAsBase64('NotoNastaliqUrdu-Regular.ttf');
    const algerianBase64 = loadFontAsBase64('Algerian Regular.ttf');
    let paperClass = '';
    let subject = '';
    let subject_ur = '';
    
    try {
      // Fetch subject details
      const { data: subjectData, error: subjectError } = await supabaseAdmin
        .from('subjects')
        .select('name')
        .eq('id', subjectId)
        .single();

      if (!subjectError && subjectData) {
        subject = subjectData.name;
        const cachedTranslation = translationCache.get(subject);
        if (cachedTranslation) {
          subject_ur = cachedTranslation;
        } else {
          const translatedSubject = await translate(subject, { to: 'ur' });
          subject_ur = translatedSubject.text;
          translationCache.set(subject, subject_ur);
        }
      } else {
        console.warn('Using fallback subject data due to error:', subjectError);
      }

      // Fetch class details
      const { data: classData, error: classError } = await supabaseAdmin
        .from('classes')
        .select('name')
        .eq('id', classId)
        .single();

      if (!classError && classData) {
        paperClass = classData.name;
      } else {
        console.warn('Using fallback class data due to error:', classError);
      }
    } catch (error) {
      console.error('Error fetching subject/class details:', error);
      // Continue with fallback values
    }

    /** CONVERT PAPER MINUTES INTO HOURS */
    function convertMinutesToTimeFormat(minutes: number): string {
      if (minutes <= 0) return '0:00';
      
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      
      // Format with leading zero for minutes
      const formattedMinutes = remainingMinutes.toString().padStart(2, '0');
      
      return `${hours}:${formattedMinutes}`;
    }

    const timeToDisplay = separateMCQ ? mcqTimeMinutes : timeMinutes;
    const subjectiveTimeToDisplay = separateMCQ ? subjectiveTimeMinutes : timeMinutes;
function loadImageAsBase64(imageFileName: string): string {
  try {
    const imagePath = path.join(process.cwd(), 'public', imageFileName);
    if (fs.existsSync(imagePath)) {
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      const extension = path.extname(imageFileName).toLowerCase();
      const mimeType = extension === '.jpg' || extension === '.jpeg' 
        ? 'jpeg' 
        : extension.replace('.', '');
      return `data:image/${mimeType};base64,${base64Image}`;
    }
    return '';
  } catch (error) {
    console.error('Error loading image:', error);
    return '';
  }
}

// In your POST function, load the image
const examlyImageBase64 = loadImageAsBase64('examly.jpg');
    // Build HTML content
    let htmlContent = `
<!DOCTYPE html>
<html lang="${isUrdu ? 'ur' : 'en'}">
<head>
  <meta charset="UTF-8">
  <title>${isUrdu ? subject_ur : subject} </title>
  
  <style>
  ${getWatermarkStyle()}
   @font-face {
      font-family: 'Jameel Noori Nastaleeq';
      src: url('data:font/truetype;charset=utf-8;base64,${jameelNooriBase64}') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
    
    @font-face {
      font-family: 'Noto Nastaliq Urdu';
      src: url('data:font/truetype;charset=utf-8;base64,${notoNastaliqBase64}') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
       @font-face {
      font-family: 'algerian';
      src: url('data:font/truetype;charset=utf-8;base64,${algerianBase64}') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 0px; }
    .container { max-width: 900px; margin: 0 auto; background: white; padding: 0;  }
    .header {text-align:center; font-size: 14px;  }
    .header h1 { font-size: 16px; }
    .header h2 { font-size: 12px; }
    .institute{font-family:algerian; }
    .urdu { font-family: "Jameel Noori Nastaleeq", "Noto Nastaliq Urdu", serif; direction: rtl; }
    .eng { font-family: "Times New Roman", serif; direction: ltr; }
     .options .urdu {
    font-family: "Jameel Noori Nastaleeq", "Noto Nastaliq Urdu";
    direction: rtl;
  }
  .options .eng {
    font-family: "Times New Roman", serif;
    direction: ltr;
  }
    .meta { display: flex; justify-content: space-between; margin: 0 0; font-size: 12px; font-weight:bold;  }
   .metaUrdu, .metaEng {
  display: inline-block;
  vertical-align: middle;
  line-height: 1.8;
  position: relative;
  font-size: 12px;
  
}

.metaUrdu {
  top: -0.7px; /* fine-tuned Nastaliq baseline correction */
  direction: rtl;
  font-family: 'Noto Nastaliq Urdu','Jameel Noori Nastaleeq',serif;
}

.metaEng {
  top: 0;
  direction: ltr;
  font-family: 'Noto Sans',Arial,sans-serif;
}

    .note {  padding: 0px; margin:0 0; font-size: 12px; line-height: 1.2; }
    table { width: 100%; border-collapse: collapse; margin: 5px 0; font-size: 14px; ${isEnglish? ' direction:ltr' : ' direction:rtl'}}
    table, th, td { border: 1px solid #000; }
    td { padding: 3px; vertical-align: top; }
    hr{color:black}
    .qnum { width: 40px; text-align: center; font-weight: bold; }
    .question { display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 0 0; 
    }
    
    .student-info{ margin-top: 10px; margin-bottom:10px; display: flex; justify-content: space-between;  flex-direction: ${isEnglish ? 'row-reverse' : 'row'}; }
  
    .options { margin-top: 3px; display: flex; justify-content: space-between; font-size: 11px; }
    .footer { text-align: left; margin-top: 10px; font-size: 10px; }

  </style>
</head>
<body>
  <div class="container">
  <div class="header">
     <h1 class="eng text-center">
        ${examlyImageBase64 ? `<img src="${examlyImageBase64}" class="header-img"  height="40" width="100"/>` : ''} <br/>
     <span class="institute">   ${englishTitle}</span>
      </h1>
     </div>
  
  <!-- Student Info Table -->
 <table style="width:100%; border-collapse:collapse; border:none !important; font-family:'Noto Nastaliq Urdu','Jameel Noori Nastaleeq','Noto Sans',Arial,sans-serif;">
  <!-- Row 1 -->
  <tr style="border:none !important; display:flex; justify-content:space-between; align-items:center;">
    <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1.5;">
      ${isUrdu || isBilingual ? `<span class="metaUrdu">نام طالبعلم:۔۔۔۔۔۔۔۔۔۔</span>` : ''}
      ${isEnglish || isBilingual ? `<span class="metaEng">Student Name:_________</span>` : ''}
    </td>
    <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1;">
      ${isUrdu || isBilingual ? `<span class="metaUrdu">رول نمبر:۔۔۔۔۔۔</span>` : ''}
      ${isEnglish || isBilingual ? `<span class="metaEng">Roll No:_________</span>` : ''}
    </td>
    <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1;">
      ${isUrdu || isBilingual ? `<span class="metaUrdu">سیکشن:۔۔۔۔۔۔</span>` : ''}
      ${isEnglish || isBilingual ? `<span class="metaEng">Section:_______</span>` : ''}
    </td>
  </tr>

  <!-- Row 2 -->
  <tr style="border:none !important; display:flex; justify-content:space-between; align-items:center;">
    <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1.5;">
      ${isUrdu || isBilingual ? `<span class="metaUrdu"><strong>کلاس: ${paperClass}</strong></span>` : ''}
      ${isEnglish || isBilingual ? `<span class="metaEng">Class: ${paperClass}</span>` : ''}
    </td>
    <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1;">
      ${isUrdu || isBilingual ? `<span class="metaUrdu">مضمون: ${subject_ur}</span>` : ''}
      ${isEnglish || isBilingual ? `<span class="metaEng">Subject: ${subject}</span>` : ''}
    </td>
    <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1;">
      ${isUrdu || isBilingual ? `<span class="metaUrdu">تاریخ:${formatPaperDate(dateOfPaper)}</span>` : ''}
      ${isEnglish || isBilingual ? `<span class="metaEng">Date:${formatPaperDate(dateOfPaper)}</span>` : ''}
    </td>
  </tr>

  <!-- Row 3 -->
  <tr style="border:none !important; display:flex; justify-content:space-between; align-items:center;">
    <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1.5;">
      ${isUrdu || isBilingual ? `<span class="metaUrdu">وقت: ${convertMinutesToTimeFormat(timeToDisplay || timeMinutes)} منٹ</span>` : ''}
      ${isEnglish || isBilingual ? `<span class="metaEng">Time Allowed: ${convertMinutesToTimeFormat(timeToDisplay || timeMinutes)} Minutes</span>` : ''}
    </td>
    <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1;">
      ${isUrdu || isBilingual ? `<span class="metaUrdu">کل نمبر: ${totalMarks}</span>` : ''}
      ${isEnglish || isBilingual ? `<span class="metaEng">Maximum Marks: ${totalMarks}</span>` : ''}
    </td>
   <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1;">
     ${isUrdu || isBilingual ? `<span class="metaUrdu">حصہ انشائیہ</span>` : ''}
      ${isEnglish || isBilingual ? `<span class="metaEng">Subjective Part</span>` : ''}
    </td>
  </tr>
</table>
<hr  style="color:black;"/> <br />`;

    // Get MCQ questions
    const mcqQuestions = paperQuestions.filter((pq: any) => 
      pq.question_type === 'mcq' && pq.questions
    );

    // Add MCQ questions if they exist
    if (mcqQuestions.length > 0) {
      htmlContent += `<div class="note">`;
      if (isUrdu || isBilingual) {
        htmlContent += `<p class="urdu">نوٹ: ہر سوال کے چار ممکنہ جوابات A,B,C اور D دیئے گئے ہیں۔ درست جواب کے مطابق دائرہ پُر کریں۔ ایک سے زیادہ دائروں کو پُر کرنے کی صورت میں جواب غلط تصور ہوگا۔</p>`;
      }
      if (isEnglish || isBilingual) {
        htmlContent += `<p class="eng">Note: Four possible answers A, B, C and D to each question are given. Fill the correct option's circle. More than one filled circle will be treated wrong.</p>`;
      }
      htmlContent += `</div><table>`;

      // Process MCQ questions
      mcqQuestions.forEach((pq: any, index: number) => {
        const q = pq.questions;
        const englishQuestion = formatQuestionText(q.question_text.trim() || 'No question text available');
        const hasUrduQuestion = hasActualUrduText(q.question_text_ur.trim());
        const urduQuestion = hasUrduQuestion ? formatQuestionText(q.question_text_ur.trim()) : '';
        
        let questionDisplayHtml = '<div class="question">';
        if (isEnglish) {
            questionDisplayHtml += `<span class="eng">${englishQuestion.trim()}</span>`;
        } else if (isUrdu) {
            questionDisplayHtml += `<span class="urdu">${urduQuestion.trim() || englishQuestion.trim()}</span>`;
        } else { // bilingual
            questionDisplayHtml += `<span class="urdu">${urduQuestion.trim()}</span><span class="eng">${englishQuestion.trim()}</span>`;
        }
        questionDisplayHtml += '</div>';

        const options = [
          { 
            letter: 'A', 
            english: q.option_a || '', 
            urdu: hasActualUrduText(q.option_a_ur) ? q.option_a_ur : '',
            hasUrdu: hasActualUrduText(q.option_a_ur)
          },
          { 
            letter: 'B', 
            english: q.option_b || '', 
            urdu: hasActualUrduText(q.option_b_ur) ? q.option_b_ur : '',
            hasUrdu: hasActualUrduText(q.option_b_ur)
          },
          { 
            letter: 'C', 
            english: q.option_c || '', 
            urdu: hasActualUrduText(q.option_c_ur) ? q.option_c_ur : '',
            hasUrdu: hasActualUrduText(q.option_c_ur)
          },
          { 
            letter: 'D', 
            english: q.option_d || '', 
            urdu: hasActualUrduText(q.option_d_ur) ? q.option_d_ur : '',
            hasUrdu: hasActualUrduText(q.option_d_ur)
          }
        ];

        let optionsHtml = '';
        options.forEach(option => {
          if (option.english || option.urdu) {
            let optionDisplayHtml = `<span>(${option.letter}) `;
            if (isEnglish) {
                optionDisplayHtml += `<span class="eng">${option.english}</span>`;
            } else if (isUrdu) {
                optionDisplayHtml += `<span class="urdu">${option.urdu || option.english}</span>`;
            } else { // bilingual
                optionDisplayHtml += `<span><span class="urdu">${option.urdu}</span> <span class="eng">${option.english}</span></span>`;
            }
            optionDisplayHtml += '</span>';
            optionsHtml += optionDisplayHtml;
          }
        });

        htmlContent += `
     <tr>
        <td class="qnum">${pq.order_number}</td>
        <td>
          ${questionDisplayHtml}
          <div class="options">${optionsHtml}</div>
        </td>
      </tr>
    `;
      });

      htmlContent += `
         </table>
${separateMCQ ? `<div class="footer">
      <p>117-023-I (Objective Type) - 14500 (5833) (New Course)</p>
    </div>` : ``}
    
  </div>
    ${separateMCQ ? `
      <!-- Page break before subjective section -->
      <div style="page-break-before: always;"></div>` : ''}
  `;
    }

    // Get subjective questions
    const subjectiveQuestions = paperQuestions.filter((pq: any) => 
      pq.question_type !== 'mcq' && pq.questions
    );

    // Helper: Convert number to roman style (i, ii, iii …)
    function toRoman(num: number): string {
      const romans = ['i','ii','iii','iv','v','vi','vii','viii','ix','x','xi','xii','xiii','xiv','xv','xvi','xvii','xviii'];
      return romans[num - 1] || num.toString();
    }

    htmlContent += `
    ${separateMCQ ?`
       <div class="header">
     <h1 class="eng text-center">
        ${examlyImageBase64 ? `<img src="${examlyImageBase64}" class="header-img"  height="40" width="100"/>` : ''} <br/>
     <span class="institute">   ${englishTitle}</span>
      </h1>
     </div>
      <!-- Student Info Table -->
 <table style="width:100%; border-collapse:collapse; border:none !important; font-family:'Noto Nastaliq Urdu','Jameel Noori Nastaleeq','Noto Sans',Arial,sans-serif;">
  <!-- Row 1 -->
  <tr style="border:none !important; display:flex; justify-content:space-between; align-items:center;">
    <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1.5;">
      ${isUrdu || isBilingual ? `<span class="metaUrdu">نام طالبعلم:۔۔۔۔۔۔۔۔۔۔</span>` : ''}
      ${isEnglish || isBilingual ? `<span class="metaEng">Student Name:_________</span>` : ''}
    </td>
    <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1;">
      ${isUrdu || isBilingual ? `<span class="metaUrdu">رول نمبر:۔۔۔۔۔۔</span>` : ''}
      ${isEnglish || isBilingual ? `<span class="metaEng">Roll No:_________</span>` : ''}
    </td>
    <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1;">
      ${isUrdu || isBilingual ? `<span class="metaUrdu">سیکشن:۔۔۔۔۔۔</span>` : ''}
      ${isEnglish || isBilingual ? `<span class="metaEng">Section:_______</span>` : ''}
    </td>
  </tr>

  <!-- Row 2 -->
  <tr style="border:none !important; display:flex; justify-content:space-between; align-items:center;">
    <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1.5;">
      ${isUrdu || isBilingual ? `<span class="metaUrdu"><strong>کلاس: ${paperClass}</strong></span>` : ''}
      ${isEnglish || isBilingual ? `<span class="metaEng">Class: ${paperClass}</span>` : ''}
    </td>
    <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1;">
      ${isUrdu || isBilingual ? `<span class="metaUrdu">مضمون: ${subject_ur}</span>` : ''}
      ${isEnglish || isBilingual ? `<span class="metaEng">Subject: ${subject}</span>` : ''}
    </td>
    <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1;">
      ${isUrdu || isBilingual ? `<span class="metaUrdu">تاریخ:${formatPaperDate(dateOfPaper)}</span>` : ''}
      ${isEnglish || isBilingual ? `<span class="metaEng">Date:${formatPaperDate(dateOfPaper)}</span>` : ''}
    </td>
  </tr>

  <!-- Row 3 -->
  <tr style="border:none !important; display:flex; justify-content:space-between; align-items:center;">
    <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1.5;">
      ${isUrdu || isBilingual ? `<span class="metaUrdu">وقت: ${convertMinutesToTimeFormat(timeToDisplay || timeMinutes)} منٹ</span>` : ''}
      ${isEnglish || isBilingual ? `<span class="metaEng">Time Allowed: ${convertMinutesToTimeFormat(timeToDisplay || timeMinutes)} Minutes</span>` : ''}
    </td>
    <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1;">
      ${isUrdu || isBilingual ? `<span class="metaUrdu">کل نمبر: ${totalMarks}</span>` : ''}
      ${isEnglish || isBilingual ? `<span class="metaEng">Maximum Marks: ${totalMarks}</span>` : ''}
    </td>
    <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1;">
     ${isUrdu || isBilingual ? `<span class="metaUrdu">حصہ انشائیہ</span>` : ''}
      ${isEnglish || isBilingual ? `<span class="metaEng">Subjective Part</span>` : ''}
    </td>
  </tr>
</table>
<hr  style="color:black;"/> <br /> `:``
    }    
    `;

    // Add subjective questions
    if (subjectiveQuestions.length > 0) {
      htmlContent += `
    <!-- Short Questions Section -->
    <div class="header">
     
      (<span class="english">${(isEnglish || isBilingual)? 'Part - I':''}<span><span class="urdu"> ${(isUrdu || isBilingual)? 'حصہ اول':''}  </span>)
    </div>
  
  `;

      // Separate short and long questions
      const shortQuestions = subjectiveQuestions.filter((pq: any) => pq.question_type === 'short');

      // Add short questions
      // Grouping: 6 questions per group
      const questionsPerGroup = 6;
      const totalGroups = Math.ceil(shortQuestions.length / questionsPerGroup);

      for (let g = 0; g < totalGroups; g++) {
        const groupQuestions = shortQuestions.slice(
          g * questionsPerGroup,
          (g + 1) * questionsPerGroup
        );

        // Q. numbering starts from 2
        const questionNumber = g + 2;

          let instructionHtml = '<div style="display:flex; justify-content:space-between; margin-bottom:0px; font-weight:bold">';
          if (isEnglish || isBilingual) {
            instructionHtml += `<div class="eng"><strong>${questionNumber}.</strong>Write short answers to any four(4) questions.<span></span></div>`;
          }
          if (isUrdu || isBilingual) {
            instructionHtml += `<div class="urdu" style="direction:rtl;"><strong><span>${questionNumber}.</span>کوئی سے چار سوالات کے مختصر جوابات لکھئے  </strong></div>`;
          }
          instructionHtml += '</div>';

        htmlContent += `
      
      
      <div class="short-questions ${isUrdu?'urdu':''}">
        ${instructionHtml}
    `;

        groupQuestions.forEach((pq: any, idx: number) => {
          const q = pq.questions;
          const englishQuestion = formatQuestionText(q.question_text || 'No question text available');
          const hasUrduQuestion = hasActualUrduText(q.question_text_ur);
          const urduQuestion = hasUrduQuestion ? formatQuestionText(q.question_text_ur) : '';

          let questionItemHtml = '<div class="short-question-item" style="display:flex; justify-content:space-between; margin-bottom:0px;">';
          if (isEnglish) {
              questionItemHtml += `<div class="eng">(${toRoman(idx + 1)}) ${englishQuestion}</div>`;
          } else if (isUrdu) {
              questionItemHtml += `<div class="urdu" style="direction:rtl;">(${toRoman(idx + 1)}) ${urduQuestion || englishQuestion}</div>`;
          } else { // bilingual
              questionItemHtml += `<div class="eng">(${toRoman(idx + 1)}) ${englishQuestion}</div>`;
              if (hasUrduQuestion) {
                  questionItemHtml += `<div class="urdu" style="direction:rtl;">(${toRoman(idx + 1)}) ${urduQuestion}</div>`;
              }
          }
          questionItemHtml += '</div>';

          htmlContent += `
         ${questionItemHtml}
      `;
        });

        htmlContent += `
       </div>
    `;
      }
    }

    const longQuestions = subjectiveQuestions.filter((pq: any) => pq.question_type === 'long');

    // Add long questions
    if (longQuestions.length > 0) {
      htmlContent += `
    <div class="header">
        (<span class="english">${(isEnglish || isBilingual)? 'Part - II':''}<span> <span class="urdu"> ${(isUrdu || isBilingual)? 'حصہ دوم ':''}  </span>)
    </div>
    <div class="instructions" style="font-weight:bold">`;
    if(isEnglish || isBilingual) {
      htmlContent += `<div class="instruction-text eng">
                        <span>Note:</span> Attempt any 2 questions.
                      </div>`;
    }
    if(isUrdu || isBilingual) {
      htmlContent += `<div class="instruction-text urdu" style="direction: rtl;">
                        <span>نوٹ:</span> کوئی دو سوالات حل کریں۔
                      </div>`;
    }
    htmlContent += `</div>
  `;

      longQuestions.forEach((pq: any, idx: number) => {
        const q = pq.questions;
        const englishQuestion = formatQuestionText(q.question_text || 'No question text available');
        const hasUrduQuestion = hasActualUrduText(q.question_text_ur);
        const urduQuestion = hasUrduQuestion ? formatQuestionText(q.question_text_ur) : '';

        // Sub-questions
        const subQuestions = pq.sub_questions || [];
        let subQsHTML = '';

        if (subQuestions.length > 0) {
          subQsHTML += `
        <div style="display: flex; justify-content: space-between; margin-top:6px;">
          ${isEnglish || isBilingual ? `<div class="eng" style="width: 48%;"><ol type="a">${subQuestions.map((sq: any) => `<li>${formatQuestionText(sq.question_text || '')}</li>`).join('')}</ol></div>` : ''}
          ${isUrdu || isBilingual ? `<div class="urdu" style="width: 48%; direction: rtl; text-align: right;"><ol type="a">${subQuestions.map((sq: any) => `<li>${formatQuestionText(sq.question_text_ur || '')}</li>`).join('')}</ol></div>` : ''}
        </div>
      `;
        }

        let longQuestionDisplayHtml = '<div class="long-question" style="margin-bottom:12px;"><div style="display:flex; justify-content:space-between; align-items:flex-start;">';
        if (isEnglish) {
            longQuestionDisplayHtml += `<div class="eng" style="width:100%;"><strong>Q.${idx + 1}.</strong> ${englishQuestion}</div>`;
        } else if (isUrdu) {
            longQuestionDisplayHtml += `<div class="urdu" style="width:100%; direction:rtl; text-align:right;"><strong>سوال ${idx + 1}:</strong> ${urduQuestion || englishQuestion}</div>`;
        } else { // bilingual
            longQuestionDisplayHtml += `<div class="eng" style="width:48%;"><strong>Q.${idx + 1}.</strong> ${englishQuestion}</div>`;
            if (hasUrduQuestion) {
                longQuestionDisplayHtml += `<div class="urdu" style="width:48%; direction:rtl; text-align:right;"><strong>سوال ${idx + 1}:</strong> ${urduQuestion}</div>`;
            }
        }
        longQuestionDisplayHtml += `</div>${subQsHTML}</div>`;

        htmlContent += `
      ${longQuestionDisplayHtml}
    `;
      });
    }

    htmlContent += `
    </div>
  `;

    // Footer
    htmlContent += `
    <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #ccc; padding-top: 10px;">
      <p class="english">Generated on ${new Date().toLocaleDateString()} | www.examly.pk | Generate papers Save Time</p>
      
    </div>
  </div>
 ${isTrialUser ? `<div class="watermark">
  <div class="watermark-text">
    www.examly.pk  
    Generate perfect papers&Prepare exam with Examly  
    
  </div>
</div>
` : ''}
  </body>

</html>
`;

    // Simplify and optimize HTML content
    htmlContent = optimizeHtmlForPuppeteer(simplifyHtmlContent(htmlContent));

    // Generate PDF
    let browser = null;
    let page: Page | null = null;
    try {
      // Using singleton browser instance for performance
      browser = await getPuppeteerBrowser();
      page = await browser.newPage();
      
      // Set more reasonable timeouts
      page.setDefaultTimeout(120000); // 2 minutes
      page.setDefaultNavigationTimeout(120000); // 2 minutes
      
      // Disable unnecessary resources for faster loading
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        if (req.resourceType() === 'image' || req.resourceType() === 'font') {
          req.abort();
        } else {
          req.continue();
        }
      });

      console.log('🔄 Setting HTML content...');
      
      // Use setContent with simpler wait conditions
      await page.setContent(htmlContent, {
        waitUntil: 'domcontentloaded', // Faster than 'networkidle0'
        timeout: 120000
      });

      console.log('✅ HTML content set, waiting for fonts...');
      
      // Wait for fonts to load with timeout
      await Promise.race([
        page.evaluate(() => document.fonts.ready),
        new Promise(resolve => setTimeout(resolve, 10000)) // 10 second timeout for fonts
      ]);

      console.log('📄 Generating PDF...');
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
        preferCSSPageSize: true,
        timeout: 120000 // 2 minute timeout for PDF generation
      });

      // Close the page, but not the browser
      await page.close();
      
      console.log('✅ PDF generated successfully');
      
      // Increment papers_generated count for the user
      await incrementPapersGenerated(supabaseAdmin, user.id);
      
      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${paper.title.replace(/\s+/g, '_')}.pdf"`,
          'Content-Length': pdfBuffer.length.toString(),
        },
      });

    } catch (error) {
      console.error('❌ Puppeteer error:', error);
      if (page) await page.close();
      
      // Return paper data even if PDF generation fails
      return NextResponse.json(
        { 
          success: true, 
          paperId: paper.id, 
          message: 'Paper created but PDF generation failed',
          questionsCount: paperQuestions.length,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 200 }
      );
    }

  } catch (error) {
    console.error('❌ Paper generation error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate paper', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}