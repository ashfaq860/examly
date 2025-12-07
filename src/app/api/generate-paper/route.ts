/** app/api/generate-paper/route.ts */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { PaperGenerationRequest, QuestionType, Question } from '@/types/types';
import { translate } from '@vitalets/google-translate-api';
import type { Browser, Page } from 'puppeteer-core';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// --- Optimizations ---

// 1. Puppeteer browser instance singleton to avoid re-launching on every request.
let browserPromise: Promise<Browser> | null = null;

async function getPuppeteerBrowser() {
  if (browserPromise) {
    try {
      const browser = await browserPromise;
      if (browser.isConnected()) return browser;
    } catch (error) {
      console.warn('Existing browser instance failed, creating new one:', error);
      browserPromise = null;
    }
  }

  const launchBrowser = async () => {
    console.log('🚀 Launching Puppeteer browser...');
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Vercel:', !!process.env.VERCEL);

    try {
      // Enhanced Chromium configuration for serverless environment
      const launchOptions: any = {
        args: [
          ...chromium.args,
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process',
          '--no-zygote',
          '--no-first-run',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--disable-hang-monitor',
          '--disable-prompt-on-repost',
          '--disable-domain-reliability',
          '--disable-component-extensions-with-background-pages',
          '--disable-client-side-phishing-detection',
          '--disable-crash-reporter',
          '--mute-audio',
          '--disable-extensions',
          '--disable-default-apps',
          '--disable-translate',
          '--disable-sync',
          '--metrics-recording-only',
          '--disable-default-apps',
          '--window-size=1920,1080',
          '--font-render-hinting=none',
          '--disable-software-rasterizer',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-field-trial-config',
          '--disable-composited-antialiasing'
        ],
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
        timeout: 60000,
      };

      // Use @sparticuz/chromium in production, system Chrome in development
      if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
        console.log('🔧 Configuring Chromium for production...');
        
        // Configure Chromium for Vercel
        launchOptions.executablePath = await chromium.executablePath();
        launchOptions.defaultViewport = chromium.defaultViewport;
        
        console.log('✅ Using @sparticuz/chromium for production');
      } else {
        console.log('🔧 Configuring for development...');
        const chromePath = getChromePath();
        if (chromePath) {
          launchOptions.executablePath = chromePath;
          console.log('✅ Using local Chrome:', chromePath);
        } else {
          console.warn('⚠️ No local Chrome found, using system default');
        }
      }

      console.log('🔄 Launching browser with options...');
      console.log('Executable path:', launchOptions.executablePath);
      
      const browser = await puppeteer.launch(launchOptions);
      
      console.log('✅ Browser launched successfully');
      
      // Set up cleanup on disconnect
      browser.on('disconnected', () => {
        console.log('🔌 Browser disconnected, clearing instance');
        browserPromise = null;
      });
      
      return browser;
    } catch (error) {
      console.error('❌ Failed to launch puppeteer:', error);
      browserPromise = null;
      throw new Error(`PDF generation unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  browserPromise = launchBrowser();
  return browserPromise;
}

// Get Chrome executable path for different environments
function getChromePath() {
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

// 2. In-memory cache for fonts
const fontCache = new Map<string, string>();

// Function to load font as base64
function loadFontAsBase64(fontFileName: string): string {
  if (fontCache.has(fontFileName)) {
    return fontCache.get(fontFileName)!;
  }
  try {
    const fontPath = path.join(process.cwd(), 'public', 'fonts', fontFileName);
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

// 3. In-memory cache for translations
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

// Function to get class_subject_id for filtering
async function getClassSubjectId(classId: string, subjectId: string): Promise<string | null> {
  try {
    const { data: classSubject, error } = await supabaseAdmin
      .from('class_subjects')
      .select('id')
      .eq('class_id', classId)
      .eq('subject_id', subjectId)
      .single();

    if (error) {
      console.warn('Error fetching class_subject_id:', error);
      return null;
    }

    return classSubject?.id || null;
  } catch (error) {
    console.warn('Error getting class_subject_id:', error);
    return null;
  }
}

// Enhanced token extraction function
// Robust token extractor for Next API route
function extractToken(request: Request): string | null {
  // 1) Authorization header: Bail out early if valid Bearer token present
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (authHeader) {
    const m = authHeader.match(/Bearer\s+(.+)/i);
    if (m && m[1]) return m[1];
  }

  // 2) Inspect cookies (common Supabase cookie names)
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  const cookiePairs = cookieHeader.split(';').map(c => c.trim());
  // Common cookie names Supabase uses or people store: sb-access-token, supabase-auth-token, sb:token, sb-session, sb-token
  const candidates = ['sb-access-token', 'supabase-auth-token', 'sb:token', 'sb-session', 'sb-token'];

  for (const pair of cookiePairs) {
    const [name, ...rest] = pair.split('=');
    const value = rest.join('=');
    if (!name || !value) continue;

    const key = name.trim();
    if (!candidates.includes(key)) continue;

    // Try to decode and parse JSON (some Supabase cookies store JSON)
    let decoded = value;
    try { decoded = decodeURIComponent(value); } catch (e) { /* ignore */ }

    // If looks like JSON, parse and extract access_token
    if (decoded.startsWith('{') || decoded.startsWith('%7B')) {
      try {
        const parsed = JSON.parse(decoded);
        if (parsed?.access_token) return parsed.access_token;
        if (parsed?.token) return parsed.token;
        // Sometimes Supabase stores an object under .currentSession or .persistedSession
        if (parsed?.currentSession?.access_token) return parsed.currentSession.access_token;
        if (parsed?.persistedSession?.access_token) return parsed.persistedSession.access_token;
      } catch (e) {
        // not JSON — fall through
      }
    }

    // Otherwise, if cookie value contains 'Bearer ' return the token part
    const bearer = decoded.match(/Bearer\s+(.+)/i);
    if (bearer && bearer[1]) return bearer[1];

    // If value *looks like* a JWT (three parts separated by dots) return it directly
    if (decoded.split('.').length === 3) return decoded;
  }

  // 3) Fallback: try simple regex patterns in cookie header (older formats)
  const fallbackPatterns = [
    /sb-access-token=([^;]+)/,
    /supabase-auth-token=([^;]+)/,
    /sb:token=([^;]+)/,
    /sb-session=([^;]+)/
  ];
  for (const p of fallbackPatterns) {
    const m = cookieHeader.match(p);
    if (m && m[1]) {
      try {
        const candidate = decodeURIComponent(m[1]);
        if (candidate.split('.').length === 3) return candidate;
        // try JSON parse fallback
        try {
          const json = JSON.parse(candidate);
          if (json?.access_token) return json.access_token;
        } catch {}
        return candidate;
      } catch { return m[1]; }
    }
  }

  return null;
}

// Enhanced fallback function to find questions with proper filtering
async function findQuestionsWithFallback(
  type: string,
  subjectId: string,
  classId: string,
  chapterIds: string[],
  source_type: string | undefined,
  difficulty: string | undefined,
  count: number,
  randomSeed?: number
) {
  console.log(`\n🔍 Finding ${count} ${type} questions...`);
  console.log(`📋 Filters: subject=${subjectId}, class=${classId}, chapters=${chapterIds.length}, source_type=${source_type}, difficulty=${difficulty}`);
  console.log(`🎯 Selected Chapter IDs:`, chapterIds);
  
  // Map source_type to database values
  const dbSourceType = source_type ? mapSourceType(source_type) : undefined;
  
  // Get class_subject_id for filtering
  const classSubjectId = await getClassSubjectId(classId, subjectId);
  console.log(`🎯 Class Subject ID: ${classSubjectId}`);

  // Build query with proper filtering - ALWAYS start with subject and type
  let query = supabaseAdmin
    .from('questions')
    .select('id, question_text, question_text_ur, option_a, option_b, option_c, option_d, option_a_ur, option_b_ur, option_c_ur, option_d_ur, correct_option, difficulty, chapter_id, source_type, class_subject_id, question_type')
    .eq('question_type', type)
    .eq('subject_id', subjectId);

  // **CRITICAL FIX: Always apply chapter filtering FIRST if chapters are selected**
  if (chapterIds && chapterIds.length > 0) {
    console.log(`✅ Applying chapter filter: ${chapterIds.length} chapters`);
    query = query.in('chapter_id', chapterIds);
  } else {
    console.log('ℹ️ No specific chapters selected, will use class-based filtering');
  }

  // **FIX: Apply class filtering through class_subject_id**
  if (classSubjectId) {
    query = query.eq('class_subject_id', classSubjectId);
    console.log(`✅ Filtering by class_subject_id: ${classSubjectId}`);
  } else {
    console.warn('⚠️ No class_subject_id found, applying alternative class filtering');
    
    // Alternative: Get chapters that belong to this class AND subject
    const { data: relevantChapters, error: chaptersError } = await supabaseAdmin
      .from('chapters')
      .select('id')
      .eq('subject_id', subjectId)
      .eq('class_id', classId);

    if (!chaptersError && relevantChapters && relevantChapters.length > 0) {
      const relevantChapterIds = relevantChapters.map(c => c.id);
      console.log(`📚 Found ${relevantChapterIds.length} chapters for class ${classId} and subject ${subjectId}`);
      
      // If no specific chapters were selected by user, use all relevant chapters
      if (!chapterIds || chapterIds.length === 0) {
        console.log(`✅ Using ${relevantChapterIds.length} relevant chapters for class filtering`);
        query = query.in('chapter_id', relevantChapterIds);
      } else {
        // If user selected specific chapters, ensure they belong to the right class
        const validChapterIds = chapterIds.filter(id => 
          relevantChapters.some(c => c.id === id)
        );
        if (validChapterIds.length > 0) {
          console.log(`✅ Using ${validChapterIds.length} valid chapters after class validation`);
          query = query.in('chapter_id', validChapterIds);
        } else {
          console.warn('⚠️ No valid chapters after class validation, using relevant chapters');
          query = query.in('chapter_id', relevantChapterIds);
        }
      }
    } else {
      console.error('❌ No chapters found for class and subject combination');
      return [];
    }
  }
  
  // Filter by source type if specified and not 'all'
  if (dbSourceType && dbSourceType !== 'all') {
    query = query.eq('source_type', dbSourceType);
    console.log(`✅ Filtering by source type: ${dbSourceType}`);
  }
  
  if (difficulty && difficulty !== 'any') {
    query = query.eq('difficulty', difficulty);
    console.log(`✅ Filtering by difficulty: ${difficulty}`);
  }

  console.log(`🎯 Final query filters applied:`);
  console.log(`   - Question Type: ${type}`);
  console.log(`   - Subject: ${subjectId}`);
  console.log(`   - Chapters: ${chapterIds?.length || 'all'}`);
  console.log(`   - Class Subject ID: ${classSubjectId || 'none'}`);
  console.log(`   - Source Type: ${dbSourceType || 'all'}`);
  console.log(`   - Difficulty: ${difficulty || 'any'}`);
  
  // Apply randomization using randomSeed
  if (randomSeed) {
    // Use random ordering for shuffling
    query = query.order('id', { ascending: true }); // Base order for consistency
  } else {
    query = query.order('id', { ascending: false });
  }

  query = query.limit(count * 3); // Get more questions for randomization

  const { data: questions, error } = await query;

  if (error) {
    console.error(`Error in query:`, error);
    return [];
  }

  console.log(`📊 Found ${questions?.length || 0} questions after all filters`);

  if (!questions || questions.length === 0) {
    console.log('❌ No questions found with the applied filters');
    
    // Debug: Let's see what's available without filters
    const debugQuery = supabaseAdmin
      .from('questions')
      .select('id, chapter_id, subject_id, question_type, class_subject_id')
      .eq('question_type', type)
      .eq('subject_id', subjectId)
      .limit(10);
    
    const { data: debugQuestions } = await debugQuery;
    console.log('🐛 Debug - Questions available without chapter filter:', debugQuestions);
    
    return [];
  }

  // Apply randomization if seed is provided
  let finalQuestions = questions;
  if (randomSeed && questions.length > 0) {
    // Simple pseudo-random shuffle based on seed
    finalQuestions = [...questions].sort(() => {
      const x = Math.sin(randomSeed++) * 10000;
      return x - Math.floor(x) - 0.5;
    });
    console.log(`🔀 Applied randomization with seed: ${randomSeed}`);
  }

  // Take the required number of questions
  const selectedQuestions = finalQuestions.slice(0, count);
  
  console.log(`✅ Final selection: ${selectedQuestions.length} ${type} questions`);
  
  // Log the chapters of selected questions for verification
  const selectedChapters = [...new Set(selectedQuestions.map(q => q.chapter_id))];
  console.log(`📖 Selected questions come from ${selectedChapters.length} chapters:`, selectedChapters);
  
  return selectedQuestions;
}

// Function to get questions for manual selection
async function getQuestionsForManualSelection(
  subjectId: string,
  classId: string,
  chapterIds: string[],
  source_type: string | undefined,
  difficulty: string | undefined
) {
  console.log(`\n🔍 Getting questions for manual selection...`);
  console.log(`📋 Filters: subject=${subjectId}, class=${classId}, chapters=${chapterIds.length}, source_type=${source_type}, difficulty=${difficulty}`);
  
  const dbSourceType = source_type ? mapSourceType(source_type) : undefined;
  const classSubjectId = await getClassSubjectId(classId, subjectId);

  let query = supabaseAdmin
    .from('questions')
    .select('id, question_text, question_text_ur, option_a, option_b, option_c, option_d, option_a_ur, option_b_ur, option_c_ur, option_d_ur, correct_option, difficulty, chapter_id, source_type, question_type')
    .eq('subject_id', subjectId);

  // Add class filtering
  if (classSubjectId) {
    query = query.eq('class_subject_id', classSubjectId);
  }

  if (chapterIds.length > 0) {
    query = query.in('chapter_id', chapterIds);
  }
  
  if (dbSourceType && dbSourceType !== 'all') {
    query = query.eq('source_type', dbSourceType);
  }
  
  if (difficulty && difficulty !== 'any') {
    query = query.eq('difficulty', difficulty);
  }

  query = query.order('question_type', { ascending: true })
              .order('chapter_id', { ascending: true })
              .order('id', { ascending: true });

  const { data: questions, error } = await query;

  if (error) {
    console.error(`Error fetching questions:`, error);
    return [];
  }

  console.log(`✅ Found ${questions?.length || 0} questions for manual selection`);
  return questions || [];
}

// Function to format question text for better display
function formatQuestionText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

// Function to simplify HTML content
function simplifyHtmlContent(html: string): string {
  return html
    .replace(/\s+/g, ' ')
    .replace(/<!--.*?-->/g, '')
    .trim();
}

// Function to check if Urdu text exists and is not just English
function hasActualUrduText(text: string | null): boolean {
  if (!text) return false;
  const urduRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return urduRegex.test(text);
}

// NEW helper: attempt to extract english and urdu parts when fields were pre-merged
function extractEnglishAndUrdu(field: string | null | undefined, fieldUr?: string | null | undefined) {
  const raw = (field || '').toString();
  const urFromSeparate = (fieldUr || '').toString().trim();
  const hasUrInRaw = hasActualUrduText(raw);
  const hasUrInSeparate = hasActualUrduText(urFromSeparate);

  // If separate urdu exists, prefer explicit separation
  if (hasUrInSeparate) {
    return { eng: raw.trim(), ur: urFromSeparate.trim() };
  }

  // If raw contains Urdu (frontend already merged), attempt to split.
  if (hasUrInRaw) {
    // Try patterns like:
    // "English\n(اردو)" or "English\nاردو" or "English (اردو)"
    const parenMatch = raw.match(/^(.*?)[\r\n]*\(?\s*([\u0600-\u06FF\0-\uFFFF].+?)\)?\s*$/s);
    if (parenMatch && parenMatch[1] && parenMatch[2]) {
      return { eng: parenMatch[1].trim(), ur: parenMatch[2].trim() };
    }
    // If we couldn't split, treat raw as urdu-only to avoid duplicating urdu later
    return { eng: '', ur: raw.trim() };
  }

  // No Urdu detected anywhere -> english only
  return { eng: raw.trim(), ur: '' };
}

// Function to increment papers_generated count for a user
async function incrementPapersGenerated(userId: string) {
  try {
    // Get current count
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('papers_generated')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error('Error fetching profile:', fetchError);
      return;
    }

    const newCount = (profile?.papers_generated || 0) + 1;
    
    // Update count
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ papers_generated: newCount })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating papers_generated:', updateError);
    } else {
      console.log(`✅ Incremented papers_generated to ${newCount} for user ${userId}`);
    }
  } catch (error) {
    console.error('Failed to update papers_generated:', error);
  }
}

// Function to check user subscription
async function checkUserSubscription(userId: string): Promise<boolean> {
  try {
    const { data: subscription, error } = await supabaseAdmin
      .from('user_packages')
      .select('is_active, is_trial, expires_at')
      .eq('user_id', userId)
      .eq('is_active', true)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.warn('Error fetching subscription:', error);
      // Check if user has trial in profile
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('trial_ends_at, trial_given')
        .eq('id', userId)
        .single();
      
      if (profile?.trial_ends_at && new Date(profile.trial_ends_at) > new Date()) {
        return true;
      }
      
      if (profile?.trial_given === false) {
        return true;
      }
      
      return false;
    }

    return subscription?.is_active === true || subscription?.is_trial === true;
  } catch (error) {
    console.warn('Error checking subscription:', error);
    return false;
  }
}

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
      white-space: pre-line;
    }
  `;
}

// Function to optimize HTML for Puppeteer
function optimizeHtmlForPuppeteer(html: string): string {
  return html
    .replace(/\s+/g, ' ')
    .replace(/<!--.*?-->/gs, '')
    .replace(/<style>\s*<\/style>/g, '')
    .replace(/<style>([\s\S]*?)<\/style>/g, (match, css) => {
      const minifiedCSS = css
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*([{};:,])\s*/g, '$1')
        .trim();
      return `<style>${minifiedCSS}</style>`;
    })
    .trim();
}

// Function to format paper date
function formatPaperDate(dateString: string | undefined): string {
  if (!dateString) {
    return new Date().toLocaleDateString('en-GB');
  }
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB');
  } catch (error) {
    console.error('Error formatting date:', error);
    return new Date().toLocaleDateString('en-GB');
  }
}

// Function to load image as base64
function loadImageAsBase64(imageFileName: string): string {
  try {
    const imagePath = path.join(process.cwd(), 'public', imageFileName);
    if (fs.existsSync(imagePath)) {
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      const extension = path.extname(imageFileName).toLowerCase();
      const mimeType = extension === '.jpg' || extension === '.jpeg' ? 'jpeg' : extension.replace('.', '');
      return `data:image/${mimeType};base64,${base64Image}`;
    }
    return '';
  } catch (error) {
    console.error('Error loading image:', error);
    return '';
  }
}

// Function to create paper record
// Function to create paper record
async function createPaperRecord(requestData: PaperGenerationRequest, userId: string) {
  const { 
    title,
    subjectId,
    classId,
    chapterOption = 'full_book',
    selectedChapters = [],
    source_type = 'all',
    paperType = 'custom',
    language = 'bilingual',
    timeMinutes = 60,
    mcqCount = 0,
    shortCount = 0,
    longCount = 0,
    mcqToAttempt,
    shortToAttempt,
    longToAttempt,
    mcqMarks = 1,
    shortMarks = 2,
    longMarks = 5,
    reorderedQuestions,
    customMarksData
  } = requestData;

  // CRITICAL FIX: Calculate total marks based on "to attempt" values
  // If "to attempt" values are not provided, fall back to "count" values
  const actualMcqToAttempt = mcqToAttempt !== undefined ? mcqToAttempt : mcqCount;
  const actualShortToAttempt = shortToAttempt !== undefined ? shortToAttempt : shortCount;
  const actualLongToAttempt = longToAttempt !== undefined ? longToAttempt : longCount;

  let totalMarks = 0;
  
  // Use custom marks if available (for manual selection with custom marks)
  if (reorderedQuestions && customMarksData) {
    console.log('📊 Calculating total marks with custom marks...');
    
    // Calculate marks for each question type using custom marks
    const mcqQuestions = reorderedQuestions.mcq || [];
    const shortQuestions = reorderedQuestions.short || [];
    const longQuestions = reorderedQuestions.long || [];
    
    // Calculate marks for questions that will be attempted (based on toAttempt values)
    // For MCQs: if custom marks are provided, calculate based on toAttempt count
    let mcqTotal = 0;
    if (mcqQuestions.length > 0) {
      // Get custom marks for the first 'actualMcqToAttempt' questions
      const attemptedMcqQuestions = mcqQuestions.slice(0, actualMcqToAttempt);
      mcqTotal = attemptedMcqQuestions.reduce((sum, q) => {
        const customMark = customMarksData.mcq?.find((cm: any) => cm.questionId === q.id)?.marks;
        return sum + (customMark || mcqMarks);
      }, 0);
    }
    
    // For Short questions
    let shortTotal = 0;
    if (shortQuestions.length > 0) {
      const attemptedShortQuestions = shortQuestions.slice(0, actualShortToAttempt);
      shortTotal = attemptedShortQuestions.reduce((sum, q) => {
        const customMark = customMarksData.short?.find((cm: any) => cm.questionId === q.id)?.marks;
        return sum + (customMark || shortMarks);
      }, 0);
    }
    
    // For Long questions
    let longTotal = 0;
    if (longQuestions.length > 0) {
      const attemptedLongQuestions = longQuestions.slice(0, actualLongToAttempt);
      longTotal = attemptedLongQuestions.reduce((sum, q) => {
        const customMark = customMarksData.long?.find((cm: any) => cm.questionId === q.id)?.marks;
        return sum + (customMark || longMarks);
      }, 0);
    }
    
    totalMarks = mcqTotal + shortTotal + longTotal;
    console.log(`📊 Total marks (custom): ${totalMarks} = MCQ:${mcqTotal} + Short:${shortTotal} + Long:${longTotal}`);
  } else {
    // Standard calculation based on "to attempt" counts
    totalMarks = (actualMcqToAttempt || 0) * mcqMarks + 
                (actualShortToAttempt || 0) * shortMarks + 
                (actualLongToAttempt || 0) * longMarks;
    console.log(`📊 Total marks (standard): ${totalMarks} = MCQ:${actualMcqToAttempt}×${mcqMarks} + Short:${actualShortToAttempt}×${shortMarks} + Long:${actualLongToAttempt}×${longMarks}`);
  }

  // Log the calculation details for debugging
  console.log('📋 Marks calculation details:', {
    mcqToAttempt: mcqToAttempt,
    shortToAttempt: shortToAttempt,
    longToAttempt: longToAttempt,
    mcqCount: mcqCount,
    shortCount: shortCount,
    longCount: longCount,
    actualMcqToAttempt,
    actualShortToAttempt,
    actualLongToAttempt,
    totalMarks
  });

  // Determine chapters to include
  let chapterIds: string[] = [];
  if (chapterOption === 'full_book') {
    const { data: chapters } = await supabaseAdmin
      .from('chapters')
      .select('id')
      .eq('subject_id', subjectId)
      .eq('class_id', classId);
    chapterIds = chapters?.map(c => c.id) || [];
    console.log(`📚 Full book chapters found: ${chapterIds.length}`);
  } else if ((chapterOption === 'custom' || chapterOption === 'single_chapter') && selectedChapters && selectedChapters.length > 0) {
    // Handle both custom (multi) and single_chapter (single id in array)
    chapterIds = selectedChapters;
    console.log(`🎯 Chapters selected (${chapterOption}): ${chapterIds.length}`);
  }

  // Create paper record with corrected marks calculation
  const paperData: any = {
    title: title,
    subject_id: subjectId,
    class_id: classId,
    created_by: userId,
    paper_type: paperType,
    chapter_ids: chapterOption === 'custom' && selectedChapters.length > 0 ? selectedChapters : null,
    difficulty: 'medium',
    total_marks: totalMarks,
    time_minutes: timeMinutes,
    mcq_to_attempt: actualMcqToAttempt,  // Store the actual "to attempt" value
    short_to_attempt: actualShortToAttempt,  // Store the actual "to attempt" value
    long_to_attempt: actualLongToAttempt,  // Store the actual "to attempt" value
    language: language,
    source_type: source_type
  };

  try {
    const { data: paper, error: paperError } = await supabaseAdmin
      .from('papers')
      .insert(paperData)
      .select()
      .single();

    if (paperError) {
      console.error('Error creating paper:', paperError);
      throw paperError;
    }

    console.log(`✅ Paper created with ID: ${paper.id}`);
    console.log(`📊 Paper details:`, {
      title: paper.title,
      total_marks: paper.total_marks,
      mcq_to_attempt: paper.mcq_to_attempt,
      short_to_attempt: paper.short_to_attempt,
      long_to_attempt: paper.long_to_attempt
    });
    return paper;
  } catch (error) {
    console.error('Error creating paper:', error);
    throw error;
  }
}

// Function to fetch user's profile logo and convert to base64
async function getUserLogoBase64(userId: string): Promise<string> {
  try {
    // Fetch user profile with logo
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('logo')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.logo) {
      console.log('⚠️ No user logo found, using default logo');
      return loadImageAsBase64('examly.jpg');
    }

    // Check if logo is a URL or base64 string
    const logoUrl = profile.logo;
    
    // If it's already a base64 data URL, return it
    if (logoUrl.startsWith('data:image/')) {
      return logoUrl;
    }
    
    // If it's a URL, try to fetch and convert to base64
    try {
      console.log('🔄 Fetching user logo from URL:', logoUrl);
      const response = await fetch(logoUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch logo: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Determine content type from response headers or URL
      const contentType = response.headers.get('content-type') || 
                         (logoUrl.match(/\.(jpg|jpeg|png|gif|webp)/i) 
                          ? `image/${logoUrl.match(/\.(jpg|jpeg|png|gif|webp)/i)![1].toLowerCase()}`
                          : 'image/jpeg');
      
      const base64Image = buffer.toString('base64');
      const formattedBase64 = `data:${contentType};base64,${base64Image}`;
      
      console.log('✅ User logo converted to base64 successfully');
      return formattedBase64;
      
    } catch (fetchError) {
      console.error('❌ Error fetching user logo:', fetchError);
      // Fallback to default logo
      return loadImageAsBase64('examly.jpg');
    }
    
  } catch (error) {
    console.error('❌ Error getting user logo:', error);
    return loadImageAsBase64('examly.jpg');
  }
}

// Function to generate paper HTML
async function generatePaperHTML(paper: any, userId: string, requestData: PaperGenerationRequest, logoBase64: string) {
  const {
    language = 'bilingual',
    mcqMarks = 1,
    shortMarks = 2,
    longMarks = 5,
    mcqPlacement = 'separate',
    dateOfPaper,
    reorderedQuestions,
    customMarksData // Add this to extract custom marks
  } = requestData;

  // Create a map for quick custom marks lookup
  const customMarksMap = new Map();
  if (customMarksData) {
    Object.entries(customMarksData).forEach(([type, questions]) => {
      (questions as any[]).forEach((q: any) => {
        customMarksMap.set(q.questionId, q.marks);
      });
    });
  }

  // Fetch paper questions with full question data OR use reordered questions from frontend
  console.log('📋 Fetching paper questions with details...');
  
  let finalQuestions: any[] = [];

  // Check if we have reordered questions from frontend
  if (reorderedQuestions) {
    console.log('🔄 Using reordered questions from frontend preview');
    
    // Use the reordered questions from frontend instead of database order
    const { mcq = [], short = [], long = [] } = reorderedQuestions;
    
    // Combine all questions in the correct order
    let orderNumber = 1;
    
    // Process MCQs in reordered sequence WITH CUSTOM MARKS
    mcq.forEach((question: any) => {
      const customMark = customMarksMap.get(question.id) || question.marks || mcqMarks;
      finalQuestions.push({
        order_number: orderNumber++,
        question_type: 'mcq',
        question_id: question.id,
        questions: {
          ...question,
          // Ensure marks are included
          marks: customMark
        },
        custom_marks: customMark
      });
    });
    
    // Process Short questions in reordered sequence WITH CUSTOM MARKS
    short.forEach((question: any) => {
      const customMark = customMarksMap.get(question.id) || question.marks || shortMarks;
      finalQuestions.push({
        order_number: orderNumber++,
        question_type: 'short',
        question_id: question.id,
        questions: {
          ...question,
          marks: customMark
        },
        custom_marks: customMark
      });
    });
    
    // Process Long questions in reordered sequence WITH CUSTOM MARKS
    long.forEach((question: any) => {
      const customMark = customMarksMap.get(question.id) || question.marks || longMarks;
      finalQuestions.push({
        order_number: orderNumber++,
        question_type: 'long',
        question_id: question.id,
        questions: {
          ...question,
          marks: customMark
        },
        custom_marks: customMark
      });
    });
    
    console.log(`✅ Using ${finalQuestions.length} reordered questions from frontend with custom marks`);
  } else {
    // Fallback to database order (existing code)
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

    finalQuestions = paperQuestions || [];
    console.log(`✅ Using ${finalQuestions.length} questions from database order`);
  }

  console.log(`📊 Final question order for PDF generation:`);
  finalQuestions.forEach((pq: any, index: number) => {
    console.log(`   ${index + 1}. Type: ${pq.question_type}, Order: ${pq.order_number}, ID: ${pq.question_id}, Marks: ${pq.custom_marks}`);
  });

  if (!finalQuestions || finalQuestions.length === 0) {
    throw new Error('No questions found for the generated paper');
  }

  // Generate HTML content for PDF
  const isUrdu = language === 'urdu';
  const isBilingual = language === 'bilingual';
  const isEnglish = language === 'english';
  const separateMCQ = mcqPlacement === 'separate';
  const paperLayout = mcqPlacement;  // 'single_page' or 'separate' or 'two_papers
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
      .eq('id', paper.subject_id)
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
      subject = 'Subject';
      subject_ur = 'مضمون';
    }

    // Fetch class details
    const { data: classData, error: classError } = await supabaseAdmin
      .from('classes')
      .select('name')
      .eq('id', paper.class_id)
      .single();

    if (!classError && classData) {
      paperClass = classData.name.toString();
    } else {
      console.warn('Using fallback class data due to error:', classError);
      paperClass = 'Class';
    }
  } catch (error) {
    console.error('Error fetching subject/class details:', error);
    // Continue with fallback values
    subject = 'Subject';
    subject_ur = 'مضمون';
    paperClass = 'Class';
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

  const timeToDisplay = separateMCQ ? requestData.mcqTimeMinutes : paper.time_minutes;
  const subjectiveTimeToDisplay = separateMCQ ? requestData.subjectiveTimeMinutes : paper.time_minutes;

  // Get questions by type from the final ordered list
  const mcqQuestions = finalQuestions.filter((pq: any) => 
    pq.question_type === 'mcq' && pq.questions
  );

  const subjectiveQuestions = finalQuestions.filter((pq: any) => 
    pq.question_type !== 'mcq' && pq.questions
  );

  const shortQuestions = subjectiveQuestions.filter((pq: any) => 
    pq.question_type === 'short'
  );

  const longQuestions = subjectiveQuestions.filter((pq: any) => 
    pq.question_type === 'long'
  );

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
    .header {text-align:center; font-size: 13px;  }
    .header h1 { font-size: 14px; }
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
  line-height: 1.5;
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

    .note {  padding: 0px; margin:0 0; font-size: 12px; line-height: 1.1; }
    table { width: 100%; border-collapse: collapse; margin: 4px 0; font-size: 14px; ${isEnglish? ' direction:ltr' : ' direction:rtl'}}
    table, th, td { border: 1px solid #000; }
    td { padding: 3px; vertical-align: top; }
    hr{color:black}
    .qnum { width: 20px; text-align: center; font-weight: bold; }
    .question { display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 0 0;
     font-size:11px; 
    }
    ol li{ font-size:9px; }
    .student-info{ margin-top: 10px; margin-bottom:10px; display: flex; justify-content: space-between;  flex-direction: ${isEnglish ? 'row-reverse' : 'row'}; }
  
    .options { margin-top: 0px; display: flex; justify-content: space-between; font-size: 11px; }
    .footer { 
      text-align: left; 
      margin-top: 10px; 
      font-size: 10px; 

      /* Prevent footer being pushed to a new page */
      page-break-inside: avoid;
      break-inside: avoid;
      -webkit-column-break-inside: avoid;
      -webkit-region-break-inside: avoid;
    }

    /* Utility class to keep any block together on a single page */
    .no-break {
      page-break-inside: avoid;
      break-inside: avoid;
      -webkit-column-break-inside: avoid;
      -webkit-region-break-inside: avoid;
    }

    /* Marks styling */
    .marks-display {
      color: #5a5a5aff;
      font-weight: bold;
      
      margin-left: 2px;
      font-size: 10px;
    }
    .urdu .marks-display {
      margin-left: 0;
      margin-right: 2px;
    }
  </style>
</head>
<body>

<div class="container" ${mcqPlacement === 'two_papers' ? 'style="height:525px; overflow:hidden"' : ''}>

    <div class="header">
     <h1 class="eng text-center">
        ${logoBase64 ? `<img src="${logoBase64}" class="header-img"  height="60" width="140"/>` : ''} <br/>
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
      ${isUrdu || isBilingual ? `<span class="metaUrdu">وقت: ${convertMinutesToTimeFormat(timeToDisplay || paper.time_minutes)} منٹ</span>` : ''}
      ${isEnglish || isBilingual ? `<span class="metaEng">Time Allowed: ${convertMinutesToTimeFormat(timeToDisplay || paper.time_minutes)} Minutes</span>` : ''}
    </td>
    <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1;">
      ${isUrdu || isBilingual ? `<span class="metaUrdu">کل نمبر: ${paper.total_marks}</span>` : ''}
      ${isEnglish || isBilingual ? `<span class="metaEng">Maximum Marks: ${paper.total_marks}</span>` : ''}
    </td>
   <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1;">
   ${mcqPlacement==="separate" ||mcqPlacement==="two_papers" ? (isUrdu || isBilingual ? `<span class="metaUrdu">حصہ معروضی</span>` : '') :  isUrdu || isBilingual ? `<span class="metaUrdu">حصہ معروضی/انشائیہ</span>` : ''} 
   ${mcqPlacement==="separate" ||mcqPlacement==="two_papers" ? (isEnglish || isBilingual ? `<span class="metaEng">Subjective Part</span>` : '') : isEnglish || isBilingual ? `<span class="metaEng">Subjective/Objective Part</span>` : ''} 
   </td>
  </tr>
</table>
<hr  style="color:black;"/> <br />`;

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

    // Process MCQ questions in the final ordered sequence
    mcqQuestions.forEach((pq: any, index: number) => {
      const q = pq.questions;
      const questionMarks = pq.custom_marks || mcqMarks;
      
      const { eng: englishQuestionRaw, ur: urduQuestionRaw } = extractEnglishAndUrdu(q.question_text, q.question_text_ur);
      const englishQuestion = formatQuestionText(englishQuestionRaw || '');
      const urduQuestion = formatQuestionText(urduQuestionRaw || '');
      
      let questionDisplayHtml = '<div class="question">';
      if (isEnglish) {
          questionDisplayHtml += `<span class="eng">${englishQuestion.trim()}</span>`;
      } else if (isUrdu) {
          questionDisplayHtml += `<span class="urdu">${urduQuestion.trim() || englishQuestion.trim()}</span>`;
      } else { // bilingual
          questionDisplayHtml += `<span class="urdu">${urduQuestion.trim()}</span><span class="eng">${englishQuestion.trim()}</span>`;
      }
      
      // ADD MARKS DISPLAY FOR MCQ
      //questionDisplayHtml += `<span class="marks-display">[${questionMarks} mark${questionMarks !== 1 ? 's' : ''}]</span>`;
      
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

      // Use the display index (1-based) for numbering - this respects the reordering
      htmlContent += `
   <tr>
      <td class="qnum">${index + 1}</td>
      <td>
        ${questionDisplayHtml}
        <div class="options">${optionsHtml}</div>
      </td>
    </tr>
  `;
    });

    htmlContent += `
       </table>
${mcqPlacement==="separate" || mcqPlacement==="two_papers" ? `
    <div class="footer no-break" style="margin-top: 5px; text-align: center; font-size: 10px; color: #666; border-top: 1px solid #ccc; padding-top: 5px;">
    <p class="english">Generated on ${new Date().toLocaleDateString()} | www.examly.pk | Generate papers Save Time</p>
    
</div>
  </div>` : ``}
  
</div>`;
  }


if(mcqPlacement==="two_papers"){
  //htmlContent += `  <div style="margin:20px; border-top:1px solid black; border-style: dotted;"></div>`;
  htmlContent += ` <div style="display:flex; align-items:center;">
  <span style="font-size:18px; margin-right:6px;">✂</span>
  <hr style="flex:1; border-top: 2px dotted black;" />
</div>
`+htmlContent;
}

htmlContent += ` ${mcqPlacement==="separate" || mcqPlacement==="two_papers"  ? `
    <!-- Page break before subjective section -->
    <div style="page-break-before: always;"></div>` : ''}
`;


  // Determine attempt counts once (available to both short and long sections)
  const shortToAttempt = Number(paper.short_to_attempt ?? requestData.shortToAttempt ?? requestData.shortCount ?? 0);
  const longToAttempt = Number(paper.long_to_attempt ?? requestData.longToAttempt ?? requestData.longCount ?? 0);
 
  // Helper: Convert number to roman style (i, ii, iii …)
  function toRoman(num: number): string {
    const romans = ['i','ii','iii','iv','v','vi','vii','viii','ix','x','xi','xii','xiii','xiv','xv','xvi','xvii','xviii'];
    return romans[num - 1] || num.toString();
  }
let subjectiveContent = ``;
  subjectiveContent += ` <div class="container" ${mcqPlacement === 'two_papers' ? 'style="height:525px; overflow:hidden"' : ''}>
  ${mcqPlacement==="separate" || mcqPlacement==="two_papers"  ? `
     <div class="header">
   <h1 class="eng text-center">
      ${logoBase64 ? `<img src="${logoBase64}" class="header-img"  height="60" width="140"/>` : ''} <br/>
   <span class="institute">   ${englishTitle} </span>
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
    ${isUrdu || isBilingual ? `<span class="metaUrdu">وقت: ${convertMinutesToTimeFormat(timeToDisplay || paper.time_minutes)} منٹ</span>` : ''}
    ${isEnglish || isBilingual ? `<span class="metaEng">Time Allowed: ${convertMinutesToTimeFormat(timeToDisplay || paper.time_minutes)} Minutes</span>` : ''}
  </td>
  <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1;">
      ${isUrdu || isBilingual ? `<span class="metaUrdu">کل نمبر: ${paper.total_marks}</span>` : ''}
      ${isEnglish || isBilingual ? `<span class="metaEng">Maximum Marks: ${paper.total_marks}</span>` : ''}
    </td>
  <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1;">

         ${isUrdu || isBilingual ? `<span class="metaUrdu">حصہ انشائیہ</span>` : ''}
      ${isEnglish || isBilingual ? `<span class="metaEng">Subjective Part</span>` : ''}
    </td>
</tr>
</table>
<hr  style="color:black;"/>  `:``
  }    
  `;

  // Add subjective questions
  if (subjectiveQuestions.length > 0) {
    subjectiveContent += `

   <div class="header" style="font-size:13px; font-weight:bold; display: flex; align-items: baseline; justify-content: center; gap: 5px;">
    (
    ${(isEnglish || isBilingual) ? `<span class="english" style="vertical-align: baseline;">Part - I</span>` : ''}
    ${(isUrdu || isBilingual) ? `<span class="urdu" style="vertical-align: baseline; position: relative; top: 1px;">حصہ اول</span>` : ''}
    )
  </div>
  
`;

    const isBoardPaper = (paper.paper_type === 'model' || requestData.paperType === 'model');

    if (shortQuestions.length > 0) {
      if (isBoardPaper) {
        // Board Paper: group short questions (e.g. 6 per group) and show per-group instruction with attempt count
        const questionsPerGroup = 6;
        const totalGroups = Math.ceil(shortQuestions.length / questionsPerGroup);

        for (let g = 0; g < totalGroups; g++) {
          const groupQuestions = shortQuestions.slice(
            g * questionsPerGroup,
            (g + 1) * questionsPerGroup
          );

          // Q. numbering starts from 2 for Part I in board layout, keep group index as displayed number
          const questionNumber = g + 2;

          let instructionHtml = '<div style="display:flex; justify-content:space-between; margin-bottom:2px; margin-top:4px; font-weight:bold">';
          if (isEnglish || isBilingual) {
            instructionHtml += `<div class="eng"><strong>${questionNumber}.</strong> Write short answers to any ${shortToAttempt} question(s).</div>`;
          }
          if (isUrdu || isBilingual) {
            instructionHtml += `<div class="urdu" style="direction:rtl;"><strong><span>${questionNumber}.</span> جوابات میں سے ${shortToAttempt} سوالات کے مختصر جوابات لکھیں۔ </strong></div>`;
          }
          instructionHtml += '</div>';

          subjectiveContent += `
    
    <div class="short-questions ${isUrdu ? 'urdu' : ''}" style="line-height:1.2; font-size:12px;">
      ${instructionHtml}
  `;

          groupQuestions.forEach((pq: any, idx: number) => {
            const q = pq.questions;
            const questionMarks = pq.custom_marks || shortMarks;
            
            const { eng: englishQuestionRaw, ur: urduQuestionRaw } = extractEnglishAndUrdu(q.question_text, q.question_text_ur);
            const englishQuestion = formatQuestionText(englishQuestionRaw || '');
            const urduQuestion = formatQuestionText(urduQuestionRaw || '');

            let questionItemHtml = '<div class="short-question-item" style="display:flex; justify-content:space-between; margin-bottom:0px; line-height:1.5; font-size:12px;">';
            if (isEnglish) {
                questionItemHtml += `<div class="eng">(${toRoman(idx + 1)}) ${englishQuestion} <span class="marks-display">(${questionMarks})</span></div>`;
            } else if (isUrdu) {
                questionItemHtml += `<div class="urdu" style="direction:rtl;">(${toRoman(idx + 1)}) ${urduQuestion || englishQuestion} <span class="marks-display">(${questionMarks})</span></div>`;
            } else { // bilingual
                questionItemHtml += `<div class="eng">(${toRoman(idx + 1)}) ${englishQuestion} <span class="marks-display">(${questionMarks})</span></div>`;
                if (hasActualUrduText(urduQuestion)) {
                    questionItemHtml += `<div class="urdu" style="direction:rtl;">(${toRoman(idx + 1)}) ${urduQuestion} <span class="marks-display">(${questionMarks})</span></div>`;
                }
            }
            questionItemHtml += '</div>';

            subjectiveContent += `
       ${questionItemHtml}
    `;
          });

          subjectiveContent += `
     </div>
  `;
        }
      } else {
        // Custom Paper: single heading + flat list of all short questions
        let instructionHtml = '<div style="display:flex;  justify-content:space-between; margin-bottom:0px; font-weight:bold">';
        if (isEnglish || isBilingual) {
          instructionHtml += `<div class="eng"> Write short answers of any ${shortToAttempt} question(s).</div>`;
        }
        if (isUrdu || isBilingual) {
          instructionHtml += `<div class="urdu" style="direction:rtl;">  کوئی سے  ${shortToAttempt} سوالات کے مختصرجوابات تحریر کریں۔</div>`;
        }
        instructionHtml += '</div>';

        subjectiveContent += `<div class="short-questions ${isUrdu ? 'urdu' : ''}"> ${instructionHtml}`;

        shortQuestions.forEach((pq: any, idx: number) => {
          const q = pq.questions;
          const questionMarks = pq.custom_marks || shortMarks;
          
          const { eng: englishQuestionRaw, ur: urduQuestionRaw } = extractEnglishAndUrdu(q.question_text, q.question_text_ur);
          const englishQuestion = formatQuestionText(englishQuestionRaw || '');
          const urduQuestion = formatQuestionText(urduQuestionRaw || '');

          let questionItemHtml = '<div class="short-question-item" style="display:flex; justify-content:space-between; margin-bottom:0px; line-height:1.5; font-size:12px;">';
          if (isEnglish) {
              questionItemHtml += `<div class="eng">(${idx + 1}) ${englishQuestion} <span class="marks-display">(${questionMarks})</span></div>`;
          } else if (isUrdu) {
              questionItemHtml += `<div class="urdu" style="direction:rtl;">(${idx + 1}) ${urduQuestion || englishQuestion} <span class="marks-display">(${questionMarks})</span></div>`;
          } else { // bilingual
              questionItemHtml += `<div class="eng">(${idx + 1}) ${englishQuestion} <span class="marks-display">(${questionMarks})</span></div>`;
              if (hasActualUrduText(urduQuestion)) {
                  questionItemHtml += `<div class="urdu" style="direction:rtl;">(${idx + 1}) ${urduQuestion} <span class="marks-display">(${questionMarks})</span></div>`;
              }
          }
          questionItemHtml += '</div>';

          subjectiveContent += `
          ${questionItemHtml}
        `;
        });

        subjectiveContent += `</div>`;
      }
    }
  }

  // Add long questions
   // Add long questions
  if (longQuestions.length > 0) {
    // Long Questions Section Header
    subjectiveContent += `
  <div class="header" style="font-weight:bold; display: flex; align-items: baseline; justify-content: center; gap: 5px;">
    (
    ${(isEnglish || isBilingual) ? `<span class="english" style="vertical-align: baseline;">Part - II</span>` : ''}
    ${(isUrdu || isBilingual) ? `<span class="urdu" style="vertical-align: baseline; position: relative; top: 1px;">حصہ دوم</span>` : ''}
    )
  </div>
  <div class="instructions1" style="font-weight: bold; font-size: 14px; line-height: 1.4; display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; margin-top: 4px;">`;

    // use computed longToAttempt above (fallbacks already applied)
    if (isEnglish || isBilingual) {
      subjectiveContent += `<div class="instruction-text eng" style="vertical-align: baseline;"><span>Note:</span> Attempt any ${longToAttempt} question(s) in detail.</div>`;
    }
    if (isUrdu || isBilingual) {
      subjectiveContent += `<div class="instruction-text urdu" style="direction: rtl; vertical-align: baseline; position: relative; top: 1px;"><span>نوٹ:</span> کوئی ${longToAttempt} سوالات کے تفصیل سے جوابات تحریر کریں۔</div>`;
    }
    subjectiveContent += `</div>
`;
    longQuestions.forEach((pq: any, idx: number) => {
      const q = pq.questions;
      const questionMarks = pq.custom_marks || longMarks;
      
      const englishQuestion = formatQuestionText(q.question_text || 'No question text available');
      const hasUrduQuestion = hasActualUrduText(q.question_text_ur);
      const urduQuestion = hasUrduQuestion ? formatQuestionText(q.question_text_ur) : '';

      // Sub-questions (not implemented in current schema, but keeping for future)
      const subQuestions: any[] = [];
      let subQsHTML = '';

      if (subQuestions.length > 0) {
        subQsHTML += `
      <div style="display: flex; justify-content:space-between; font-size:12px; margin-top:0px; line-height:1.5;">
        ${isEnglish || isBilingual ? `<div class="eng" style="width: 48%;"><ol type="a">${subQuestions.map((sq: any) => `<li>${formatQuestionText(sq.question_text || '')}</li>`).join('')}</ol></div>` : ''}
        ${isUrdu || isBilingual ? `<div class="urdu" style="width: 48%; direction: rtl; text-align: right;"><ol type="a">${subQuestions.map((sq: any) => `<li>${formatQuestionText(sq.question_text_ur || '')}</li>`).join('')}</ol></div>` : ''}
      </div>
    `;
      }

      let longQuestionDisplayHtml = '<div class="long-question" style="margin-bottom:2px;"><div style="display: flex; justify-content:space-between; font-size:11px; margin-top:0px;  line-height:1.2;">';
      if (isEnglish) {
          longQuestionDisplayHtml += `<div class="eng" style="width:100%;"><strong>Q.${idx + 1}.</strong> ${englishQuestion} <span class="marks-display">(${questionMarks})</span></div>`;
      } else if (isUrdu) {
          longQuestionDisplayHtml += `<div class="urdu" style="width:100%; direction:rtl; text-align:right;"><strong>سوال ${idx + 1}:</strong> ${urduQuestion} <span class="marks-display">(${questionMarks})</span></div>`;
      } else { // bilingual
          longQuestionDisplayHtml += `<div class="eng" style="width:48%;"><strong>Q.${idx + 1}.</strong> ${englishQuestion} <span class="marks-display">(${questionMarks})</span></div>`;
          if (hasUrduQuestion) {
              longQuestionDisplayHtml += `<div class="urdu" style="width:48%; direction:rtl; text-align:right;"><strong>سوال ${idx + 1}:</strong> ${urduQuestion} <span class="marks-display">(${questionMarks})</span></div>`;
          }
      }
      longQuestionDisplayHtml += `</div>${subQsHTML}</div>`;

      subjectiveContent += `
    ${longQuestionDisplayHtml}
  `;
    });
  }

  subjectiveContent += `
  
`;

  // Footer
  subjectiveContent += `
  <div class="footer no-break" style="margin-top: 30px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #ccc; padding-top: 5px;">
    <p class="english">Generated on ${new Date().toLocaleDateString()} | www.examly.pk | Generate papers Save Time</p>
  </div>
</div>
</div>
`;

  // Check if user is on trial for watermark
  const isTrialUser = await checkUserSubscription(userId);
  if (isTrialUser) {
    subjectiveContent += `
<div class="watermark">
  <div class="watermark-text">
    www.examly.pk  
  
    
  </div>
</div>

`;
  }

  if(mcqPlacement==="two_papers"){
    subjectiveContent +=  `<div style="display:flex; align-items:center;">
  <span style="font-size:18px; margin-right:6px;">✂</span>
  <hr style="flex:1; border-top: 2px dotted black;" />
</div>
`+subjectiveContent;
    htmlContent += subjectiveContent;
  }else
{
  htmlContent += subjectiveContent;
}
  htmlContent += `
</body>
</html>
`;
// Simplify and optimize HTML content
  return optimizeHtmlForPuppeteer(simplifyHtmlContent(htmlContent));
}

// Function to generate PDF from HTML
async function generatePDFFromHTML(htmlContent: string) {
  let browser: Browser | null = null;
  let page: Page | null = null;
  
  try {
    console.log('🔄 Getting Puppeteer browser instance...');
    browser = await getPuppeteerBrowser();
    console.log('✅ Browser instance obtained');
    
    page = await browser.newPage();
    console.log('✅ New page created');
    
    // Set reasonable timeouts
    page.setDefaultTimeout(120000);
    page.setDefaultNavigationTimeout(120000);
    
    // Optimize page for performance
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Disable unnecessary resources for faster loading
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (resourceType === 'image' || resourceType === 'font' || resourceType === 'stylesheet') {
        req.abort();
      } else {
        req.continue();
      }
    });

    console.log('🔄 Setting HTML content...');
    
    // Use setContent with simpler wait conditions
    await page.setContent(htmlContent, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    console.log('✅ HTML content set, waiting for fonts...');
    
    // Wait for fonts to load with timeout
    await Promise.race([
      page.evaluate(() => document.fonts.ready),
      new Promise(resolve => setTimeout(resolve, 10000))
    ]);

    console.log('✅ Fonts loaded, generating PDF...');
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
      preferCSSPageSize: true,
      timeout: 60000
    });

    console.log('✅ PDF generated successfully');
    return pdfBuffer;
    
  } catch (error) {
    console.error('❌ PDF generation error:', error);
    if (page) {
      try {
        await page.close();
      } catch (e) {
        console.warn('Error closing page:', e);
      }
    }
    throw error;
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (e) {
        console.warn('Error closing page in finally:', e);
      }
    }
  }
}

// FAST RPC helper - prefer server-side random sampling
async function tryRpcRandomQuestions(
  qtype: string,
  subjectId: string,
  classId: string,
  chapterIds: string[] | undefined,
  source_type: string | undefined,
  difficulty: string | undefined,
  count: number
) {
  try {
    // Prepare RPC params
    const params: any = {
      p_subject: subjectId,
      p_class_id: classId || null,
      p_chapter_ids: (chapterIds && chapterIds.length > 0) ? chapterIds : null,
      p_qtype: qtype,
      p_difficulty: (difficulty && difficulty !== 'any') ? difficulty : null,
      p_source_type: (source_type && source_type !== 'all') ? source_type : null,
      p_limit: count
    };

    // Try server side RPC first (fast random sampling)
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('get_random_questions', params);
    if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
      console.log(`✅ RPC returned ${rpcData.length} ${qtype} questions`);
      return rpcData;
    }
    if (rpcError) {
      console.warn('RPC get_random_questions returned error:', rpcError);
    } else {
      console.log('RPC returned no rows, falling back to DB query');
    }

    // Fallback: query DB directly with same filters (non-random ordering here; caller may shuffle)
    const dbSourceType = source_type ? mapSourceType(source_type) : undefined;
    const classSubjectId = await getClassSubjectId(classId, subjectId);

    let query = supabaseAdmin
      .from('questions')
      .select('id, question_text, question_text_ur, option_a, option_b, option_c, option_d, option_a_ur, option_b_ur, option_c_ur, option_d_ur, correct_option, difficulty, chapter_id, source_type, class_subject_id, question_type')
      .eq('question_type', qtype)
      .eq('subject_id', subjectId);

    if (chapterIds && chapterIds.length > 0) {
      query = query.in('chapter_id', chapterIds);
    } else if (classSubjectId) {
      query = query.eq('class_subject_id', classSubjectId);
    } else if (classId) {
      // try to restrict to chapters belonging to class
      const { data: relevantChapters, error: chaptersError } = await supabaseAdmin
        .from('chapters')
        .select('id')
        .eq('subject_id', subjectId)
        .eq('class_id', classId);
      if (!chaptersError && relevantChapters && relevantChapters.length > 0) {
        const relevantChapterIds = relevantChapters.map((c: any) => c.id);
        query = query.in('chapter_id', relevantChapterIds);
      }
    }

    if (dbSourceType && dbSourceType !== 'all') {
      query = query.eq('source_type', dbSourceType);
    }
    if (difficulty && difficulty !== 'any') {
      query = query.eq('difficulty', difficulty);
    }

    query = query.limit(count);

    const { data: rows, error: dbError } = await query;
    if (dbError) {
      console.warn('Fallback DB query error in tryRpcRandomQuestions:', dbError);
      return null;
    }
    if (!rows || rows.length === 0) {
      console.log('Fallback DB query returned no rows');
      return null;
    }

    console.log(`✅ Fallback DB returned ${rows.length} ${qtype} questions`);
    return rows;
  } catch (err) {
    console.warn('tryRpcRandomQuestions failed:', err);
    return null;
  }
}

// Main POST function
export async function POST(request: Request) {
  console.log('📄 POST request received to generate paper');
  
  const startTime = Date.now();
  let paper: any;

  try {
    // Use the enhanced token extraction
    const token = extractToken(request);
console.log('🔐 Token present:', token ? `${token.slice(0,6)}...${token.slice(-6)}` : 'none');
    if (!token) {
      console.warn('No authorization token found in headers or cookies');
      return NextResponse.json({ error: 'Authorization token required' }, { status: 401 });
    }

    console.log('🔐 Token found, verifying user...');

    // Verify user with better error handling
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError) {
      console.error('Token validation error:', userError);
      
      // Specific handling for common token issues
      if (userError.message.includes('JWT')) {
        return NextResponse.json({ 
          error: 'Invalid or expired token. Please sign in again.' 
        }, { status: 401 });
      }
      
      return NextResponse.json({ 
        error: 'Authentication failed',
        details: process.env.NODE_ENV === 'development' ? userError.message : undefined
      }, { status: 401 });
    }

    if (!user) {
      console.error('No user found for valid token');
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    console.log(`👤 User ${user.id} authenticated successfully`);
    console.log(`🔐 User auth method: ${user.app_metadata?.provider || 'email'}`);

    // Fetch user's profile logo before processing the request
    console.log('🔄 Fetching user profile logo...');
    const logoBase64 = await getUserLogoBase64(user.id);
    console.log('✅ User logo processed');

    const requestData: PaperGenerationRequest = await request.json();
    console.log('📋 Request data received:', {
      title: requestData.title,
      subjectId: requestData.subjectId,
      classId: requestData.classId,
      chapterOption: requestData.chapterOption,
      selectionMethod: requestData.selectionMethod,
      randomSeed: requestData.randomSeed,
      hasReorderedQuestions: !!requestData.reorderedQuestions,
      hasCustomMarksData: !!requestData.customMarksData
    });

    const { 
      title,
      subjectId,
      classId
    } = requestData;

    // Validation
    if (!title || !subjectId || !classId) {
      return NextResponse.json(
        { error: 'Title, subject ID, and class ID are required' },
        { status: 400 }
      );
    }

    // Create paper record
    paper = await createPaperRecord(requestData, user.id);
    
    // Process question types
    const questionInserts = [];
    const { 
      mcqCount = 0, 
      shortCount = 0, 
      longCount = 0,
      mcqDifficulty = 'any',
      shortDifficulty = 'any', 
      longDifficulty = 'any',
      source_type = 'all',
      chapterOption = 'full_book',
      selectedChapters = [],
      selectionMethod = 'manual',
      selectedQuestions,
      reorderedQuestions,
      randomSeed = Date.now(),
      shuffleQuestions = true
    } = requestData;

    // Determine chapters to include
    let chapterIds: string[] = [];
    if (chapterOption === 'full_book') {
      const { data: chapters } = await supabaseAdmin
        .from('chapters')
        .select('id')
        .eq('subject_id', subjectId)
        .eq('class_id', classId);
      chapterIds = chapters?.map(c => c.id) || [];
      console.log(`📚 Full book chapters found: ${chapterIds.length}`);
    } else if ((chapterOption === 'custom' || chapterOption === 'single_chapter') && selectedChapters && selectedChapters.length > 0) {
      // Handle both custom (multi) and single_chapter (single id in array)
      chapterIds = selectedChapters;
      console.log(`🎯 Chapters selected (${chapterOption}): ${chapterIds.length}`);
    }

    console.log(`🎯 Final chapter IDs to use: ${chapterIds.length}`);

    // FIXED: Manual selection with proper question verification AND reordering
    if (selectionMethod === 'manual' && selectedQuestions) {
      console.log('🔧 Using manual question selection');

      // NEW: Check if we have reordered questions from the frontend
      if (reorderedQuestions) {
        console.log('🔄 Using reordered questions from preview');
        
        let orderNumber = 1;
        
        // Process questions in the exact order from preview
        const questionTypes = ['mcq', 'short', 'long'] as QuestionType[];
        
        for (const qType of questionTypes) {
          const questions = reorderedQuestions[qType] || [];
          if (questions.length > 0) {
            console.log(`🔍 Processing ${questions.length} reordered ${qType} questions`);
            
            for (const question of questions) {
              questionInserts.push({
                paper_id: paper.id,
                question_id: question.id,
                order_number: orderNumber++,
                question_type: qType
              });
            }
            
            console.log(`✅ Added ${questions.length} reordered ${qType} questions`);
          }
        }
      } else {
        // Fallback to original manual selection logic
        console.log('📝 Using original manual selection (no reordering data)');
        
        const questionTypes = [
          { type: 'mcq' as const, questions: selectedQuestions.mcq || [] },
          { type: 'short' as const, questions: selectedQuestions.short || [] },
          { type: 'long' as const, questions: selectedQuestions.long || [] }
        ];

        let orderNumber = 1;
        
        for (const qType of questionTypes) {
          const qList = Array.isArray(qType.questions) ? qType.questions : [];
          
          if (qList.length > 0) {
            console.log(`🔍 Verifying ${qList.length} manually selected ${qType.type} questions`);
            
            // Verify these questions exist and belong to the correct subject/class
           
            const { data: existingQuestions, error: verifyError } = await supabaseAdmin
              .from('questions')
              .select('id, subject_id, chapter_id')
              .in('id', qList)
              .eq('subject_id', subjectId);

            if (verifyError) {
              console.error('Error verifying questions:', verifyError);
              continue;
            }

            if (!existingQuestions || existingQuestions.length === 0) {
              console.warn(`⚠️ No valid ${qType.type} questions found for manual selection`);
              continue;
            }

            console.log(`✅ Found ${existingQuestions.length} valid ${qType.type} questions`);

            // Insert the valid questions in the order they were selected
            for (const questionId of qList) {
              const questionExists = existingQuestions.find(q => q.id === questionId);
              if (questionExists) {
                questionInserts.push({
                  paper_id: paper.id,
                  question_id: questionId,
                  order_number: orderNumber++,
                  question_type: qType.type
                });
              }
            }

            console.log(`✅ Added ${existingQuestions.length} manually selected ${qType.type} questions`);
          }
        }
      }
    } else {
      // Auto selection logic
      console.log('🤖 Using auto question selection');
      
      const questionTypes = [
        { type: 'mcq' as const, count: mcqCount, difficulty: mcqDifficulty },
        { type: 'short' as const, count: shortCount, difficulty: shortDifficulty },
        { type: 'long' as const, count: longCount, difficulty: longDifficulty }
      ];

      let orderNumber = 1;

      for (const qType of questionTypes) {
        if (qType.count > 0) {
          console.log(`🔍 Finding ${qType.count} ${qType.type} questions...`);
          
          const questions = await findQuestionsWithFallback(
            qType.type,
            subjectId,
            classId,
            chapterIds,
            source_type,
            qType.difficulty,
            qType.count,
            randomSeed
          );

          if (questions && questions.length > 0) {
            for (const question of questions) {
              questionInserts.push({
                paper_id: paper.id,
                question_id: question.id,
                order_number: orderNumber++,
                question_type: qType.type
              });
            }
            console.log(`✅ Added ${questions.length} ${qType.type} questions`);
          } else {
            console.warn(`⚠️ No ${qType.type} questions found`);
          }
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
        await supabaseAdmin.from('papers').delete().eq('id', paper.id);
        throw insertError;
      }
    } else {
      await supabaseAdmin.from('papers').delete().eq('id', paper.id);
     
      return NextResponse.json(
        { 
          error: 'No questions found matching your criteria. Please try different filters.'
        },
        { status: 400 }
      );
    }

    // Generate PDF
    console.log('🔄 Generating HTML content...');
    const htmlContent = await generatePaperHTML(paper, user.id, requestData, logoBase64);

    console.log('🔄 Creating PDF from HTML...');
    const pdfBuffer = await generatePDFFromHTML(htmlContent);

    // Increment user's papers_generated counter (best-effort)
    try {
      await incrementPapersGenerated(user.id);
    } catch (incErr) {
      console.warn('Failed to increment papers generated count:', incErr);
    }

    console.log(`✅ Paper generation completed successfully in ${Date.now() - startTime}ms`);

    // Return PDF as response
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdfBuffer.length),
        'Content-Disposition': `attachment; filename="${(paper.title || 'paper').replace(/[^a-z0-9_\-\.]/gi, '_')}.pdf"`,
      },
    });
  } catch (error) {
    console.error('❌ Error generating paper:', error);
    
    // Detailed error logging
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }

    // Clean up created paper if it exists (best-effort)
    try {
      if (typeof paper !== 'undefined' && paper?.id) {
        await supabaseAdmin.from('papers').delete().eq('id', paper.id);
        console.log('✅ Cleaned up paper record after error');
      }
    } catch (cleanupErr) {
      console.warn('Failed to cleanup paper record after error:', cleanupErr);
    }

    return NextResponse.json(
      { 
        error: 'Failed to generate paper. Please try again later.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  } finally {
    console.log(`⏱️ Total request time: ${Date.now() - startTime}ms`);
  }
}

// GET endpoint for manual question selection
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const subjectId = searchParams.get('subjectId');
  const classId = searchParams.get('classId');
  const chapterIds = searchParams.get('chapterIds')?.split(',') || [];
  const sourceType = searchParams.get('sourceType');
  const difficulty = searchParams.get('difficulty');

  if (!subjectId || !classId) {
    return NextResponse.json({ error: 'Subject ID and Class ID are required' }, { status: 400 });
  }

  try {
    const questions = await getQuestionsForManualSelection(
      subjectId,
      classId,
      chapterIds,
      sourceType || undefined,
      difficulty || undefined
    );

    return NextResponse.json(questions);
  } catch (error) {
    console.error('Error fetching questions for manual selection:', error);
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
  }
}