/** app/api/generate-paper/route.ts */
//'use server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { supabase } from '@/lib/supabaseClient';
import type { PaperGenerationRequest, QuestionType, Question } from '@/types/types';
import { translate } from '@vitalets/google-translate-api';
import type { Browser, Page } from 'puppeteer-core';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import PDFDocument from 'pdfkit';
import { is } from 'zod/v4/locales';

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
    ////console.log('🚀 Launching Puppeteer browser...');
    ////console.log('Environment:', process.env.NODE_ENV);
    ////console.log('Vercel:', !!process.env.VERCEL);

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
        ////console.log('🔧 Configuring Chromium for production...');
        
        // Configure Chromium for Vercel
        launchOptions.executablePath = await chromium.executablePath();
        launchOptions.defaultViewport = chromium.defaultViewport;
        
        ////console.log('✅ Using @sparticuz/chromium for production');
      } else {
        ////console.log('🔧 Configuring for development...');
        const chromePath = getChromePath();
        if (chromePath) {
          launchOptions.executablePath = chromePath;
          ////console.log('✅ Using local Chrome:', chromePath);
        } else {
          console.warn('⚠️ No local Chrome found, using system default');
        }
      }

      ////console.log('🔄 Launching browser with options...');
      ////console.log('Executable path:', launchOptions.executablePath);
      
      const browser = await puppeteer.launch(launchOptions);
      
      ////console.log('✅ Browser launched successfully');
      
      // Set up cleanup on disconnect
      browser.on('disconnected', () => {
        ////console.log('🔌 Browser disconnected, clearing instance');
        browserPromise = null;
      });
      
      return browser;
    } catch (error) {
     // console.error('❌ Failed to launch puppeteer:', error);
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
    if (p && existsSync(p)) return p;
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
    const fontPath = join(process.cwd(), 'public', 'fonts', fontFileName);
    if (existsSync(fontPath)) {
      const fontBuffer = readFileSync(fontPath);
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
    const { data: classSubject, error } = await supabase
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
  ////console.log(`\n🔍 Finding ${count} ${type} questions...`);
  ////console.log(`📋 Filters: subject=${subjectId}, class=${classId}, chapters=${chapterIds.length}, source_type=${source_type}, difficulty=${difficulty}`);
  ////console.log(`🎯 Selected Chapter IDs:`, chapterIds);
  
  // Map source_type to database values
  const dbSourceType = source_type ? mapSourceType(source_type) : undefined;
  
  // Get class_subject_id for filtering
  const classSubjectId = await getClassSubjectId(classId, subjectId);
  ////console.log(`🎯 Class Subject ID: ${classSubjectId}`);

  // Build query with proper filtering - ALWAYS start with subject and type
  let query = supabaseAdmin
    .from('questions')
    .select('id, question_text, question_text_ur, option_a, option_b, option_c, option_d, option_a_ur, option_b_ur, option_c_ur, option_d_ur, correct_option, difficulty, chapter_id, source_type, class_subject_id, question_type')
    .eq('question_type', type)
    .eq('subject_id', subjectId);

  // **CRITICAL FIX: Always apply chapter filtering FIRST if chapters are selected**
  if (chapterIds && chapterIds.length > 0) {
    ////console.log(`✅ Applying chapter filter: ${chapterIds.length} chapters`);
    query = query.in('chapter_id', chapterIds);
  } else {
    ////console.log('ℹ️ No specific chapters selected, will use class-based filtering');
  }

  // **FIX: Apply class filtering through class_subject_id**
  if (classSubjectId) {
    query = query.eq('class_subject_id', classSubjectId);
    ////console.log(`✅ Filtering by class_subject_id: ${classSubjectId}`);
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
      ////console.log(`📚 Found ${relevantChapterIds.length} chapters for class ${classId} and subject ${subjectId}`);
      
      // If no specific chapters were selected by user, use all relevant chapters
      if (!chapterIds || chapterIds.length === 0) {
        ////console.log(`✅ Using ${relevantChapterIds.length} relevant chapters for class filtering`);
        query = query.in('chapter_id', relevantChapterIds);
      } else {
        // If user selected specific chapters, ensure they belong to the right class
        const validChapterIds = chapterIds.filter(id => 
          relevantChapters.some(c => c.id === id)
        );
        if (validChapterIds.length > 0) {
          ////console.log(`✅ Using ${validChapterIds.length} valid chapters after class validation`);
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
    ////console.log(`✅ Filtering by source type: ${dbSourceType}`);
  }
  
  if (difficulty && difficulty !== 'any') {
    query = query.eq('difficulty', difficulty);
    ////console.log(`✅ Filtering by difficulty: ${difficulty}`);
  }

  ////console.log(`🎯 Final query filters applied:`);
  ////console.log(`   - Question Type: ${type}`);
  ////console.log(`   - Subject: ${subjectId}`);
  ////console.log(`   - Chapters: ${chapterIds?.length || 'all'}`);
  ////console.log(`   - Class Subject ID: ${classSubjectId || 'none'}`);
  ////console.log(`   - Source Type: ${dbSourceType || 'all'}`);
  ////console.log(`   - Difficulty: ${difficulty || 'any'}`);
  
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

  ////console.log(`📊 Found ${questions?.length || 0} questions after all filters`);

  if (!questions || questions.length === 0) {
    ////console.log('❌ No questions found with the applied filters');
    
    // Debug: Let's see what's available without filters
    const debugQuery = supabaseAdmin
      .from('questions')
      .select('id, chapter_id, subject_id, question_type, class_subject_id')
      .eq('question_type', type)
      .eq('subject_id', subjectId)
      .limit(10);
    
    const { data: debugQuestions } = await debugQuery;
    ////console.log('🐛 Debug - Questions available without chapter filter:', debugQuestions);
    
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
    ////console.log(`🔀 Applied randomization with seed: ${randomSeed}`);
  }

  // Take the required number of questions
  const selectedQuestions = finalQuestions.slice(0, count);
  
  ////console.log(`✅ Final selection: ${selectedQuestions.length} ${type} questions`);
  
  // Log the chapters of selected questions for verification
  const selectedChapters = [...new Set(selectedQuestions.map(q => q.chapter_id))];
  ////console.log(`📖 Selected questions come from ${selectedChapters.length} chapters:`, selectedChapters);
  
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
  ////console.log(`\n🔍 Getting questions for manual selection...`);
  ////console.log(`📋 Filters: subject=${subjectId}, class=${classId}, chapters=${chapterIds.length}, source_type=${source_type}, difficulty=${difficulty}`);
  
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

  ////console.log(`✅ Found ${questions?.length || 0} questions for manual selection`);
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
      ////console.log(`✅ Incremented papers_generated to ${newCount} for user ${userId}`);
    }
  } catch (error) {
    console.error('Failed to update papers_generated:', error);
  }
}

// Function to check user subscription
async function checkUserSubscription(userId: string): Promise<boolean> {
  try {
    const now = new Date().toISOString();

    const { data: subscription, error } = await supabaseAdmin
      .from('user_packages')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('is_trial', false) // ❗ exclude trial packages
      .gt('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('Subscription check error:', error);
      return false;
    }

    return !!subscription; // true only if paid subscription exists
  } catch (err) {
    console.warn('Error checking subscription:', err);
    return false;
  }
}

// Function to save user's PDF to storage and maintain last 5 PDFs
async function saveUserPDF(userId: string, pdfBuffer: Buffer, title: string): Promise<string> {
  try {
    const bucketName = 'generated-papers';
    const timestamp = Date.now();
    const sanitizedTitle = title.replace(/[^a-z0-9_\-\.]/gi, '_');
    const fileName = `${userId}/${timestamp}_${sanitizedTitle}.pdf`;

    // Upload the new PDF
    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: false // Don't overwrite existing files
      });

    if (uploadError) {
    //  console.error('Error uploading PDF:', uploadError);
      throw uploadError;
    }

    // List all PDFs for this user
    const { data: files, error: listError } = await supabaseAdmin.storage
      .from(bucketName)
      .list(userId, {
        limit: 100 // Get all files, should be manageable
      });

    if (listError) {
      console.warn('Error listing user PDFs:', listError);
      // Don't throw here, the upload succeeded
      return;
    }

    // Filter to get only PDF files and sort by filename (newest first due to timestamp prefix)
    const pdfFiles = (files || [])
      .filter(file => file.name.endsWith('.pdf'))
      .sort((a, b) => b.name.localeCompare(a.name)); // Sort by name descending (newest first)

    // If more than 5 PDFs, delete the oldest ones
    if (pdfFiles.length > 5) {
      const filesToDelete = pdfFiles.slice(5).map(file => `${userId}/${file.name}`);
      
      const { error: deleteError } = await supabaseAdmin.storage
        .from(bucketName)
        .remove(filesToDelete);

      if (deleteError) {
       // console.warn('Error deleting old PDFs:', deleteError);
        // Don't throw, the new upload succeeded
      } else {
        ////console.log(`🗑️ Deleted ${filesToDelete.length} old PDF(s) for user ${userId}`);
      }
    }

    ////console.log(`📄 Saved PDF: ${fileName} for user ${userId}`);
    return fileName;
  } catch (error) {
    console.error('Error in saveUserPDF:', error);
    throw error;
  }
}

// Function to generate MCQ paper key and save to key bucket
async function generateAndSaveMCQKey(userId: string, paperId: string, mcqQuestions: any[], subjectId: string, classId: string): Promise<string> {
  try {
    const bucketName = 'key';
    const timestamp = Date.now();
    const fileName = `${userId}/${timestamp}_${paperId}_key.pdf`;

    // Fetch subject and class names
    const { data: subject } = await supabaseAdmin
      .from('subjects')
      .select('name')
      .eq('id', subjectId)
      .single();

    const { data: classData } = await supabaseAdmin
      .from('classes')
      .select('name')
      .eq('id', classId)
      .single();

    const subjectName = subject?.name || 'Unknown Subject';
    const className = classData?.name || 'Unknown Class';

    // Generate HTML for the key
    let htmlContent = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { text-align: center; }
            p { margin: 5px 0; }
          </style>
        </head>
        <body>
          <h1 style="text-align: center;">MCQ Paper Key-www.examly.pk</h1>
         <div style="text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <p><strong>Class:</strong> ${className}</p>
          <p><strong>Subject:</strong> ${subjectName}</p>
          <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <br>
    `;

    mcqQuestions.forEach((pq: any, index: number) => {
      const q = pq.questions;
      const correctOption = q.correct_option;
      const questionNumber = index + 1;

      htmlContent += `<p>Q.${questionNumber}: ${correctOption}</p>`;
    });

    htmlContent += `
        </body>
      </html>
    `;

    // Get puppeteer browser
    const browser = await getPuppeteerBrowser();
    const page = await browser.newPage();

    // Set content and generate PDF
await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

// ✅ WAIT FOR ALL FONTS TO LOAD
await page.evaluate(() => document.fonts.ready);

const pdfBuffer = await page.pdf({
  format: 'A4',
  printBackground: true,
  margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
});

await page.close();

    // Upload the key PDF
    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Error uploading MCQ key:', uploadError);
      throw uploadError;
    }

    ////console.log(`🔑 Saved MCQ key: ${fileName} for user ${userId}`);
    return fileName;
  } catch (error) {
    console.error('Error in generateAndSaveMCQKey:', error);
    throw error;
  }
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
    const imagePath = join(process.cwd(), 'public', imageFileName);
    if (existsSync(imagePath)) {
      const imageBuffer = readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      const extension = extname(imageFileName).toLowerCase();
      const mimeType = extension === '.jpg' || extension === '.jpeg' ? 'jpeg' : extension.replace('.', '');
      return `data:image/${mimeType};base64,${base64Image}`;
    }
    return '';
  } catch (error) {
    console.error('Error loading image:', error);
    return '';
  }
}

// Function to calculate section marks based on "to attempt" values
function calculateSectionMarks(
  questions: any[],
  sectionType: 'mcq' | 'subjective' | 'short' | 'long' | string,
  mcqToAttempt: number,
  shortToAttempt: number,
  longToAttempt: number,
  mcqMarks: number,
  shortMarks: number,
  longMarks: number,
  customMarksMap: Map<string, number>,
  additionalToAttemptMap?: Map<string, number> // NEW: Map for additional question types
): number {
  let totalMarks = 0;
  
  if (sectionType === 'mcq') {
    // Calculate marks for MCQ section
    const mcqQuestions = questions.filter((pq: any) => pq.question_type === 'mcq');
    const attemptedMcqQuestions = mcqQuestions.slice(0, mcqToAttempt);
    
    totalMarks = attemptedMcqQuestions.reduce((sum, pq) => {
      const customMark = customMarksMap.get(pq.question_id) || mcqMarks;
      return sum + customMark;
    }, 0);
    
    ////console.log(`📊 MCQ Section marks: ${totalMarks} (${attemptedMcqQuestions.length} questions attempted)`);
    
  } else if (sectionType === 'subjective') {
    // Calculate marks for subjective section (all non-mcq types)
    const subjectiveQuestions = questions.filter((pq: any) => pq.question_type !== 'mcq');
    
    // For known types, use attempt counts; for others, assume all attempted
    const attemptedQuestions: any[] = [];
    
    const shortQuestions = subjectiveQuestions.filter((pq: any) => pq.question_type === 'short');
    const longQuestions = subjectiveQuestions.filter((pq: any) => pq.question_type === 'long');
    const otherQuestions = subjectiveQuestions.filter((pq: any) => !['short', 'long'].includes(pq.question_type));
    
    attemptedQuestions.push(...shortQuestions.slice(0, shortToAttempt));
    attemptedQuestions.push(...longQuestions.slice(0, longToAttempt));
    
    // Handle additional question types with their specific toAttempt values
    if (additionalToAttemptMap) {
      for (const [type, toAttempt] of additionalToAttemptMap) {
        if (type === 'mcq' || type === 'short' || type === 'long') continue;
        
        const typeQuestions = subjectiveQuestions.filter((pq: any) => pq.question_type === type);
        attemptedQuestions.push(...typeQuestions.slice(0, toAttempt));
      }
    } else {
      // If no additional map, assume all other types are attempted
      attemptedQuestions.push(...otherQuestions);
    }
    
    totalMarks = attemptedQuestions.reduce((sum, pq) => {
      let defaultMarks = shortMarks; // default
      if (pq.question_type === 'long') defaultMarks = longMarks;
      // For Urdu/English specific types, use appropriate marks
      if (pq.question_type === 'translate_urdu') defaultMarks = 4;
      if (pq.question_type === 'translate_english') defaultMarks = 5;
      if (pq.question_type === 'idiom_phrases') defaultMarks = 1;
      if (pq.question_type === 'poetry_explanation') defaultMarks = 2;
      if (pq.question_type === 'prose_explanation') defaultMarks = 5;
      if (pq.question_type === 'passage') defaultMarks = 10;
      if (pq.question_type === 'sentence_correction') defaultMarks = 1;
      if (pq.question_type === 'sentence_completion') defaultMarks = 1;
      if (pq.question_type === 'activePassive') defaultMarks = 1;
      if (pq.question_type === 'directInDirect') defaultMarks = 1;
      
      const customMark = customMarksMap.get(pq.question_id) || defaultMarks;
      return sum + customMark;
    }, 0);
    
    ////console.log(`📊 Subjective Section marks: ${totalMarks} (${attemptedQuestions.length} questions attempted)`);
    
  } else if (sectionType === 'short') {
    // Calculate marks for short questions only
    const shortQuestions = questions.filter((pq: any) => pq.question_type === 'short');
    const attemptedShortQuestions = shortQuestions.slice(0, shortToAttempt);
    
    totalMarks = attemptedShortQuestions.reduce((sum, pq) => {
      const customMark = customMarksMap.get(pq.question_id) || shortMarks;
      return sum + customMark;
    }, 0);
    
  } else if (sectionType === 'long') {
    // Calculate marks for long questions only
    const longQuestions = questions.filter((pq: any) => pq.question_type === 'long');
    const attemptedLongQuestions = longQuestions.slice(0, longToAttempt);
    
    totalMarks = attemptedLongQuestions.reduce((sum, pq) => {
      const customMark = customMarksMap.get(pq.question_id) || longMarks;
      return sum + customMark;
    }, 0);
  } else {
    // Handle specific question types
    const typeQuestions = questions.filter((pq: any) => pq.question_type === sectionType);
    const toAttempt = additionalToAttemptMap?.get(sectionType) || typeQuestions.length;
    const attemptedQuestions = typeQuestions.slice(0, toAttempt);
    
    totalMarks = attemptedQuestions.reduce((sum, pq) => {
      // Determine default marks based on type
      let defaultMarks = shortMarks;
      if (sectionType === 'translate_urdu') defaultMarks = 4;
      if (sectionType === 'translate_english') defaultMarks = 5;
      if (sectionType === 'idiom_phrases') defaultMarks = 1;
      if (sectionType === 'poetry_explanation') defaultMarks = 2;
      if (sectionType === 'prose_explanation') defaultMarks = 5;
      if (sectionType === 'passage') defaultMarks = 10;
      if (sectionType === 'sentence_correction') defaultMarks = 1;
      if (sectionType === 'sentence_completion') defaultMarks = 1;
      if (sectionType === 'activePassive') defaultMarks = 1;
      if (sectionType === 'directInDirect') defaultMarks = 1;
      
      const customMark = customMarksMap.get(pq.question_id) || defaultMarks;
      return sum + customMark;
    }, 0);
    
    ////console.log(`📊 ${sectionType} Section marks: ${totalMarks} (${attemptedQuestions.length} questions attempted)`);
  }
  
  return totalMarks;
}
let subjectName='';
let className='';
// Function to create paper record
async function createPaperRecord(requestData: PaperGenerationRequest, userId: string) {
  const {
    title,
    subjectId,
    classId
  } = requestData;

  // Fetch subject and class names
  const { data: subject } = await supabaseAdmin
    .from('subjects')
    .select('name')
    .eq('id', subjectId)
    .single();

  const { data: classData } = await supabaseAdmin
    .from('classes')
    .select('name')
    .eq('id', classId)
    .single();

 subjectName = subject?.name || 'Unknown Subject';
  className = classData?.name || 'Unknown Class';

  // CRITICAL FIX: Calculate total marks based on "to attempt" values from toAttemptValues
  // Create paper record with new schema
  const paperData: any = {
    title: title,
    created_by: userId,
    class_name: className,
    subject_name: subjectName
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

    ////console.log(`✅ Paper created with ID: ${paper.id}`);
    /*///console.log(`📊 Paper details:`, {
      title: paper.title,
      created_by: paper.created_by,
      class_name: paper.class_name+'/'+className,
      subject_name: paper.subject_name+'/'+subjectName
    });
    */
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
      ////console.log('⚠️ No user logo found, using default logo');
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
      ////console.log('🔄 Fetching user logo from URL:', logoUrl);
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
      
      ////console.log('✅ User logo converted to base64 successfully');
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

// FIXED: Time formatting function
/** Format time properly for display */
// FIXED: Time formatting function - shows hours:minutes when time >= 60
function formatTimeForDisplay(minutes: number, lang: string = 'eng'): string {
  if (!minutes || minutes <= 0) {
    if(lang === 'urdu' || lang === 'ur'){
      return '0 منٹ';
    } else {
      return '0 minutes';
    }
  }
  
  // If less than 60 minutes, show just minutes
  if (minutes < 60) {
    if(lang === 'urdu' || lang === 'ur'){
      return `${minutes} منٹ`;
    } else {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
  }
  
  // If 60 minutes or more, show hours:minutes format
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  // If no remaining minutes, show just hours
  if (remainingMinutes === 0) {
    if(lang === 'urdu' || lang === 'ur'){
      return `${hours} گھنٹے`;
    } else {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
  }
  
  // Format minutes with leading zero if needed
  const formattedMinutes = remainingMinutes.toString().padStart(2, '0');
  if(lang === 'urdu' || lang === 'ur'){
    return `${hours}:${formattedMinutes} گھنٹے`;
  } else {
    return `${hours}:${formattedMinutes} hour${hours !== 1 ? 's' : ''}`;
  }
}

// Helper: Convert number to roman style (i, ii, iii …)
function toRoman(num: number): string {
  const romans = ['i','ii','iii','iv','v','vi','vii','viii','ix','x','xi','xii','xiii','xiv','xv','xvi','xvii','xviii'];
  return romans[num - 1] || num.toString();
}

// FIXED: Function to generate paper HTML with proper time handling
async function generatePaperHTML(paper: any, userId: string, requestData: PaperGenerationRequest, logoBase64: string) {
  const {
    language = 'bilingual',
    mcqMarks = 1,
    shortMarks = 2,
    longMarks = 5,
    mcqPlacement = 'separate',
    dateOfPaper,
    reorderedQuestions,
    customMarksData,
    // Time values from frontend
    timeMinutes = 60,
    mcqTimeMinutes = 15,
    subjectiveTimeMinutes = 45,
    paperType = 'custom',
    toAttemptValues = {}, // Get toAttemptValues from request
    
    // Additional Urdu/English marks
    poetry_explanationMarks = 2,
    prose_explanationMarks = 5,
    passageMarks = 10,
    sentence_correctionMarks = 1,
    sentence_completionMarks = 1,
    translate_urduMarks = 4,
    translate_englishMarks = 5,
    idiom_phrasesMarks = 1,
    activePassiveMarks = 1,
    directInDirectMarks = 1,
   removeWatermark
  } = requestData;

  ////console.log('📋 Received toAttemptValues:', toAttemptValues);

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
  ////console.log('📋 Fetching paper questions with details...');
  
  let finalQuestions: any[] = [];

  // Check if we have reordered questions from frontend
  if (reorderedQuestions) {
    ////console.log('🔄 Using reordered questions from frontend preview');
    
    // Combine all questions in the correct order
    let orderNumber = 1;
    
    // Process all question types dynamically
    Object.keys(reorderedQuestions).forEach(type => {
      const questions = reorderedQuestions[type] || [];
      
      // FIX: Skip empty question types
      if (questions.length === 0) {
        ////console.log(`⏭️ Skipping ${type} questions (0 questions provided)`);
        return;
      }
      
      ////console.log(`🔍 Processing ${questions.length} reordered ${type} questions`);
      
      questions.forEach((question: any) => {
        // Determine default marks based on type
        let defaultMarks = mcqMarks;
        if (type === 'short') defaultMarks = shortMarks;
        if (type === 'long') defaultMarks = longMarks;
        if (type === 'poetry_explanation') defaultMarks = poetry_explanationMarks;
        if (type === 'prose_explanation') defaultMarks = prose_explanationMarks;
        if (type === 'passage') defaultMarks = passageMarks;
        if (type === 'sentence_correction') defaultMarks = sentence_correctionMarks;
        if (type === 'sentence_completion') defaultMarks = sentence_completionMarks;
        if (type === 'translate_urdu') defaultMarks = translate_urduMarks;
        if (type === 'translate_english') defaultMarks = translate_englishMarks;
        if (type === 'idiom_phrases') defaultMarks = idiom_phrasesMarks;
        if (type === 'activePassive') defaultMarks = activePassiveMarks;
        if (type === 'directInDirect') defaultMarks = directInDirectMarks;
        // For other types, use shortMarks as default
        if (!['mcq', 'short', 'long', 'poetry_explanation', 'prose_explanation', 'passage', 
              'sentence_correction', 'sentence_completion', 'translate_urdu', 'translate_english',
              'idiom_phrases', 'activePassive', 'directInDirect'].includes(type)) defaultMarks = shortMarks;
        
        const customMark = customMarksMap.get(question.id) || question.marks || defaultMarks;
        finalQuestions.push({
          order_number: orderNumber++,
          question_type: type,
          question_id: question.id,
          questions: {
            ...question,
            marks: customMark
          },
          custom_marks: customMark
        });
      });
    });
    
    ////console.log(`✅ Using ${finalQuestions.length} reordered questions from frontend with custom marks`);
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
    ////console.log(`✅ Using ${finalQuestions.length} questions from database order`);
  }

  // FIX: Check if we have any questions at all
  if (!finalQuestions || finalQuestions.length === 0) {
    throw new Error('No questions found for the generated paper');
  }

  ////console.log(`📊 Final question order for PDF generation:`);
  finalQuestions.forEach((pq: any, index: number) => {
    ////console.log(`${index + 1}. Type: ${pq.question_type}, Order: ${pq.order_number}, ID: ${pq.question_id}, Marks: ${pq.custom_marks}`);
  });

  // CRITICAL FIX: Calculate section marks using toAttemptValues
  const mcqToAttempt = toAttemptValues.mcq || paper.mcq_to_attempt || requestData.mcqToAttempt || requestData.mcqCount || 0;
  const shortToAttempt = toAttemptValues.short || paper.short_to_attempt || requestData.shortToAttempt || requestData.shortCount || 0;
  const longToAttempt = toAttemptValues.long || paper.long_to_attempt || requestData.longToAttempt || requestData.longCount || 0;
  
  // Create additional toAttempt map for Urdu/English question types
  const additionalToAttemptMap = new Map<string, number>();
  
  // Urdu types
  additionalToAttemptMap.set('poetry_explanation', 
    toAttemptValues.poetry_explanation || paper.poetry_explanation_to_attempt || requestData.poetry_explanationToAttempt || requestData.poetry_explanationCount || 0
  );
  additionalToAttemptMap.set('prose_explanation', 
    toAttemptValues.prose_explanation || paper.prose_explanation_to_attempt || requestData.prose_explanationToAttempt || requestData.prose_explanationCount || 0
  );
  additionalToAttemptMap.set('passage', 
    toAttemptValues.passage || paper.passage_to_attempt || requestData.passageToAttempt || requestData.passageCount || 0
  );
  additionalToAttemptMap.set('sentence_correction', 
    toAttemptValues.sentence_correction || paper.sentence_correction_to_attempt || requestData.sentence_correctionToAttempt || requestData.sentence_correctionCount || 0
  );
  additionalToAttemptMap.set('sentence_completion', 
    toAttemptValues.sentence_completion || paper.sentence_completion_to_attempt || requestData.sentence_completionToAttempt || requestData.sentence_completionCount || 0
  );
  
  // English types
  additionalToAttemptMap.set('translate_urdu', 
    toAttemptValues.translate_urdu || paper.translate_urdu_to_attempt || requestData.translate_urduToAttempt || requestData.translate_urduCount || 0
  );
  additionalToAttemptMap.set('translate_english', 
    toAttemptValues.translate_english || paper.translate_english_to_attempt || requestData.translate_englishToAttempt || requestData.translate_englishCount || 0
  );
  additionalToAttemptMap.set('idiom_phrases', 
    toAttemptValues.idiom_phrases || paper.idiom_phrases_to_attempt || requestData.idiom_phrasesToAttempt || requestData.idiom_phrasesCount || 0
  );
  additionalToAttemptMap.set('activePassive', 
    toAttemptValues.activePassive || paper.activePassive_to_attempt || requestData.activePassiveToAttempt || requestData.activePassiveCount || 0
  );
  additionalToAttemptMap.set('directInDirect', 
    toAttemptValues.directInDirect || paper.directInDirect_to_attempt || requestData.directInDirectToAttempt || requestData.directInDirectCount || 0
  );
  
  ////console.log('📊 Additional To Attempt Map:', Object.fromEntries(additionalToAttemptMap.entries()));

  // Helper function to get toAttempt value for any question type
  const getToAttemptForType = (type: string): number => {
    // First check toAttemptValues
    if (toAttemptValues[type] !== undefined) {
      return toAttemptValues[type];
    }
    
    // Then check paper record
    if (type === 'mcq') return paper.mcq_to_attempt || 0;
    if (type === 'short') return paper.short_to_attempt || 0;
    if (type === 'long') return paper.long_to_attempt || 0;
    if (type === 'poetry_explanation') return paper.poetry_explanation_to_attempt || 0;
    if (type === 'prose_explanation') return paper.prose_explanation_to_attempt || 0;
    if (type === 'passage') return paper.passage_to_attempt || 0;
    if (type === 'sentence_correction') return paper.sentence_correction_to_attempt || 0;
    if (type === 'sentence_completion') return paper.sentence_completion_to_attempt || 0;
    if (type === 'translate_urdu') return paper.translate_urdu_to_attempt || 0;
    if (type === 'translate_english') return paper.translate_english_to_attempt || 0;
    if (type === 'idiom_phrases') return paper.idiom_phrases_to_attempt || 0;
    if (type === 'activePassive') return paper.activePassive_to_attempt || 0;
    if (type === 'directInDirect') return paper.directInDirect_to_attempt || 0;
    
    // For other types, check if we have counts in the request
    const countField = `${type}Count` as keyof PaperGenerationRequest;
    if (requestData[countField] !== undefined) {
      return requestData[countField] as number;
    }
    
    // Default to 0
    return 0;
  };

  // Calculate section marks using helper function
  const mcqSectionMarks = calculateSectionMarks(
    finalQuestions,
    'mcq',
    mcqToAttempt,
    shortToAttempt,
    longToAttempt,
    mcqMarks,
    shortMarks,
    longMarks,
    customMarksMap,
    additionalToAttemptMap
  );
  
  const subjectiveSectionMarks = calculateSectionMarks(
    finalQuestions,
    'subjective',
    mcqToAttempt,
    shortToAttempt,
    longToAttempt,
    mcqMarks,
    shortMarks,
    longMarks,
    customMarksMap,
    additionalToAttemptMap
  );
  
  /*///console.log('📊 Section marks calculated:', {
    mcqSectionMarks,
    subjectiveSectionMarks,
    totalMarks: paper.total_marks,
    mcqPlacement
  });
*/
  // FIXED: Determine time values based on MCQ placement
  const getTimeValues = () => {
    const placement = mcqPlacement || 'separate';
    
    if (placement === 'separate') {
      // For separate layout, use specific times for each section
      return {
        mcqTime: mcqTimeMinutes || 15,
        subjectiveTime: subjectiveTimeMinutes || 45
      };
    } else {
      // For same_page or two_papers, use total time for both
      return {
        mcqTime: timeMinutes || 60,
        subjectiveTime: timeMinutes || 60
      };
    }
  };

  const timeValues = getTimeValues();
  /*//console.log('⏱️ Time values for PDF:', {
    mcqPlacement: mcqPlacement,
    mcqTime: timeValues.mcqTime,
    mcqTimeDisplayEng: formatTimeForDisplay(timeValues.mcqTime,'eng'),
    subjectiveTime: timeValues.subjectiveTime,
    subjectiveTimeDisplayUrdu: formatTimeForDisplay(timeValues.subjectiveTime,'urdu'),
    timeMinutes: timeMinutes,
    mcqTimeMinutes: mcqTimeMinutes,
    subjectiveTimeMinutes: subjectiveTimeMinutes
  });
*/
  // Generate HTML content for PDF
  const isUrdu = language === 'urdu';
  const isBilingual = language === 'bilingual';
  const isEnglish   = language === 'english';
  const separateMCQ = mcqPlacement === 'separate';
  const paperLayout = mcqPlacement;  // 'single_page' or 'separate' or 'two_papers
  const englishTitle = `${paper.title}`;
  const urduTitle = paper.title;
  
  // Check if it's a board paper (model paper)
  const isBoardPaper = paper.paper_type === 'model' || paperType === 'model';
  ////console.log(`📋 Paper type: ${paper.paper_type}, isBoardPaper: ${isBoardPaper}`);

  // Load fonts
  const jameelNooriBase64 = loadFontAsBase64('JameelNooriNastaleeqKasheeda.ttf');
  const notoNastaliqBase64 = loadFontAsBase64('NotoNastaliqUrdu-Regular.ttf');
  const algerianBase64 = loadFontAsBase64('Algerian Regular.ttf');
  const notoSansBase64 = loadFontAsBase64('NotoSans-Regular.ttf');
   const notoSansSymbolsBase64 = loadFontAsBase64('NotoSansSymbols2-Regular.ttf');
const DejaVuSansBase64 = loadFontAsBase64('DejaVuSans.ttf');
   
  let paperClass = '';
  let subject = '';
  let subject_ur = '';
  paperClass = className;
  subject = subjectName;
  const cachedTranslation = translationCache.get(subjectName);
  if (cachedTranslation) {
    subject_ur = cachedTranslation;
    ////console.log('Using cached translation for subject:', subject_ur);
  } else {
    const translatedSubject = await translate(subject, { to: 'ur' });
    subject_ur = translatedSubject.text;
    translationCache.set(subjectName, subject_ur);
  }
  /*/console.log('My new subjects and class Subject and Class for paper generation:', {
    subject,
    subject_ur,
    paperClass
  });
  */
  /*
  try {
    // Fetch subject details
    ////console.log('Fetching subject details for subject_id:', paper.subject_id);
    const { data: subjectData, error: subjectError } = await supabaseAdmin
      .from('subjects')
      .select('name')
      .eq('id', paper.subject_id)
      .single();
////console.log('Fetched subject data:', subjectData, 'Error:', subjectError);
    if (!subjectError && subjectData) {
      subject = subjectData.name;
      const cachedTranslation = translationCache.get(subject);
      ////console.log('subject currently generated paper:',subject);
      if (cachedTranslation) {
        subject_ur = cachedTranslation;
        ////console.log('Using cached translation for subject:', subject_ur);
      } else {
        const translatedSubject = await translate(subject, { to: 'ur' });
        subject_ur = translatedSubject.text;
        translationCache.set(subject, subject_ur);
      }
    } else {
      console.warn('Using fallback subject data due to error:', subjectError);
      //subject = 'Subject';
      //subject_ur = 'مضمون';
      subject = subjectName;
     const cachedTranslation = translationCache.get(subjectName);
      //////console.log('subject currently generated paper:',subject);
      if (cachedTranslation) {
        subject_ur = cachedTranslation;
        ////console.log('subject not found from papers table:', subject_ur);
      } else {
        const translatedSubject = await translate(subject, { to: 'ur' });
        subject_ur = translatedSubject.text;
        translationCache.set(subject, subject_ur);
      }
    
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
*/
  // Get questions by type from the final ordered list
  const mcqQuestions = finalQuestions.filter((pq: any) => 
    pq.question_type === 'mcq' && pq.questions
  );

  const subjectiveQuestions = finalQuestions.filter((pq: any) => 
    pq.question_type !== 'mcq' && pq.questions
  );

  // Log the counts for debugging
  ////console.log(`📊 Question counts for PDF generation:`);
  ////console.log(`   - MCQ Questions: ${mcqQuestions.length}`);
  ////console.log(`   - Subjective Questions: ${subjectiveQuestions.length}`);
  ////console.log(`   - Total Questions: ${finalQuestions.length}`);

  // Check if there are MCQs
  const hasMCQs = mcqQuestions.length > 0;
  
  // Group subjective questions by type
  const subjectiveQuestionsByType: Record<string, any[]> = {};
  subjectiveQuestions.forEach((pq: any) => {
    const type = pq.question_type;
    if (!subjectiveQuestionsByType[type]) {
      subjectiveQuestionsByType[type] = [];
    }
    subjectiveQuestionsByType[type].push(pq);
  });

  // For backward compatibility
  const shortQuestions = subjectiveQuestionsByType['short'] || [];
  const longQuestions = subjectiveQuestionsByType['long'] || [];
  const poetryExplanationQuestions = subjectiveQuestionsByType['poetry_explanation'] || [];
  const proseExplanationQuestions = subjectiveQuestionsByType['prose_explanation'] || [];
  const passageQuestions = subjectiveQuestionsByType['passage'] || [];
  const sentenceCorrectionQuestions = subjectiveQuestionsByType['sentence_correction'] || [];

  const sentenceCompletionQuestions = subjectiveQuestionsByType['sentence_completion'] || [];
  const translateUrduQuestions = subjectiveQuestionsByType['translate_urdu'] || [];
  const translateEnglishQuestions = subjectiveQuestionsByType['translate_english'] || [];
  const idiomPhrasesQuestions = subjectiveQuestionsByType['idiom_phrases'] || [];
  const activePassiveQuestions = subjectiveQuestionsByType['activePassive'] || [];
  const directInDirectQuestions = subjectiveQuestionsByType['directInDirect'] || [];

  // Log subjective question types
  ////console.log(`📊 Subjective question types:`, Object.keys(subjectiveQuestionsByType));
  Object.entries(subjectiveQuestionsByType).forEach(([type, questions]) => {
    ////console.log(`   - ${type}: ${questions.length} questions`);
  });

  // FIXED: Get formatted time display
  const mcqTimeDisplayEng = formatTimeForDisplay(timeValues.mcqTime,'eng');
  const subjectiveTimeDisplayEng = formatTimeForDisplay(timeValues.subjectiveTime, 'eng');
  const mcqTimeDisplayUrdu = formatTimeForDisplay(timeValues.mcqTime, 'urdu');
  const subjectiveTimeDisplayUrdu = formatTimeForDisplay(timeValues.subjectiveTime, 'urdu');
 const isPaidUser = await checkUserSubscription(userId);
  // Build HTML content
  let htmlContent = `
<!DOCTYPE html>
<html lang="${isUrdu ? 'ur' : 'en'}">
<head>
  <meta charset="UTF-8">
  <title>${isUrdu ? subject_ur : subject} </title>
   <style>
 
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
       @font-face {
  font-family: 'Noto Sans';
  src: url('data:font/ttf;base64,${notoSansBase64}') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Noto Sans Symbols';
  src: url('data:font/ttf;base64,${notoSansSymbolsBase64}') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'DejaVu Sans';
  src: url('data:font/ttf;base64,${DejaVuSansBase64}') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}



    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Times New Roman, sans-serif; padding: 0px; }
    .container { max-width: 900px; margin: 0 auto; background: white; padding: 0;  }
    .header {text-align:center; font-size: 13px;  }
    .header h1 { font-size: 14px; }
    .header h2 { font-size: 12px; }
    .institute{font-family:algerian; }
    .urdu { font-family: "Jameel Noori Nastaleeq", "Noto Nastaliq Urdu", serif; direction: rtl; }
    .eng {
  font-family: ${
    subject.trim().toLowerCase() === 'chemistry' ||
    subject.trim().toLowerCase() === 'math' ||
    subject.trim().toLowerCase() === 'mathethemetics'
      ? "'DejaVu Sans', serif"
      : "'Times New Roman','Noto Sans Symbols'"
  }, serif;

  direction: ltr;
  white-space: pre-line;
}

 .options .eng {
  font-family: ${
    subject.trim().toLowerCase() === 'chemistry' ||
    subject.trim().toLowerCase() === 'physics' ||
    subject.trim().toLowerCase() === 'math' ||
    subject.trim().toLowerCase() === 'mathethemetics'
      ? "'DejaVu Sans', serif"
      : "'Times New Roman','Noto Sans Symbols', serif"
  };
}
       .options .urdu {
    font-family: "Jameel Noori Nastaleeq", "Noto Nastaliq Urdu";
    direction: rtl;
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
    table { width: 100%; border-collapse: collapse; margin: 4px 0; font-size: 10px; ${isEnglish && mcqPlacement!=='three_papers'? ' direction:ltr' : ' direction:rtl'}}
    table, th, td { border: 1px solid #000; }
    td { padding: ${mcqPlacement === 'two_papers' || mcqPlacement === 'three_papers' ? '2px' : '4px'}; vertical-align: top; }
    hr{color:black}
    .qnum { width: 20px; text-align: center; font-weight: bold; }
    .question { display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 0 0;
     font-size: ${mcqPlacement === 'two_papers' || mcqPlacement === 'three_papers' ? '10px' :'11px'}; 
    }
    ol li{ font-size:9px; }
    .student-info{ margin-top: 10px; margin-bottom:10px; display: flex; justify-content: space-between;  flex-direction: ${isEnglish ? 'row-reverse' : 'row'}; }
  
    .options { margin-top: ${mcqPlacement === 'two_papers' || mcqPlacement === 'three_papers' ? '0px' : mcqQuestions.length>10?'1px':'2px'};  display: flex; justify-content: space-between; font-size:  ${mcqPlacement === 'two_papers' || mcqPlacement === 'three_papers' ? '10px' :mcqQuestions.length>10? '10px':'12px'}; }
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
<body>`;

  // FIXED: Only generate MCQ section if there are MCQs
  if (hasMCQs) {
    htmlContent += `
<div class="container" ${mcqPlacement === 'two_papers' ?  'style="height:525px; overflow:hidden"' : mcqPlacement==='three_papers' ? 'style="height:343px; overflow:hidden"' : ''}>
<div class="header">
      ${mcqPlacement==='three_papers' ? `
      <h1 class="eng text-center">
      ${logoBase64 ? `<img src="${logoBase64}" class="header-img"  height="30" width="70"/>` : ''}<br/>
   <span class="institute" style="font-size:12px; margin-top:-15px !important">   ${englishTitle} </span>
    </h1>` :`
      <h1 class="eng text-center">
      ${logoBase64 ? `<img src="${logoBase64}" class="header-img"  height="50" width="140"/>` : ''} <br/>
   <span class="institute">   ${englishTitle} </span>
    </h1>
`}
     </div>
  
  <!-- Student Info Table -->
 <table style="width:100%; border-collapse:collapse; border:none !important; font-family:'Noto Nastaliq Urdu','Jameel Noori Nastaleeq','Noto Sans',Arial,sans-serif;">
  <!-- Row 1 -->
  <tr style="border:none !important; display:flex; justify-content:space-between; align-items:center;">
  <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1.5;">
    ${isUrdu || isBilingual || mcqPlacement==="three_papers"? `<span class="metaUrdu">نام طالبعلم:۔۔۔۔۔۔۔۔۔۔</span>` : ''}
    ${mcqPlacement === "three_papers"?`<span class="metaUrdu">رول نمبر:۔۔۔۔۔۔</span>`: isEnglish || isBilingual ? `<span class="metaEng">Student Name:_________</span>` : ''}
  </td>
  <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1;">
  ${mcqPlacement === "three_papers"?`<span class="metaUrdu">مضمون: ${subject_ur}(${paperClass} کلاس)</span> <span class="metaUrdu">کل نمبر: ${subjectiveSectionMarks}</span>` :`
  ${isUrdu || isBilingual ? `<span class="metaUrdu">رول نمبر:۔۔۔۔۔۔</span>` : ''}
    ${isEnglish || isBilingual ? `<span class="metaEng">Roll No:_________</span>` : ''}
  `
  }
  </td>
  <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1;">
   ${mcqPlacement === "three_papers"?`<span class="metaUrdu">وقت: ${subjectiveTimeDisplayUrdu}</span><span class="metaUrdu">تاریخ:${formatPaperDate(dateOfPaper)}</span>` :`
   
  ${isUrdu || isBilingual ? `<span class="metaUrdu">سیکشن:۔۔۔۔۔۔</span>` : ''}
    ${isEnglish || isBilingual ? `<span class="metaEng">Section:_______</span>` : ''}
 `}
    </td>
</tr>`;
let htmlNoThreePapers = `  <!-- Row 2 -->
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
`;
// For separate layout, show different times for objective and subjective
    // Objective section time
      htmlNoThreePapers += `<!-- Row 3 --> <tr style="border:none !important; display:flex; justify-content:space-between; align-items:center;">
      <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1.5;">
    ${isUrdu || isBilingual ? `<span class="metaUrdu">وقت: ${mcqPlacement==='separate'?formatTimeForDisplay(timeValues.mcqTime,'ur'):formatTimeForDisplay(timeValues.subjectiveTime,'urdu')}</span>` : ''}
    ${isEnglish || isBilingual ? `<span class="metaEng">Time Allowed: ${mcqPlacement==='separate'?formatTimeForDisplay(timeValues.mcqTime,'eng'):formatTimeForDisplay(timeValues.subjectiveTime,'eng')}</span>` : ''}
  </td>
  <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1;">
      ${mcqPlacement === 'separate' || mcqPlacement === 'two_papers' ? 
        (isUrdu || isBilingual ? `<span class="metaUrdu">کل نمبر: ${mcqSectionMarks}</span>` : '') : 
        (isUrdu || isBilingual ? `<span class="metaUrdu">کل نمبر: ${paper.total_marks}</span>` : '')
      }
      ${mcqPlacement === 'separate' || mcqPlacement === 'two_papers' ? 
        (isEnglish || isBilingual ? `<span class="metaEng">Maximum Marks: ${mcqSectionMarks}</span>` : '') : 
        (isEnglish || isBilingual ? `<span class="metaEng">Maximum Marks: ${paper.total_marks}</span>` : '')
      }
    </td>
   <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1;">
   ${mcqPlacement==="separate" || mcqPlacement==="two_papers" ? (isUrdu || isBilingual ? `<span class="metaUrdu">حصہ معروضی</span>` : '') :  isUrdu || isBilingual ? `<span class="metaUrdu">حصہ معروضی/انشائیہ</span>` : ''} 
   ${mcqPlacement==="separate" || mcqPlacement==="two_papers" ? (isEnglish || isBilingual ? `<span class="metaEng">Objective Part</span>` : '') : isEnglish || isBilingual ? `<span class="metaEng">Objective/Subjective Part</span>` : ''} 
   </td>
  </tr>
    `;
if(mcqPlacement!=="three_papers"){

  htmlContent += htmlNoThreePapers;
}
    htmlContent += `
</table>
<hr  style="color:black;"/> ${mcqPlacement !== 'three_papers' || mcqPlacement !== 'two_papers' ? '' : '<br/>'}`;

    // FIX: Only add MCQ questions if they exist
    if (mcqQuestions && mcqQuestions.length > 0) {
      htmlContent += `<div class="note">`;
      if (isUrdu || isBilingual) {
        htmlContent += `<p class="urdu">نوٹ: ہر سوال کے چار ممکنہ جوابات A,B,C اور D دیئے گئے ہیں۔ درست جواب کے مطابق دائرہ لگائیں۔ ایک سے زیادہ دائروں کو پُر کرنے کی صورت میں جواب غلط تصور ہوگا۔</p>`;
      }
      if ((isEnglish || isBilingual)&& mcqPlacement !== 'three_papers') {
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
${mcqPlacement==="separate" || mcqPlacement==="two_papers" || mcqPlacement==="three_papers" ? `
    <div class="footer no-break" style="margin-top: ${mcqPlacement==='three_papers'?'0px;':'0px;'} text-align: center; font-size: 12px; color: #666;  padding-top: ${mcqPlacement==='three_papers'?'0px;':'5px;'}">
    <p class="english">www.examly.pk | Generate papers Save Time | Generated on ${new Date().toLocaleDateString()} by www.examly.pk </p>
  </div>
  </div>` : ``}
  
</div>`;
    } else {
      ////console.log('⏭️ No MCQ questions to include in PDF');
    }
  } else {
    // When there are no MCQs, don't generate the MCQ container at all
    ////console.log('⏭️ No MCQs in this paper, skipping MCQ section entirely');
  }


  // Handle page break or separation for two_papers layout
 function getWatermarkHTML(positionStyle, width, isPaidUser, removeWatermark, logoBase64) {
  const trialHTML = `
    <img src="${loadImageAsBase64('examly.png')}" alt="Examly Logo" style="width: ${width}px; height: auto;" />
    <br/>
    <div style="font-size: 16px; color: #000; text-align: center; margin-top: -25px; margin-left: 60px;">
      Trial version, get Package to set Your Water Mark.
    </div>
  `;

  const paidHTML = `<img src="${logoBase64}" alt="Examly Logo" style="width: ${width}px; height: auto;" />`;

  return `
    <div class="${positionStyle.className}" style="position: fixed; ${positionStyle.css}; z-index: 0; opacity: 0.1; pointer-events: none; transform: rotate(-45deg);">
      ${removeWatermark ? '' : (isPaidUser ? paidHTML : trialHTML)}
    </div>
  `;
}

function getCutLine() {
  return `
    <div style="display:flex; align-items:center; margin: 5px 0;">
      <span style="font-size:12px; margin-right:6px;">✂</span>
      <hr style="flex:1; border-top: 2px dotted black;" />
    </div>
  `;
}
let addThreeMCQ='';
if (mcqPlacement === "two_papers") {
  const firstPaperCopy = htmlContent;
  htmlContent += getWatermarkHTML({ className: 'watermark-1', css: 'top: 20%; left: 35%;' }, 250, isPaidUser, removeWatermark, logoBase64);
  if(hasMCQs) htmlContent += getCutLine()+firstPaperCopy;
  htmlContent += getWatermarkHTML({ className: 'watermark-2', css: 'bottom: 20%; left: 35%;' }, 250, isPaidUser, removeWatermark, logoBase64);
} else if (mcqPlacement === "three_papers") {
  const firstPaperCopy = htmlContent;
  addThreeMCQ += htmlContent+getWatermarkHTML({ className: 'watermark-1', css: 'top: 13%; left: 30%;' }, 300, isPaidUser, removeWatermark, logoBase64);
  if(hasMCQs) addThreeMCQ += getCutLine()+firstPaperCopy;
  addThreeMCQ += getWatermarkHTML({ className: 'watermark-2', css: 'top: 47%; left: 30%;' }, 300, isPaidUser, removeWatermark, logoBase64);
  if(hasMCQs) addThreeMCQ += getCutLine()+firstPaperCopy;
  addThreeMCQ += getWatermarkHTML({ className: 'watermark-3', css: 'bottom: 10%; left: 35%;' }, 300, isPaidUser, removeWatermark, logoBase64);
  htmlContent = addThreeMCQ;
}

  // FIXED: Always generate subjective section if there are subjective questions or no MCQs at all
  //if (subjectiveQuestions.length > 0 || !hasMCQs) {
  if (subjectiveQuestions.length > 0 || (mcqPlacement === "separate" && hasMCQs) || !hasMCQs) {  
  // Page break logic - only add page break if there are MCQs and placement is separate or two_papers
    if (hasMCQs && (mcqPlacement === "separate" || mcqPlacement === "two_papers" || mcqPlacement === "three_papers")) {
      htmlContent += `
    <!-- Page break before subjective section -->
    <div style="page-break-before: always;"></div>`;
    }
    
    let subjectiveContent = ``;
    
    // FIXED: Determine if we need to show student info table in subjective section
    // Show student info table in subjective section when:
    // 1. Placement is separate or two_papers
    // 2. OR there are no MCQs (paper has only subjective questions)
    const showSubjectiveStudentInfo = mcqPlacement === "separate" || mcqPlacement === "two_papers" || mcqPlacement === "three_papers" || !hasMCQs;
    
    subjectiveContent += ` <div class="container" ${mcqPlacement === 'two_papers' ?  'style="height:525px; overflow:hidden"' : mcqPlacement==='three_papers' ? 'style="height:343px; overflow:hidden"' : ''}>
  ${showSubjectiveStudentInfo ? `
     <div class="header">
     ${mcqPlacement==='three_papers' ? `
      <h1 class="eng text-center">
      ${logoBase64 ? `<img src="${logoBase64}" class="header-img"  height="30" width="70"/>` : ''}<br/>
   <span class="institute" style="font-size:12px; margin-top:-15px !important">   ${englishTitle} </span>
    </h1>

      ` :`
      <h1 class="eng text-center">
      ${logoBase64 ? `<img src="${logoBase64}" class="header-img"  height="50" width="140"/>` : ''} <br/>
   <span class="institute">   ${englishTitle} </span>
    </h1>
`}
      </div>
    <!-- Student Info Table -->
<table style="width:100%; border-collapse:collapse; border:none !important; font-family:'Noto Nastaliq Urdu','Jameel Noori Nastaleeq','Noto Sans',Arial,sans-serif;">
<!-- Row 1 -->
<tr style="border:none !important; display:flex; justify-content:space-between; align-items:center;">
  <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1.5;">
    ${isUrdu || isBilingual ||mcqPlacement==="three_papers"? `<span class="metaUrdu">نام طالبعلم:۔۔۔۔۔۔۔۔۔۔</span>` : ''}
    ${mcqPlacement === "three_papers"?`<span class="metaUrdu">رول نمبر:۔۔۔۔۔۔</span>`: isEnglish || isBilingual ? `<span class="metaEng">Student Name:_________</span>` : ''}
  </td>
  <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1;">
  ${mcqPlacement === "three_papers"?`<span class="metaUrdu">مضمون: ${subject_ur}(${paperClass} کلاس)</span> <span class="metaUrdu">کل نمبر: ${subjectiveSectionMarks}</span>` :`
  ${isUrdu || isBilingual ? `<span class="metaUrdu">رول نمبر:۔۔۔۔۔۔</span>` : ''}
    ${isEnglish || isBilingual ? `<span class="metaEng">Roll No:_________</span>` : ''}
  `
  }
  </td>
  <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1;">
   ${mcqPlacement === "three_papers"?`<span class="metaUrdu">وقت: ${subjectiveTimeDisplayUrdu}</span><span class="metaUrdu">تاریخ:${formatPaperDate(dateOfPaper)}</span>` :`
   
  ${isUrdu || isBilingual ? `<span class="metaUrdu">سیکشن:۔۔۔۔۔۔</span>` : ''}
    ${isEnglish || isBilingual ? `<span class="metaEng">Section:_______</span>` : ''}
 `}
    </td>
</tr>

<!-- Row 2 -->
${mcqPlacement === "three_papers"?``:`
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
    ${isUrdu || isBilingual ? `<span class="metaUrdu">وقت: ${subjectiveTimeDisplayUrdu}</span>` : ''}
    ${isEnglish || isBilingual ? `<span class="metaEng">Time Allowed: ${subjectiveTimeDisplayEng}</span>` : ''}
  </td>
  <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1;">
      ${mcqPlacement === 'separate' || mcqPlacement === 'two_papers' || !hasMCQs ? 
        (isUrdu || isBilingual ? `<span class="metaUrdu">کل نمبر: ${subjectiveSectionMarks}</span>` : '') : 
        (isUrdu || isBilingual ? `<span class="metaUrdu">کل نمبر: ${paper.total_marks}</span>` : '')
      }
      ${mcqPlacement === 'separate' || mcqPlacement === 'two_papers' || !hasMCQs ? 
        (isEnglish || isBilingual ? `<span class="metaEng">Maximum Marks: ${subjectiveSectionMarks}</span>` : '') : 
        (isEnglish || isBilingual ? `<span class="metaEng">Maximum Marks: ${paper.total_marks}</span>` : '')
      }
    </td>
  <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1;">

         ${isUrdu || isBilingual ? `<span class="metaUrdu">حصہ انشائیہ</span>` : ''}
      ${isEnglish || isBilingual ? `<span class="metaEng">Subjective Part</span>` : ''}
    </td>
</tr>
  
  `}
</table>
<hr  style="color:black;"/>  `:``
  }    
  `;

    // FIX: Only add subjective content if we have subjective questions
    if (subjectiveQuestions && subjectiveQuestions.length > 0) {
      // Get unique subjective types in order they appear
      const subjectiveTypes = [...new Set(subjectiveQuestions.map(pq => pq.question_type))];

      // Add subjective questions sections
      // BOARD PAPER: Group short questions into 6 per group with "attempt 4" instructions
      if (isBoardPaper) {
        ////console.log('📋 Rendering board pattern paper (model paper) with grouped short questions');
        let partNumber = 2; // Next part number after short questions
        let questionNumber:number = 1;
        // Part I - Short Questions (grouped)
        if (shortQuestions.length > 0) {
          // Marks per question (safe fallback)
// ✅ Get marks per short question (global)
const shortMarksPerQuestion = shortQuestions[0]?.custom_marks ?? shortMarks;
// ✅ Attempt count for short questions
const shortToAttemptValue = getToAttemptForType('short');
// ✅ Total marks for short-question instruction
const shortTotalMarks = shortToAttemptValue * shortMarksPerQuestion;


  subjectiveContent += `<div class="header" style="font-size:13px; font-weight:bold; display: flex; align-items: baseline; justify-content: center; gap: 5px;">
    (
    ${(isEnglish || isBilingual) ? `<span class="english" style="vertical-align: baseline;">Part - I</span>` : ''}
    ${(isUrdu || isBilingual) ? `<span class="urdu" style="vertical-align: baseline; position: relative; top: 1px;">حصہ اول</span>` : ''}
    )
  </div>
  `;


  //  ####Start### Poetry Explanation (Urdu)
        if (poetryExplanationQuestions.length > 0) {
          const toAttemptForType = getToAttemptForType('poetry_explanation');
          const showAttemptAny = toAttemptForType > 0 && toAttemptForType < poetryExplanationQuestions.length;
          // ✅ Marks per poetry explanation (safe global)
// Ensure numbers
            const marksPerQuestion = Number(poetryExplanationQuestions[0]?.custom_marks ?? poetry_explanationMarks) || 0;
            const toAttempt = Number(toAttemptForType) || 0;
            const totalQuestions = poetryExplanationQuestions.length;
            const totalMarks = (showAttemptAny ? toAttempt : totalQuestions) * marksPerQuestion;
            questionNumber=questionNumber+1;
            subjectiveContent += `<div class="instructions1" style="font-weight: bold; font-size: 13px; line-height: 1.3; display: flex; justify-content: flex-end; align-items: baseline; margin-bottom: 2px; margin-top: 2px;">`;

            if (isUrdu || isBilingual) {
              if (showAttemptAny) {
                subjectiveContent += `
              <div class="urdu" style="text-align:right; direction:rtl; font-size:13px; font-weight:bold;">
                <span dir="ltr" style="font-weight:bold; margin-left:4px;">
                  .${questionNumber}
                </span>
                کوئی سے ${toAttempt} اشعار کی تشریح کریں۔
              </div>
            `;

              } else {
                subjectiveContent += `<div class="urdu" style="text-align: right; direction: rtl;  font-size:13px; font-weight:bold;"> 
                درج ذیل اشعار کی تشریح کریں۔<strong>${questionNumber}.</strong>
                </div>`;
              }
            }

            subjectiveContent += `</div>`; // close instructions1

                      subjectiveContent += `</div>`;
                  for (let i = 0; i < poetryExplanationQuestions.length; i += 2) {
              subjectiveContent += `<div class="question-row urdu" style="display:flex;  gap:10px; margin-bottom:2px; ">`;

              for (let j = i; j < i + 2 && j < poetryExplanationQuestions.length; j++) {
                const pq = poetryExplanationQuestions[j];
                const q = pq.questions;
                const questionMarks = pq.custom_marks || poetry_explanationMarks;
                const englishQuestion = formatQuestionText(q.question_text || 'No question text available');
                const hasUrduQuestion = hasActualUrduText(q.question_text_ur);
                const urduQuestion = hasUrduQuestion ? formatQuestionText(q.question_text_ur) : '';

                let questionDisplayHtml = `<div class="long-question" style="flex:1; font-size:11px; line-height:1.3;">`;

              if (isUrdu) {
                  questionDisplayHtml += `
                    <div style="display:flex; align-items:flex-start; gap:5px; direction:rtl; text-align:right;">
                      <div style="flex-shrink:0; font-weight:bold;">
                        (${toRoman(j + 1)})
                      </div>
                      <div style="flex:1;" class="urdu">
                        ${urduQuestion} <span class="marks-display">(${questionMarks})</span>
                      </div>
                    </div>
                  `;
                } 

                questionDisplayHtml += `</div>`; // end question container
                subjectiveContent += questionDisplayHtml;
              }

              subjectiveContent += `</div>`; // end row
            }

          
          partNumber++;
        }

        // ##Start## Group short questions (6 per group)
             let questionsPerGroup = 6;
             let groupAttemptAny = 4;
          if(subject=='urdu' || subject_ur==='اردو'|| subject==='English'|| subject==='english' || subject === 'tarjuma ul quran'){
              questionsPerGroup=8;
              groupAttemptAny=5;
          }else if(subject==='Islamiyat'|| subject_ur==='اسلامیات'){
              questionsPerGroup=9;
              groupAttemptAny=6;
          }
          //const questionsPerGroup = 6;
          const totalGroups = Math.ceil(shortQuestions.length / questionsPerGroup);
        for (let g = 0; g < totalGroups; g++) {
            const groupQuestions = shortQuestions.slice(g * questionsPerGroup,(g + 1) * questionsPerGroup);
// Q. numbering starts from 2 for Part I in board layout
             questionNumber = g + 2;
 // Get toAttempt value for short questions
            const shortToAttemptValue = getToAttemptForType('short');
            const showAttemptAny = groupAttemptAny < groupQuestions.length;
       let instructionHtml = '<div class="instructions1" style="font-weight: bold; font-size: 13px; line-height: 1.3; display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; margin-top: 2px;">';
            if (isEnglish || isBilingual) {
              if (showAttemptAny) {
                instructionHtml += `<div class="eng" style="vertical-align: baseline;"><strong>${questionNumber}.</strong> Write short answers to any ${groupAttemptAny} question(s). (${groupAttemptAny} x ${shortMarksPerQuestion} = ${groupAttemptAny*shortMarksPerQuestion})</div>`;
              } else {
                instructionHtml += `<div class="eng" style="vertical-align: baseline;"><strong>${questionNumber}.</strong> Write short answers to the following questions. (${shortTotalMarks})</div>`;
              }
            }
            if (isUrdu || isBilingual) {
              if (showAttemptAny) {
                instructionHtml += `<div class="urdu" style="direction:rtl;"><strong><span>${subject==="urdu" ? questionNumber+1 :questionNumber}.</span> سوالات میں سے ${groupAttemptAny}  سوالات کے مختصر جوابات لکھیں۔ </strong></div>`;
              } else {
                instructionHtml += `<div class="urdu" style="direction:rtl;"><strong><span>${subject==="urdu" ? questionNumber+1 :questionNumber}.</span> درج ذیل سوالات کے مختصر جوابات لکھیں۔ </strong></div>`;
              }
            }
            instructionHtml += '</div>';
           subjectiveContent += `
              <div class="short-questions ${isUrdu ? 'urdu' : ''}" style="line-height:1.2; font-size:11px;">
      ${instructionHtml}
  `;
if (subject === 'urdu' || isUrdu) {
  // For Urdu, two questions per row
  for (let i = 0; i < groupQuestions.length; i += 2) {
    subjectiveContent += `<div class="short-question-row" style="display:flex; gap:10px; margin-bottom:2px;">`;

    for (let j = i; j < i + 2 && j < groupQuestions.length; j++) {
      const pq = groupQuestions[j];
      const q = pq.questions;
      const questionMarks = pq.custom_marks || shortMarks;
      const { eng: englishQuestionRaw, ur: urduQuestionRaw } = extractEnglishAndUrdu(q.question_text, q.question_text_ur);
      const urduQuestion = formatQuestionText(urduQuestionRaw || englishQuestionRaw || '');

      subjectiveContent += `
        <div class="short-question-item" style="flex:1; line-height:1.3; font-size:11px;">
          <div style="display:flex; align-items:flex-start; gap:5px; direction:rtl; text-align:right;">
            <div style="flex-shrink:0; font-weight:bold;">(${toRoman(j + 1)})</div>
            <div style="flex:1;">${urduQuestion} <span class="marks-display">(${questionMarks})</span></div>
          </div>
        </div>
      `;
    }

    subjectiveContent += `</div>`; // end row
  }
} else {
  // For English or bilingual, one question per row
  groupQuestions.forEach((pq: any, idx: number) => {
    const q = pq.questions;
    const questionMarks = pq.custom_marks || shortMarks;
    const { eng: englishQuestionRaw, ur: urduQuestionRaw } = extractEnglishAndUrdu(q.question_text, q.question_text_ur);
    const englishQuestion = formatQuestionText(englishQuestionRaw || '');
    const urduQuestion = formatQuestionText(urduQuestionRaw || '');
    const hasUrdu = hasActualUrduText(urduQuestion);

    subjectiveContent += `
  <div class="short-question-item" style="line-height:1.0; font-size:11px; margin-bottom:0px;">
    <div style="display:flex; align-items:flex-start; gap:5px;">
      <!-- English question with number -->
      <div style="flex-shrink:0; font-weight:bold;">(${toRoman(idx + 1)})</div>
      <div style="flex:1;">
        ${englishQuestion} <span class="marks-display">(${questionMarks})</span>
      </div>
    </div>

    ${(!isEnglish && hasUrdu) ? `
      <!-- Urdu question with its own number -->
      <div style="display:flex; align-items:flex-start; gap:5px; direction:rtl; text-align:right; margin-top:0px;">
        <div style="flex-shrink:0; font-weight:bold;" class="urdu">(${toRoman(idx + 1)})</div>
        <div style="flex:1;" class="urdu">
          ${urduQuestion} <span class="marks-display">(${questionMarks})</span>
        </div>
      </div>
    ` : ''}
  </div>
`;

  });
}

 subjectiveContent += `
     </div>
  `;
          }
        } else {
          ////console.log('⏭️ No short questions for board paper');
        }

        
   // Translate Urdu (English)
        if (translateUrduQuestions.length > 0) {
          const toAttemptForType = getToAttemptForType('translate_urdu');
          const showAttemptAny = toAttemptForType > 0 && toAttemptForType < translateUrduQuestions.length;
          // ✅ Marks per translation question (safe global)
        const translateUrduMarksPerQuestion = translateUrduQuestions[0]?.custom_marks ?? translate_urduMarks;
// ✅ Total marks for translation section
        const translateUrduTotalMarks =(showAttemptAny ? toAttemptForType : translateUrduQuestions.length) * translateUrduMarksPerQuestion;

 subjectiveContent += `<div class="instructions1" style="font-weight: bold; font-size: 13px; line-height: 1.3; display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; margin-top: 2px;">`;
         if (isEnglish || isBilingual) {
            if (showAttemptAny) {
              subjectiveContent += `<div class="instruction-text eng" style="vertical-align: baseline;"><span>${Number(questionNumber)+1 }.</span> Translate any ${toAttemptForType} of the following paragraphs into Urdu. (${toAttemptForType} x ${translateUrduMarksPerQuestion} = ${translateUrduTotalMarks})</div>`;
            } else {
              subjectiveContent += `<div class="instruction-text eng" style="vertical-align: baseline;"><span>${Number(questionNumber)+1 }.</span> Translate the following paragraphs into Urdu. (${toAttemptForType} x ${translateUrduMarksPerQuestion} = ${translateUrduTotalMarks})</div>`;
            }
          }
          subjectiveContent += `</div>`;
          translateUrduQuestions.forEach((pq: any, idx: number) => {
            const q = pq.questions;
            const questionMarks = pq.custom_marks || translate_urduMarks;
            const englishQuestion = formatQuestionText(q.question_text || 'No question text available');
            const hasUrduQuestion = hasActualUrduText(q.question_text_ur);
            const urduQuestion = hasUrduQuestion ? formatQuestionText(q.question_text_ur) : '';
            let questionDisplayHtml = '<div class="long-question" style="margin-bottom:2px;"><div style="display: flex; justify-content:space-between; font-size:11px; margin-top:2px;  line-height:1.3;">';
            if (isEnglish) {
                questionDisplayHtml += `<div class="eng" style="width:100%;">
                 <div style="display:flex; align-items:flex-start; gap:6px;">
                 <div style="flex-shrink:0; font-weight:bold;">(${toRoman(idx + 1)})</div>
             <div style="flex:1;">${englishQuestion}
                <span class="marks-display">(${questionMarks})</span>
            </div></div>
`;
            
            }
            questionDisplayHtml += `</div></div>`;

            subjectiveContent += `
            ${questionDisplayHtml}
         `;
          });
          
          partNumber++;
        }
        // Part II - Long Questions
        if (longQuestions.length > 0) {
          if(subject==='urdu' || subject_ur==='اردو'|| subject==='English'|| subject==='english'){
          subjectiveContent += `
  <div class="header" style="font-weight:bold; display: flex; align-items: baseline; justify-content: center; gap: 5px;">
    (
    ${(isEnglish || isBilingual) ? `<span class="english" style="vertical-align: baseline;">Part - II</span>` : ''}
    ${(isUrdu || isBilingual) ? `<span class="urdu" style="vertical-align: baseline; position: relative; top: 1px;">حصہ دوم</span>` : ''}
    )
  </div>`;
          }
          
        subjectiveContent += `<div class="instructions1" style="font-weight: bold; font-size: 13px; line-height: 1.3; margin-bottom: 2px; margin-top: 2px; display: flex; flex-direction: column;">`;

const longToAttemptValue = getToAttemptForType('long');
const showAttemptAny = longToAttemptValue < longQuestions.length;

// English
if (isEnglish || isBilingual) {
  if (showAttemptAny) {
    subjectiveContent += `<div class="instruction-text eng" style="vertical-align: baseline; text-align:left;"><span>Note:</span> Attempt any ${longToAttemptValue} question(s) in detail.</div>`;
  } else {
    subjectiveContent += `<div class="instruction-text eng" style="vertical-align: baseline; text-align:left;"><span>Note:</span> Attempt the following questions in detail.</div>`;
  }
}

// Urdu
if (isUrdu || isBilingual) {
  if (showAttemptAny) {
    if(subject==='urdu'){
    subjectiveContent += `<div class="instruction-text urdu" style="direction:rtl; text-align:right;"><span>نوٹ:</span>کوئی سے ${longToAttemptValue} سوالات کے جوابات تحریر کریں۔</div>`;
  }else{
 subjectiveContent += `<div class="instruction-text urdu" style="direction:rtl; text-align:right;"><span>نوٹ:</span>کوئی سے ${longToAttemptValue} سوالات کے تفصیل سے جوابات تحریر کریں۔</div>`;

}  } else {
    subjectiveContent += `<div class="instruction-text urdu" style="direction:rtl; text-align:right;"><span>نوٹ:</span> درج ذیل سوالات کے تفصیل سے جوابات تحریر کریں۔</div>`;
  }
}

subjectiveContent += `</div>`; // end instructions1
questionNumber=questionNumber+1;
  longQuestions.forEach((pq: any, idx: number) => {
  const q = pq.questions;
  const questionMarks = pq.custom_marks || longMarks;
  questionNumber = Number(questionNumber) + 1;
  const englishQuestion = formatQuestionText(q.question_text || 'No question text available');
  const hasUrduQuestion = hasActualUrduText(q.question_text_ur);
  const urduQuestion = hasUrduQuestion ? formatQuestionText(q.question_text_ur) : '';

  let longQuestionDisplayHtml = `<div class="long-question" style="margin-bottom:2px;">`;
  longQuestionDisplayHtml += `<div style="display: flex; justify-content:space-between; font-size:13px; margin-top:0px; line-height:1.4;">`;

  if (isEnglish) {
    longQuestionDisplayHtml += `
      <div class="eng" style="${subject==='urdu'||subject==='english'||subject==='English'?'vertical-align: baseline; line-height:1.4; font-weight:bold':''}; width:100%;">
        <div style="display:flex; align-items:flex-start; gap:5px;">
          <div style="flex-shrink:0;"><strong>${subject==='urdu'||subject==='english'||subject==='English' ? questionNumber : `Q.${idx + 1}`}.</strong></div>
          <div style="flex:1;">${englishQuestion} <span class="marks-display">(${questionMarks})</span></div>
        </div>
      </div>
    `;
  } else if (isUrdu) {
    longQuestionDisplayHtml += `
      <div class="urdu" style="width:100%; direction:rtl; text-align:right;">
        <div style="display:flex; align-items:flex-start; gap:5px; ${subject==='urdu'?' font-size:13px; font-weight:bold; line-height:1.3;':''}">
          <div style="flex-shrink:0;"><strong>${subject==='urdu' ? questionNumber : `سوال ${idx + 1}`}.</strong></div>
          <div style="flex:1;">${urduQuestion} <span class="marks-display">(${questionMarks})</span></div>
        </div>
      </div>
    `;
  } else { // bilingual
    longQuestionDisplayHtml += `
      <div class="eng" style="width:48%;">
        <div style="display:flex; align-items:flex-start; gap:5px;">
          <div style="flex-shrink:0;"><strong>Q.${idx + 1}.</strong></div>
          <div style="flex:1;">${englishQuestion} <span class="marks-display">(${questionMarks})</span></div>
        </div>
      </div>
    `;
    if (hasUrduQuestion) {
      longQuestionDisplayHtml += `
        <div class="urdu" style="width:48%; direction:rtl; text-align:right;">
          <div style="display:flex; align-items:flex-start; gap:5px;">
            <div style="flex-shrink:0;"><strong>سوال ${idx + 1}:</strong></div>
            <div style="flex:1;">${urduQuestion} <span class="marks-display">(${questionMarks})</span></div>
          </div>
        </div>
      `;
    }
  }

  longQuestionDisplayHtml += `</div></div>`; // close inner flex + long-question container
  subjectiveContent += longQuestionDisplayHtml;
});

        } else {
          ////console.log('⏭️ No long questions for board paper');
        }
        
        // Additional Urdu/English question types for board paper
        // Start from Part III for additional types
        
        
        
        // Prose Explanation (Urdu)
        if (proseExplanationQuestions.length > 0) {
          const toAttemptForType = getToAttemptForType('prose_explanation');
          const showAttemptAny = toAttemptForType > 0 && toAttemptForType < proseExplanationQuestions.length;
          // Marks per prose explanation (safe global)
const proseExplanationMarksPerQuestion =
  proseExplanationQuestions[0]?.custom_marks ?? prose_explanationMarks;
questionNumber  = questionNumber+1;
// Total marks
const proseExplanationTotalMarks =
  (showAttemptAny ? toAttemptForType : proseExplanationQuestions.length) *
  proseExplanationMarksPerQuestion;

   subjectiveContent += `<div class="instructions1" style="font-weight: bold; font-size: 13px; line-height: 1.3; display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; margin-top: 2px;">`;
          if (isUrdu || isBilingual) {
            if (showAttemptAny) {
              subjectiveContent += `<div class="urdu" style="flex: 1; text-align: right; direction: rtl;">  <span dir="ltr" style="font-weight:bold; margin-left:4px;">
      .${questionNumber}
    </span>
    کوئی سے ${toAttemptForType} نثرپاروں کی تشریح کریں۔سبق کا نام اورمصنف کا نام بھی لکھیں۔</div>`;
            } else {
              subjectiveContent += `<div class="urdu" style="flex: 1; text-align: right; direction: rtl;">  <span dir="ltr" style="font-weight:bold; margin-left:0px;">
      .${questionNumber}
    </span>
    درج ذیل نثرپاروں کی تشریح کریں۔سبق کا نام اورمصنف کا نام بھی لکھیں۔</div>`;
            }
          }
          subjectiveContent += `</div>`;
          
         proseExplanationQuestions.forEach((pq: any, idx: number) => {
  const q = pq.questions;
  const questionMarks = pq.custom_marks || prose_explanationMarks;
  
  const englishQuestion = formatQuestionText(q.question_text || 'No question text available');
  const hasUrduQuestion = hasActualUrduText(q.question_text_ur);
  const urduQuestion = hasUrduQuestion ? formatQuestionText(q.question_text_ur) : '';

  let questionDisplayHtml = `<div class="long-question" style="margin-bottom:2px;">`;


   if (isUrdu) {
    questionDisplayHtml += `
      <div class="urdu" style="width:100%; direction:rtl; text-align:justify;">
        <div style="display:flex; align-items:flex-start; gap:5px; font-size:11px; line-height:1.3;">
          <div style="flex-shrink:0;"><strong>(${toRoman(idx + 1)})</strong></div>
          <div style="flex:1;">${urduQuestion} <span class="marks-display">(${questionMarks})</span></div>
        </div>
      </div>
    `;
  }

  questionDisplayHtml += `</div>`; // end long-question
  subjectiveContent += questionDisplayHtml;
});

          
          partNumber++;
        }

   // sentence correction jumlo ki darustgi. (urdu subject)
        if (sentenceCorrectionQuestions.length > 0) {
          const toAttemptForType = getToAttemptForType('sentence_correction');
          const showAttemptAny = toAttemptForType > 0 && toAttemptForType < sentenceCorrectionQuestions.length;
          // ✅ Marks per translation question (safe global)
         questionNumber  = questionNumber+1;
        const translateUrduMarksPerQuestion = translateUrduQuestions[0]?.custom_marks ?? translate_urduMarks;
// ✅ Total marks for translation section
        const translateUrduTotalMarks =(showAttemptAny ? toAttemptForType : translateUrduQuestions.length) * translateUrduMarksPerQuestion;

        subjectiveContent += `<div class="instructions1" style="font-weight: bold; font-size: 13px; line-height: 1.3; display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; margin-top: 2px;">`;
         if (isUrdu || isBilingual) {
            if (showAttemptAny) {
              subjectiveContent += `<div class="urdu" style="flex: 1; text-align: right; direction: rtl;">
               <span dir="ltr" style="font-weight:bold; margin-left:4px;">
      .${questionNumber}
    </span>
              کوئی سے ${toAttemptForType} جملوں کی درستی کیجئے۔</div>`;
            } else {
              subjectiveContent += `<div class="urdu" style="flex: 1; text-align: right; direction: rtl;"> <span dir="ltr" style="font-weight:bold; margin-left:0px;">
      .${questionNumber}
    </span> درج ذیل جملوں کی درستی کیجئے۔</div>`;
            }
          }
          subjectiveContent += `</div>`;
         for (let i = 0; i < sentenceCorrectionQuestions.length; i += 3) {

  subjectiveContent += `
        <div style="display:flex; gap:10px; margin-bottom:4px; direction:rtl;">

  `;

  for (let j = i; j < i + 3 && j < sentenceCorrectionQuestions.length; j++) {

    const pq = sentenceCorrectionQuestions[j];
    const q = pq.questions;
    const questionMarks = pq.custom_marks || translate_urduMarks;
    const englishQuestion = formatQuestionText(q.question_text || 'No question text available');

    subjectiveContent += `
      <div class="urdu" style="flex:1; font-size:11px; line-height:1.3;">
        <div style="display:flex; align-items:flex-start; gap:5px; ">
          
          <!-- Question Number -->
          <div style="flex-shrink:0; font-weight:bold;">
            (${toRoman(j + 1)})
          </div>

          <!-- Question Text -->
          <div style="flex:1;">
            ${englishQuestion}
            <span class="marks-display">(${questionMarks})</span>
          </div>

        </div>
      </div>
    `;
  }

  subjectiveContent += `</div>`;
}

          
          partNumber++;
        }

         // sentence completeness jumlo ki Takmeel. (urdu subject)
        if (sentenceCompletionQuestions.length > 0) {
          const toAttemptForType = getToAttemptForType('sentence_completion');
          const showAttemptAny = toAttemptForType > 0 && toAttemptForType < sentenceCompletionQuestions.length;
          // ✅ Marks per translation question (safe global)
          questionNumber  = questionNumber+1;
         ////console.log('📝 sentenceCompletionQuestions:', sentenceCompletionQuestions);
        const translateUrduMarksPerQuestion = translateUrduQuestions[0]?.custom_marks ?? translate_urduMarks;
// ✅ Total marks for translation section
        const translateUrduTotalMarks =(showAttemptAny ? toAttemptForType : translateUrduQuestions.length) * translateUrduMarksPerQuestion;

        subjectiveContent += `<div class="instructions1" style="font-weight: bold; font-size: 13px; line-height: 1.3; display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; margin-top: 2px;">`;
         if (isUrdu || isBilingual) {
            if (showAttemptAny) {
              subjectiveContent += `<div class="urdu" style="flex: 1; text-align: right; direction: rtl;"> 
               <span dir="ltr" style="font-weight:bold; margin-left:4px;">
      .${questionNumber}
    </span>
              کوئی سے ${toAttemptForType} جملوں کی تکمیل کیجئے۔</div>`;
            } else {
              subjectiveContent += `<div class="urdu" style="flex: 1; text-align: right; direction: rtl;"> 
               <span dir="ltr" style="font-weight:bold; margin-left:4px;">
      .${questionNumber}
    </span>
              درج ذیل جملوں کی تکمیل کیجئے۔</div>`;
            }
          }
          subjectiveContent += `</div>`;
         for (let i = 0; i < sentenceCompletionQuestions.length; i += 3) {

  subjectiveContent += `
    <div style="display:flex; gap:10px; margin-bottom:4px; direction:rtl;">
  `;

  for (let j = i; j < i + 3 && j < sentenceCompletionQuestions.length; j++) {

    const pq = sentenceCompletionQuestions[j];
    const q = pq.questions;
    const questionMarks = pq.custom_marks || translate_urduMarks;
    const englishQuestion = formatQuestionText(q.question_text || 'No question text available');

    subjectiveContent += `
      <div class="urdu" style="flex:1; font-size:11px; line-height:1.3;">
        <div style="display:flex; align-items:flex-start; gap:5px;">
          
          <!-- Question Number -->
          <div style="flex-shrink:0; font-weight:bold;">
            (${toRoman(j + 1)})
          </div>

          <!-- Question Text -->
          <div style="flex:1;">
            ${englishQuestion}
            <span class="marks-display">(${questionMarks})</span>
          </div>

        </div>
      </div>
    `;
  }

  subjectiveContent += `</div>`;
}
         partNumber++;
        }
  // Passage (English)
        if (passageQuestions.length > 0) {
          const toAttemptForType = getToAttemptForType('passage');
          const showAttemptAny = toAttemptForType > 0 && toAttemptForType < passageQuestions.length;
          questionNumber  = questionNumber+1;  
          // Marks per passage question
const passageMarksPerQuestion =
  passageQuestions[0]?.custom_marks ?? passageMarks;

// Total marks
const passageTotalMarks =(showAttemptAny ? toAttemptForType : passageQuestions.length) * passageMarksPerQuestion;

        subjectiveContent += `<div class="instructions1" style="font-weight: bold; font-size: 14px; line-height: 1.3; display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; margin-top: 2px;">`;
          if (isEnglish || isBilingual) {
            if (showAttemptAny) {
              subjectiveContent += `<div class="instruction-text eng" style="vertical-align: baseline;"><span>${questionNumber}. </span>Read the following passage carefully and answer the questions given at the end. (${showAttemptAny ? toAttemptForType : passageQuestions.length}x${passageMarksPerQuestion}  = ${passageTotalMarks})</div>`;
            } else {
              subjectiveContent += `<div class="instruction-text eng" style="vertical-align: baseline;"><span>${questionNumber}. </span>Read the following passage carefully and answer the questions given at the end. (${showAttemptAny ? toAttemptForType : passageQuestions.length}x${passageMarksPerQuestion} = ${passageTotalMarks})</div>`;
            }
          }
          subjectiveContent += `</div>`;
          
          passageQuestions.forEach((pq: any, idx: number) => {
            const q = pq.questions;
            const questionMarks = pq.custom_marks || passageMarks;
           const englishQuestion = formatQuestionText(q.question_text || 'No question text available');
            const hasUrduQuestion = hasActualUrduText(q.question_text_ur);
            const urduQuestion = hasUrduQuestion ? formatQuestionText(q.question_text_ur) : '';
            let questionDisplayHtml = '<div class="long-question" style="margin-bottom:2px;"><div style="display: flex; justify-content:space-between; font-size:11px; margin-top:5px;  line-height:1.3;">';
            if (isEnglish) {
                questionDisplayHtml += `<div class="eng" style="width:100%;"> ${englishQuestion} <span class="marks-display">(${questionMarks})</span></div>`;
            } else if (isUrdu) {
                questionDisplayHtml += `<div class="urdu" style="width:100%; direction:rtl; text-align:right;"><strong>سوال ${idx + 1}:</strong> ${urduQuestion}<span class="marks-display">(${questionMarks})</span></div>`;
            } else { // bilingual
                questionDisplayHtml += `<div class="eng" style="width:48%;"> ${englishQuestion} <span class="marks-display">(${questionMarks})</span></div>`;
                if (hasUrduQuestion) {
                questionDisplayHtml += `<div class="urdu" style="width:48%; direction:rtl; text-align:right;">${urduQuestion}<span class="marks-display">(${questionMarks})</span></div>`;
                }
            }
            questionDisplayHtml += `</div></div>`;

            subjectiveContent += `
            ${questionDisplayHtml}
         `;
          });
          
          partNumber++;
        }

          // Translate into English (English)
        if (translateEnglishQuestions.length > 0) {
          const toAttemptForType = getToAttemptForType('translate_english');
          const showAttemptAny = toAttemptForType > 0 && toAttemptForType < translateEnglishQuestions.length;
          questionNumber  = questionNumber+1;
          // Marks per translate English question
          const translateEnglishMarksPerQuestion =
          translateEnglishQuestions[0]?.custom_marks ?? translate_englishMarks;

// Total marks
const translateEnglishTotalMarks =(showAttemptAny ? toAttemptForType : translateEnglishQuestions.length) * translateEnglishMarksPerQuestion;

          subjectiveContent += `
 
  <div class="instructions1" style="font-weight: bold; font-size: 13px; line-height: 1.3; display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; margin-top: 2px;">`;
          
          if (isEnglish || isBilingual) {
            if (showAttemptAny) {
              subjectiveContent += `<div class="instruction-text eng" style="vertical-align: baseline;"><span>${questionNumber}. </span> Translate any ${toAttemptForType} of the following paragraphs into English.  <span class="marks-display">(${toAttemptForType} x ${translateEnglishMarksPerQuestion} = ${translateEnglishTotalMarks})</span>
</div>`;
            } else {
              subjectiveContent += `<div class="instruction-text eng" style="vertical-align: baseline;"><span>${questionNumber}. </span> Translate the following paragraphs into English.  <span class="marks-display">(${toAttemptForType} x ${translateEnglishMarksPerQuestion} = ${translateEnglishTotalMarks})</span>
</div>`;
            }
          }
          subjectiveContent += `</div>`;
          
          translateEnglishQuestions.forEach((pq: any, idx: number) => {
            const q = pq.questions;
            const questionMarks = pq.custom_marks || translate_englishMarks;
           const englishQuestion = formatQuestionText(q.question_text || 'No question text available');
            const hasUrduQuestion = hasActualUrduText(q.question_text_ur);
            const urduQuestion = hasUrduQuestion ? formatQuestionText(q.question_text_ur) : '';

            let questionDisplayHtml = '<div class="long-question" style="margin-bottom:2px;"><div style="display: flex; justify-content:space-between; font-size:11px; margin-top:5px;  line-height:1.3;">';
            if (isEnglish) {
                questionDisplayHtml += `<div class="urdu" style="width:100%;"><strong></strong> ${englishQuestion} <span class="marks-display">(${questionMarks})</span></div>`;
            } else if (isUrdu) {
                questionDisplayHtml += `<div class="urdu" style="width:100%; direction:rtl; text-align:right;"><strong>سوال ${idx + 1}:</strong> ${urduQuestion}<span class="marks-display">(${questionMarks})</span></div>`;
            } else { // bilingual
                questionDisplayHtml += `<div class="eng" style="width:48%;"><strong></strong> ${englishQuestion} <span class="marks-display">(${questionMarks})</span></div>`;
                if (hasUrduQuestion) {
                questionDisplayHtml += `<div class="urdu" style="width:48%; direction:rtl; text-align:right;"><strong>سوال ${idx + 1}:</strong>${urduQuestion}<span class="marks-display">(${questionMarks})</span></div>`;
                }
            }
            questionDisplayHtml += `</div></div>`;

            subjectiveContent += `
            ${questionDisplayHtml}
         `;
          });
          
          partNumber++;
        }

          // make sentences of these idiom/phrases/words(English)
      if (idiomPhrasesQuestions.length > 0) {
  const toAttemptForType = getToAttemptForType('idiom_phrases');
  const showAttemptAny = toAttemptForType > 0 && toAttemptForType < idiomPhrasesQuestions.length;
  questionNumber  = questionNumber + 1;

  // Marks per idiom/phrase question
  const idiomPhrasesMarksPerQuestion =
    idiomPhrasesQuestions[0]?.custom_marks ?? idiom_phrasesMarks;

  // Total marks: use number of questions correctly
  const numQuestionsToUse = showAttemptAny ? toAttemptForType : idiomPhrasesQuestions.length;
  const idiomPhrasesTotalMarks = numQuestionsToUse * idiomPhrasesMarksPerQuestion;

  subjectiveContent += `
    <div class="instructions1" style="font-weight: bold; font-size: 13px; line-height: 1.3; display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; margin-top: 2px;">
  `;

  if (isEnglish || isBilingual) {
    if (showAttemptAny) {
      subjectiveContent += `
        <div class="instruction-text eng" style="vertical-align: baseline;">
          <span>${questionNumber}. </span>
          Use any ${toAttemptForType} of the following Words/Phrases/Idioms in your sentences.
          <span class="marks-display">(${idiomPhrasesMarksPerQuestion} x ${toAttemptForType} = ${idiomPhrasesTotalMarks})</span>
        </div>
      `;
    } else {
      subjectiveContent += `
        <div class="instruction-text eng" style="vertical-align: baseline;">
          <span>${questionNumber}. </span>
          Translate all of the following Words/Phrases/Idioms.
          <span class="marks-display">(${idiomPhrasesMarksPerQuestion} x ${idiomPhrasesQuestions.length} = ${idiomPhrasesTotalMarks})</span>
        </div>
      `;
    }
  }

  subjectiveContent += `</div>`;
idiomPhrasesQuestions.forEach((pq: any, idx: number) => {
  const q = pq.questions;
  const questionMarks = pq.custom_marks || idiom_phrasesMarks;
  const englishQuestion = formatQuestionText(q.question_text || 'No question text available');
  const hasUrduQuestion = hasActualUrduText(q.question_text_ur);
  const urduQuestion = hasUrduQuestion ? formatQuestionText(q.question_text_ur) : '';

  // Open a new row every 4 questions
  if (idx % 4 === 0) {
    subjectiveContent += `<div class="idiom-row" style="display:flex; gap:10px; margin-bottom:4px;">`;
  }

  let questionDisplayHtml = `
    <div class="idiom-col" style="flex:1; font-size:11px; line-height:1.3;">
      <div class="long-question">
  `;

  if (isEnglish) {
    questionDisplayHtml += `
      <div class="eng">
        <strong>(${toRoman(idx + 1)}).</strong> ${englishQuestion}
        <span class="marks-display">(${questionMarks})</span>
      </div>
    `;
  }

  questionDisplayHtml += `
      </div>
    </div>
  `;

  subjectiveContent += questionDisplayHtml;

  // Close row after 4 columns OR last item
  if (idx % 4 === 3 || idx === idiomPhrasesQuestions.length - 1) {
    subjectiveContent += `</div>`;
  }
});


  partNumber++;
}

    if (activePassiveQuestions.length > 0) {
  const toAttemptForType = getToAttemptForType('active_passive');
  const showAttemptAny = toAttemptForType > 0 && toAttemptForType < activePassiveQuestions.length;
  questionNumber = questionNumber + 1;

  // Marks per active/passive question
  const activePassiveMarksPerQuestion =
    activePassiveQuestions[0]?.custom_marks ?? activePassiveMarks;

  // Total marks
  const numQuestionsToUse = showAttemptAny ? toAttemptForType : activePassiveQuestions.length;
  const activePassiveTotalMarks = numQuestionsToUse * activePassiveMarksPerQuestion;

  subjectiveContent += `
    <div class="instructions1" style="font-weight: bold; font-size: 13px; line-height: 1.3; display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; margin-top: 2px;">
  `;

  if (isEnglish || isBilingual) {
    if (showAttemptAny) {
      subjectiveContent += `
        <div class="instruction-text eng" style="vertical-align: baseline;">
          <span>${questionNumber}. </span> Change the voice  ${toAttemptForType} of the following sentences.
          <span class="marks-display">(${activePassiveMarksPerQuestion} x ${toAttemptForType} = ${activePassiveTotalMarks})</span>
        </div>
      `;
    } else {
      subjectiveContent += `
        <div class="instruction-text eng" style="vertical-align: baseline;">
          <span>${questionNumber}. </span> Change the voice of the following.
          <span class="marks-display">(${activePassiveMarksPerQuestion} x ${activePassiveQuestions.length} = ${activePassiveTotalMarks})</span>
        </div>
      `;
    }
  }

  subjectiveContent += `</div>`;

  activePassiveQuestions.forEach((pq: any, idx: number) => {
  const q = pq.questions;
  const questionMarks = pq.custom_marks || activePassiveMarks;
  const englishQuestion = formatQuestionText(q.question_text || 'No question text available');
  const hasUrduQuestion = hasActualUrduText(q.question_text_ur);
  const urduQuestion = hasUrduQuestion ? formatQuestionText(q.question_text_ur) : '';

  // Open a new row every 3 questions
  if (idx % 3 === 0) {
    subjectiveContent += `<div class="ap-row" style="display:flex; gap:12px; margin-bottom:4px;">`;
  }

  let questionDisplayHtml = `
    <div class="ap-col" style="flex:1; font-size:11px; line-height:1.2;">
      <div class="long-question">
        <div style="display:flex; justify-content:space-between; margin-top:5px;">
          <div class="eng" style="width:100%;">
            <strong>(${toRoman(idx + 1)}).</strong> ${englishQuestion}
            <span class="marks-display">(${questionMarks})</span>
          </div>
        </div>
      </div>
    </div>
  `;

  subjectiveContent += questionDisplayHtml;

  // Close row after 3 columns OR last item
  if (idx % 3 === 2 || idx === activePassiveQuestions.length - 1) {
    subjectiveContent += `</div>`;
  }
});

  partNumber++;
}

        
        // Add more additional types as needed (translate_english, idiom_phrases, passage, etc.)
     } else {
        // REGULAR (NON-BOARD) PAPER: Render subjective questions by type
        let partNumber = 1;
          let itemsPerRow = 1;
        for (const type of subjectiveTypes) {
          const typeQuestions = subjectiveQuestionsByType[type] || [];
          if (typeQuestions.length === 0) continue;

          // Determine if this type should be rendered as long or short style
          const isLongStyle = type === 'long' || type === 'passage';
          
          // Get toAttempt value for this type
          const toAttemptForType = getToAttemptForType(type);
          const showAttemptAny = toAttemptForType > 0 && toAttemptForType < typeQuestions.length;

          // Part header
          if(subject==="urdu" || subject==="English" || mcqPlacement==="three_papers"){}else{  
                subjectiveContent += `
      <div class="header" style="font-weight:bold; display: flex; align-items: baseline; justify-content: center; gap: 5px;">
        (
        ${(isEnglish || isBilingual) ? `<span class="english" style="vertical-align: baseline;">Part - ${partNumber} </span>` : ''}
        ${(isUrdu) ? `<span class="urdu" style="vertical-align: baseline; position: relative; top: 1px;">حصہ ${partNumber}</span>` : ''}
        )
      </div>
      `;
          }
          
          if (isLongStyle) {
            // Render as long questions
           
           
            if(subject==="urdu" || subject==="English"){
              ////console.log(`📝 Rendering long questions for URDU subject`);
              
            } else {
             
              subjectiveContent += `
        <div class="instructions1" style="font-weight: bold; font-size: 14px; line-height: 1.4; display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; margin-top: 4px;">`;
              
              if (isEnglish || isBilingual) {
                if (showAttemptAny) {
                  subjectiveContent += `<div class="instruction-text eng" style="${mcqPlacement==='three_papers' || mcqPlacement==='two_papers'?'font-size:12px;':'vertical-align: baseline;'}"><span>Note:</span> Attempt any ${toAttemptForType} question(s) in detail.</div>`;
                } else {
                  subjectiveContent += `<div class="instruction-text eng" style="${mcqPlacement==='three_papers' || mcqPlacement==='two_papers'?'font-size:12px;':'vertical-align: baseline;'}"><span>Note:</span> Attempt the following questions in detail.</div>`;
                }
              }
              if (isUrdu || isBilingual) {
                if (showAttemptAny) {
                  subjectiveContent += `<div class="urdu" style="flex: 1; text-align: right; direction: rtl; ${mcqPlacement==='three_papers' || mcqPlacement==='two_papers'?'font-size:12px;':''}">  کوئی سے  ${toAttemptForType} سوالات کے  تفصیل سے جوابات تحریر کریں۔</div>
                `;
                } else {
                  subjectiveContent += `<div class="urdu" style="flex: 1; text-align: right; direction: rtl; ${mcqPlacement==='three_papers' || mcqPlacement==='two_papers'?'font-size:12px;':''}">  درج ذیل سوالات کے تفصیل سے جوابات تحریر کریں۔</div>
                `;
                }
              }
              subjectiveContent += `</div>`;
            }
            
    // For long questionsDecide items per row
let itemsPerRow = 1;

if (mcqPlacement === 'three_papers'&& subject==="urdu" || subject==="english") {
  itemsPerRow = 2;
}

let rowOpen = false;

typeQuestions.forEach((pq: any, idx: number) => {
  const q = pq.questions;
  const questionMarks = pq.custom_marks || longMarks;

  const englishQuestion = formatQuestionText(
    q.question_text || 'No question text available'
  );

  const hasUrduQuestion = hasActualUrduText(q.question_text_ur);
  const urduQuestion = hasUrduQuestion
    ? formatQuestionText(q.question_text_ur)
    : '';

  // ─── OPEN ROW ─────────────────────────────
  if (itemsPerRow > 1 && idx % itemsPerRow === 0) {
    subjectiveContent += `
      <div class="long-row"
        style="
          display:flex;
          gap:8px;
          margin-bottom:4px;
        ">
    `;
  }

  // ─── QUESTION BLOCK ───────────────────────
  let longQuestionDisplayHtml = `
    <div class="long-question"
      style="
        flex:1;
        width:${itemsPerRow > 1 ? `${100 / itemsPerRow}%` : '100%'};
        margin-bottom:2px;
      ">
  `;

  // ─── ENGLISH ONLY ─────────────────────────
  if (isEnglish) {
    longQuestionDisplayHtml += `
      <div style="display:flex; align-items:flex-start; font-size:11px; line-height:1.15;">
        <div style="width:26px; flex-shrink:0;">
          <strong>Q.${idx + 1}</strong>
        </div>
        <div style="flex:1;">
          ${englishQuestion}
          <span class="marks-display">(${questionMarks})</span>
        </div>
      </div>`;
  }

  // ─── URDU ONLY ────────────────────────────
  else if (isUrdu) {
    longQuestionDisplayHtml += `
      <div class="urdu" style="display:flex; align-items:flex-start; font-size:11px; line-height:1.2; direction:rtl;">
        <div style="width:30px; flex-shrink:0; text-align:right;">
          <strong>سوال ${idx + 1}</strong>
        </div>
        <div style="flex:1; text-align:right;">
          ${urduQuestion}
          <span class="marks-display">(${questionMarks})</span>
        </div>
      </div>`;
  }

  // ─── BILINGUAL ────────────────────────────
  else {
    longQuestionDisplayHtml += `
      <div  style="display:flex; gap:6px;">
        
        <div style="display:flex; align-items:flex-start; width:50%; font-size:11px; line-height:1.15;">
          <div style="width:26px; flex-shrink:0;">
            <strong>Q.${idx + 1}</strong>
          </div>
          <div style="flex:1;">
            ${englishQuestion}
            <span class="marks-display">(${questionMarks})</span>
          </div>
        </div>
    `;

    if (hasUrduQuestion) {
      longQuestionDisplayHtml += `
        <div class="urdu" style="display:flex; align-items:flex-start; margin-right:0px; padding-right:0px; width:50%; font-size:11px; line-height:1.2;">
          <div style="width:30px; flex-shrink:0;">
            <strong>سوال ${idx + 1}</strong>
          </div>
          <div style="flex:1;">
            ${urduQuestion}
            <span class="marks-display">(${questionMarks})</span>
          </div>
        </div>
      `;
    }

    longQuestionDisplayHtml += `</div>`;
  }

  longQuestionDisplayHtml += `</div>`;
  subjectiveContent += longQuestionDisplayHtml;

  // ─── CLOSE ROW ────────────────────────────
  if (
    itemsPerRow > 1 &&
    (idx % itemsPerRow === itemsPerRow - 1 ||
      idx === typeQuestions.length - 1)
  ) {
    subjectiveContent += `</div>`;
  }
});

// end long questionsDecide items per row
          } else {
            // Render as short questions and all other types of questions
            ////console.log(`📝 Rendering ${type} questions with toAttempt: ${toAttemptForType}`);
            
            let instructionHtml = '<div style="display:flex;  justify-content:space-between; margin-bottom:0px; font-weight:bold">';
            
            // Get default marks for this type
            let defaultMarks = shortMarks;
            if (type === 'mcq') defaultMarks = mcqMarks;
            if (type === 'long') defaultMarks = longMarks;
          
            // Determine instruction text based on question type and toAttempt value
            switch(type) {
              case 'short': {
                if (!isBilingual) {
                  if(mcqPlacement==='three_papers'){
                  
                    itemsPerRow = 3;
                  }else{
                    itemsPerRow = 2;
                  }
                                    
                            }else{
                  itemsPerRow = mcqPlacement==='three_papers'? 2:1;
                            }
                
                if (isEnglish || isBilingual) {
                  if (showAttemptAny) {
                    instructionHtml += `<div class="eng" style="${mcqPlacement==='three_papers'?'font-size:12px;':''}"> Write short answers of any ${toAttemptForType} question(s). </div>`;
                  } else {
                    instructionHtml += `<div class="eng" style="${mcqPlacement==='three_papers'?'font-size:12px;':''}"> Write short answers of the following questions. </div>`;
                  }
                }
                if (isUrdu || isBilingual) {
                  if (showAttemptAny) {
                    instructionHtml += `<div class="urdu" style="direction:rtl; ${mcqPlacement==='three_papers' || mcqPlacement==='two_papers'?'font-size:12px;':''}">
                      کوئی سے ${toAttemptForType} سوالات کے مختصر جوابات تحریر کریں۔
                    </div>`;
                  } else {
                    instructionHtml += `<div class="urdu" style="direction:rtl; ${mcqPlacement==='three_papers' || mcqPlacement==='two_papers'?'font-size:12px;':''}">
                      درج ذیل سوالات کے مختصر جوابات تحریر کریں۔
                    </div>`;
                  }
                }
                break;
              }
              case 'translate_urdu': {
                if (isEnglish || isBilingual) {
                  if (showAttemptAny) {
                    instructionHtml += `<div class="eng" style="${mcqPlacement==='three_papers' || mcqPlacement==='two_papers'?'font-size:12px;':''}"> Translate any ${toAttemptForType} of the following paragraphs into Urdu.</div>`;
                  } else {
                    instructionHtml += `<div class="eng" style="${mcqPlacement==='three_papers' || mcqPlacement==='two_papers'?'font-size:12px;':''}"> Translate the following paragraphs into Urdu.</div>`;
                  }
                }
                break;
              }
              case 'translate_english': {
                instructionHtml += `<div class="eng"> Translate into English.</div>`;
                break;
              }
              case 'idiom_phrases': {
                  itemsPerRow = 4;
                if (isEnglish || isBilingual) {
                  if (showAttemptAny) {
                    instructionHtml += `<div class="eng" style="${mcqPlacement==='three_papers' || mcqPlacement==='two_papers'?'font-size:12px;':''}"> Use any ${toAttemptForType} of the following words/idioms/phrases in your sentences.</div>`;
                  } else {
                    instructionHtml += `<div class="eng" style="${mcqPlacement==='three_papers' || mcqPlacement==='two_papers'?'font-size:12px;':''}"> Use the following words/idioms/phrases in your sentences.</div>`;
                  }
                }
                break;
              }
              case 'activePassive': {
                if (isEnglish || isBilingual) {
                  if (showAttemptAny) {
                    instructionHtml += `<div class="eng" style="${mcqPlacement==='three_papers' || mcqPlacement==='two_papers'?'font-size:12px;':''}"> Change the voice of any ${toAttemptForType} of the following.</div>`;
                  } else {
                    instructionHtml += `<div class="eng" style="${mcqPlacement==='three_papers' || mcqPlacement==='two_papers'?'font-size:12px;':''}"> Change the voice of the following.</div>`;
                  }
                }
                break;
              }
              case 'directInDirect': {
                if (isEnglish || isBilingual) {
                  if (showAttemptAny) {
                    instructionHtml += `<div class="eng"> Change any ${toAttemptForType} of the following sentence into Indirect Form.</div>`;
                  } else {
                    instructionHtml += `<div class="eng"> Change the following sentence into Indirect Form.</div>`;
                  }
                }
                break;
              }
              case 'poetry_explanation': {
                  itemsPerRow = 2;
                if (isUrdu || isBilingual) {
                  if (showAttemptAny) {
                    instructionHtml += `<div class="urdu" style="direction:rtl; ${mcqPlacement==='three_papers' || mcqPlacement==='two_papers'?'font-size:12px;':''}"> کوئی سے ${toAttemptForType} اشعار کی تشریح کریں۔</div>`;
                  } else {
                    instructionHtml += `<div class="urdu" style="direction:rtl; ${mcqPlacement==='three_papers' || mcqPlacement==='two_papers'?'font-size:12px;':''}"> درج ذیل اشعار کی تشریح کریں۔</div>`;
                  }
                }
                break;
              }
              case 'prose_explanation': {
                if (isUrdu || isBilingual) {
                  if (showAttemptAny) {
                    instructionHtml += `<div class="urdu" style="direction:rtl; ${mcqPlacement==='three_papers' || mcqPlacement==='two_papers'?'font-size:12px;':''}">  کوئی سے ${toAttemptForType} نثرپاروں کی تشریح کریں۔سبق کا نام اورمصنف کا نام بھی لکھیں۔</div>`;
                  } else {
                    instructionHtml += `<div class="urdu" style="direction:rtl; ${mcqPlacement==='three_papers' || mcqPlacement==='two_papers'?'font-size:12px;':''}">  درج ذیل نثرپاروں کی تشریح کریں۔سبق کا نام اورمصنف کا نام بھی لکھیں۔</div>`;
                  }
                }
                break;
              }
              case 'sentence_correction': {
                 itemsPerRow = mcqPlacement==='three_papers'? 5:3;
                if (isUrdu || isBilingual) {
                  if (showAttemptAny) {
                    instructionHtml += `<div class="urdu" style="direction:rtl; ${mcqPlacement==='three_papers' || mcqPlacement==='two_papers'?'font-size:12px;':''}">  کوئی سے ${toAttemptForType} جملوں کی درستگی کریں۔</div>`;
                  } else {
                    instructionHtml += `<div class="urdu" style="direction:rtl; ${mcqPlacement==='three_papers' || mcqPlacement==='two_papers'?'font-size:12px;':''}">  درج ذیل جملوں کی درستگی کریں۔</div>`;
                  }
                }
                break;
              }
              case 'sentence_completion': {
                                  itemsPerRow = mcqPlacement==='three_papers'? 4:3;
                if (isUrdu || isBilingual) {
                  if (showAttemptAny) {
                    instructionHtml += `<div class="urdu" style="direction:rtl; ${mcqPlacement==='three_papers' || mcqPlacement==='two_papers'?'font-size:12px;':''}">  کوئی سے ${toAttemptForType} جملوں کی تکمیل کریں ۔</div>`;
                  } else {
                    instructionHtml += `<div class="urdu" style="direction:rtl; ${mcqPlacement==='three_papers' || mcqPlacement==='two_papers'?'font-size:12px;':''}">  درج ذیل جملوں کی تکمیل کریں ۔</div>`;
                  }
                }
                break;
              }
              default:
                console.warn("Unknown type:", type);
            }
            instructionHtml += '</div>';

            subjectiveContent += `<div class="short-questions ${isUrdu ? 'urdu' : ''}"> ${instructionHtml}`;

           // Decide how many questions per row






let rowOpen = false;

typeQuestions.forEach((pq: any, idx: number) => {
  const q = pq.questions;
  const questionMarks = pq.custom_marks || defaultMarks;

  const { eng: englishQuestionRaw, ur: urduQuestionRaw } =
    extractEnglishAndUrdu(q.question_text, q.question_text_ur);

  const englishQuestion = formatQuestionText(englishQuestionRaw || '');
  const urduQuestion = formatQuestionText(urduQuestionRaw || '');

  // ─── OPEN ROW ─────────────────────────────
  if (itemsPerRow > 1 && idx % itemsPerRow === 0) {
    subjectiveContent += `
      <div class="urdu-row"
        style="
          display:flex;
          gap:15px;
          margin-bottom:0px;
          direction:${isUrdu ? 'rtl' : 'ltr'};
          font-size:${mcqPlacement === 'three_papers' ? '10px' : '12px'};
          ${mcqPlacement === 'three_papers' ? 'letter-spacing:-0.5px;' : ''}
        ">
    `;
  }

  // ─── QUESTION ITEM ────────────────────────
  let questionItemHtml = `
    <div class="short-question-item"
      style="
        flex:1;
        width:${itemsPerRow > 1 ? `${100 / itemsPerRow}%` : '100%'};
        font-size:${mcqPlacement === 'three_papers' ? '10px' : '12px'};
        line-height:${isBilingual  ? '0.9' : '1.3'};
        ${mcqPlacement === 'three_papers' ? 'letter-spacing:-0.5px;' : ''}
      ">
  `;

  // ─── ENGLISH ONLY ─────────────────────────
  if (isEnglish) {
    questionItemHtml += `
      <div style="display:flex; align-items:flex-start;">
        <div style="width:22px; flex-shrink:0;">
          (${toRoman(idx + 1)})
        </div>
        <div style="flex:1;">
          ${englishQuestion}
          <span class="marks-display">(${questionMarks})</span>
        </div>
      </div>`;
  }

  // ─── URDU ONLY ────────────────────────────
  else if (isUrdu) {
    questionItemHtml += `
      <div class="urdu" style="display:flex; align-items:flex-start; direction:rtl;">
        <div style="width:24px; flex-shrink:0; text-align:right;">
          (${toRoman(idx + 1)})
        </div>
        <div style="flex:1; text-align:right;">
          ${urduQuestion || englishQuestion}
          <span class="marks-display">(${questionMarks})</span>
        </div>
      </div>`;
  }

  // ─── BILINGUAL ────────────────────────────
  else {
    // English
    questionItemHtml += `
      <div style="display:flex; align-items:flex-start;">
        <div style="width:22px; flex-shrink:0;">
          (${toRoman(idx + 1)})
        </div>
        <div style="flex:1;">
          ${englishQuestion}
          <span class="marks-display">(${questionMarks})</span>
        </div>
      </div>`;

    // Urdu
    if (hasActualUrduText(urduQuestion)) {
      questionItemHtml += `
        <div class="urdu" style="display:flex; align-items:flex-start; direction:rtl; margin-top:1px;">
          <div style="width:24px; flex-shrink:0; text-align:right;">
            (${toRoman(idx + 1)})
          </div>
          <div style="flex:1; text-align:right;">
            ${urduQuestion}
            <span class="marks-display">(${questionMarks})</span>
          </div>
        </div>`;
    }
  }

  questionItemHtml += `</div>`;
  subjectiveContent += questionItemHtml;

  // ─── CLOSE ROW ────────────────────────────
  if (
    itemsPerRow > 1 &&
    (idx % itemsPerRow === itemsPerRow - 1 ||
      idx === typeQuestions.length - 1)
  ) {
    subjectiveContent += `</div>`;
  }
});



            subjectiveContent += `</div>`;
          }

          partNumber++;
        }
      }
      
    } else {
      ////console.log('⏭️ No subjective questions to include in PDF');
      // If no subjective questions, still add a message or minimal content
      subjectiveContent += `
      <div style="text-align: center; padding: 40px 0; font-size: 14px; color: #666;">
        ${isEnglish || isBilingual ? '<p>No subjective questions in this paper.</p>' : ''}
        ${isUrdu || isBilingual ? '<p class="urdu" style="direction:rtl;">اس پیپر میں کوئی انشائیہ سوالات نہیں ہیں۔</p>' : ''}
      </div>
    `;
    }

    subjectiveContent += `
  
`;

    // Footer
    subjectiveContent += `
  <div class="footer no-break" style="margin-top: ${mcqPlacement==='three_papers'?'5px;':'30px;'} text-align: center; font-size: 12px; color: #666; border-top: 1px solid #ccc; padding-top: ${mcqPlacement==='three_papers'?'0px;':'5px;'}">
    <p class="english">www.examly.pk | Generate papers Save Time | Generated on ${new Date().toLocaleDateString()} by www.examly.pk </p>
  </div>
</div>
</div>
`;
    // Check if user is on trial for watermark


    if (mcqPlacement === "two_papers") {
      subjectiveContent += `<div style="display:flex; align-items:center;">
  <span style="font-size:18px; margin-right:6px;">✂</span>
  <hr style="flex:1; border-top: 2px dotted black;" />
</div>
` + subjectiveContent;
      htmlContent += subjectiveContent;
    } else if( mcqPlacement === "three_papers") {

    subjectiveContent += `<div style="display:flex; align-items:center;">
  <span style="font-size:18px; margin-right:6px;">✂</span>
  <hr style="flex:1; border-top: 2px dotted black;" />
</div>
` + subjectiveContent+`<div style="display:flex; align-items:center;">
  <span style="font-size:18px; margin-right:6px;">✂</span>
  <hr style="flex:1; border-top: 2px dotted black;" />
</div>
` + subjectiveContent;
      htmlContent += subjectiveContent;
    }
    
    
    else {
      htmlContent += subjectiveContent+`
      <div class="watermark-text-9" style="position: fixed; top: 40%; left: 25%; z-index: 0; opacity: 0.1; pointer-events: none; transform: rotate(-45deg); ">
      ${isPaidUser?`
  ${logoBase64 ? `${removeWatermark?'':`<img src="${logoBase64}" alt="Examly Logo" style="width: 400px; height: auto;" /><br/><span class="institute">${englishTitle}</span>`}` : `<span class="institute">${englishTitle}</span>`}
`:`<img src="${loadImageAsBase64('examly.png')}" alt="Examly Logo" style="width: 400px; height: auto;" /><br/>
    <div style="font-size: 16px; color: #000; text-align: center; margin-top: -25px; margin-left:60px">Trial version, get Package to set Your Water Mark.</div>
  `};</div>`;
    }
  } else {
    ////console.log('⏭️ No subjective questions and no MCQs - generating empty paper');
    // If there are no questions at all, generate minimal content
    htmlContent += `
<div class="container">
  <div class="header">
    <h1 class="eng text-center">
      ${logoBase64 ? `<img src="${logoBase64}" class="header-img" height="60" width="140"/>` : ''} <br/>
      <span class="institute">${englishTitle}</span>
    </h1>
  </div>
  <div style="text-align: center; padding: 100px 0; font-size: 16px; color: #666;">
    ${isEnglish || isBilingual ? '<p>No questions found for this paper.</p>' : ''}
    ${isUrdu || isBilingual ? '<p class="urdu" style="direction:rtl;">اس پیپر میں کوئی سوالات نہیں ہیں۔</p>' : ''}
  </div>
  <div class="footer no-break" style="margin-top: 30px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #ccc; padding-top: 5px;">
    <p class="english">Generated on ${new Date().toLocaleDateString()} | www.examly.pk | Generate papers Save Time</p>
  </div>
</div>`;
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
    ////console.log('🔄 Getting Puppeteer browser instance...');
    browser = await getPuppeteerBrowser();
    ////console.log('✅ Browser instance obtained');
    
    // Create page with retry logic
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        page = await browser.newPage();
        ////console.log('✅ New page created');
        
        // Check if page is ready
        if (!page || page.isClosed()) {
          throw new Error('Page is closed immediately after creation');
        }
        
        // Small delay to ensure page is stable
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Set reasonable timeouts
        page.setDefaultTimeout(120000);
        page.setDefaultNavigationTimeout(120000);
        
        // Optimize page for performance
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Disable unnecessary resources for faster loading (optional)
        try {
          await page.setRequestInterception(true);
          page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (resourceType === 'image' || resourceType === 'font' || resourceType === 'stylesheet') {
              req.abort();
            } else {
              req.continue();
            }
          });
        } catch (interceptionError) {
          console.warn('Request interception failed, continuing without it:', interceptionError);
        }
        
        break; // Success, exit retry loop
        
      } catch (error) {
        console.warn(`Page creation/setup failed (attempt ${retryCount + 1}/${maxRetries}):`, error);
        if (page && !page.isClosed()) {
          try {
            await page.close();
          } catch (closeError) {
            console.warn('Error closing failed page:', closeError);
          }
        }
        page = null;
        retryCount++;
        
        if (retryCount >= maxRetries) {
          throw new Error(`Failed to create and setup page after ${maxRetries} attempts: ${error}`);
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    ////console.log('🔄 Setting HTML content...');
    
    // Check if page is still valid
    if (!page || page.isClosed()) {
      throw new Error('Page became invalid before setting content');
    }
    
    // Use setContent with simpler wait conditions
    await page.setContent(htmlContent, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    ////console.log('✅ HTML content set, waiting for fonts...');
    
    // Wait for fonts to load with timeout
    await Promise.race([
      page.evaluate(() => document.fonts.ready),
      new Promise(resolve => setTimeout(resolve, 10000))
    ]);

    ////console.log('✅ Fonts loaded, generating PDF...');
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
      preferCSSPageSize: true,
      timeout: 60000
    });

    ////console.log('✅ PDF generated successfully');
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

// Fallback PDF generation for development when Puppeteer fails
async function createFallbackPDF(htmlContent: string, title: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });

      // Add content to PDF
      doc.fontSize(20).text(title, { align: 'center' });
      doc.moveDown();
      
      doc.fontSize(14).text('Generated by Examly', { align: 'center' });
      doc.moveDown();
      
      doc.fontSize(12).fillColor('red').text('⚠️ DEVELOPMENT MODE: PDF generation failed. This is a fallback version.', { align: 'center' });
      doc.moveDown();
      
      doc.fillColor('black').fontSize(10);
      doc.text('The paper content could not be rendered properly due to PDF generation issues.');
      doc.moveDown();
      doc.text('Please check the server logs for more details.');
      doc.moveDown();
      doc.text(`HTML Content Length: ${htmlContent.length} characters`);
      doc.moveDown();
      doc.text('Paper generation completed with fallback PDF.');

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

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
      ////console.log(`✅ RPC returned ${rpcData.length} ${qtype} questions`);
      return rpcData;
    }
    if (rpcError) {
      console.warn('RPC get_random_questions returned error:', rpcError);
    } else {
      ////console.log('RPC returned no rows, falling back to DB query');
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
      ////console.log('Fallback DB query returned no rows');
      return null;
    }

    ////console.log(`✅ Fallback DB returned ${rows.length} ${qtype} questions`);
    return rows;
  } catch (err) {
    console.warn('tryRpcRandomQuestions failed:', err);
    return null;
  }
}

// Main POST function
export async function POST(request: Request) {
  ////console.log('📄 POST request received to generate paper');
  
  const startTime = Date.now();
  let paper: any;

  try {
    // Use the enhanced token extraction
    const token = extractToken(request);
    ////console.log('🔐 Token present:', token ? `${token.slice(0,6)}...${token.slice(-6)}` : 'none');
    if (!token) {
      console.warn('No authorization token found in headers or cookies');
      return NextResponse.json({ error: 'Authorization token required' }, { status: 401 });
    }

    ////console.log('🔐 Token found, verifying user...');

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

    ////console.log(`👤 User ${user.id} authenticated successfully`);
    ////console.log(`🔐 User auth method: ${user.app_metadata?.provider || 'email'}`);

    // Fetch user's profile logo before processing the request
    ////console.log('🔄 Fetching user profile logo...');
    const logoBase64 = await getUserLogoBase64(user.id);
    ////console.log('✅ User logo processed');

    const requestData: PaperGenerationRequest = await request.json();
    /*/console.log('📋 Request data received:', {
      title: requestData.title,
      subjectId: requestData.subjectId,
      classId: requestData.classId,
      chapterOption: requestData.chapterOption,
      selectionMethod: requestData.selectionMethod,
      randomSeed: requestData.randomSeed,
      paperType: requestData.paperType,
      isBoardPaper: requestData.paperType === 'model',
      hasReorderedQuestions: !!requestData.reorderedQuestions,
      hasCustomMarksData: !!requestData.customMarksData,
      hasToAttemptValues: !!requestData.toAttemptValues,
      // Log time values
      timeMinutes: requestData.timeMinutes,
      mcqTimeMinutes: requestData.mcqTimeMinutes,
      subjectiveTimeMinutes: requestData.subjectiveTimeMinutes,
      mcqPlacement: requestData.mcqPlacement,
      // Log additional Urdu/English question types
      poetry_explanationCount: requestData.poetry_explanationCount,
      prose_explanationCount: requestData.prose_explanationCount,
      passageCount: requestData.passageCount,
      sentence_correctionCount: requestData.sentence_correctionCount,
      sentence_completionCount: requestData.sentence_completionCount,
      translate_urduCount: requestData.translate_urduCount,
      translate_englishCount: requestData.translate_englishCount,
      idiom_phrasesCount: requestData.idiom_phrasesCount,
      activePassiveCount: requestData.activePassiveCount,
      directInDirectCount: requestData.directInDirectCount
    });
*/
    const { 
      title,
      subjectId,
      classId
    } = requestData;

    // Validation
    if (!title || !subjectId || !classId) {
      return NextResponse.json(
        { error: 'Complete your Profile to generate a paper!' },
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
      shuffleQuestions = true,
      
      // Additional Urdu/English question types
      poetry_explanationCount = 0,
      prose_explanationCount = 0,
      passageCount = 0,
      sentence_correctionCount = 0,
      sentence_completionCount = 0,
      translate_urduCount = 0,
      translate_englishCount = 0,
      idiom_phrasesCount = 0,
      activePassiveCount = 0,
      directInDirectCount = 0,
      
      // Additional Urdu/English difficulties
      poetry_explanationDifficulty = 'any',
      prose_explanationDifficulty = 'any',
      passageDifficulty = 'any',
      sentence_correctionDifficulty = 'any',
      sentence_completionDifficulty = 'any',
      translate_urduDifficulty = 'any',
      translate_englishDifficulty = 'any',
      idiom_phrasesDifficulty = 'any',
      activePassiveDifficulty = 'any',
      directInDirectDifficulty = 'any'
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
      ////console.log(`📚 Full book chapters found: ${chapterIds.length}`);
    } else if ((chapterOption === 'custom' || chapterOption === 'single_chapter') && selectedChapters && selectedChapters.length > 0) {
      // Handle both custom (multi) and single_chapter (single id in array)
      chapterIds = selectedChapters;
      ////console.log(`🎯 Chapters selected (${chapterOption}): ${chapterIds.length}`);
    }

    ////console.log(`🎯 Final chapter IDs to use: ${chapterIds.length}`);

    // FIXED: Manual selection with proper question verification AND reordering
    if (selectionMethod === 'manual' && selectedQuestions) {
      ////console.log('🔧 Using manual question selection');

      // NEW: Check if we have reordered questions from the frontend
      if (reorderedQuestions) {
        ////console.log('🔄 Using reordered questions from preview');
        
        let orderNumber = 1;
        
        // Process questions in the exact order from preview
        Object.keys(reorderedQuestions).forEach(type => {
          const questions = reorderedQuestions[type] || [];
          
          // FIX: Skip empty question types
          if (questions.length === 0) {
            ////console.log(`⏭️ Skipping ${type} questions (0 questions provided)`);
            return;
          }
          
          ////console.log(`🔍 Processing ${questions.length} reordered ${type} questions`);
          
          for (const question of questions) {
            questionInserts.push({
              paper_id: paper.id,
              question_id: question.id,
              order_number: orderNumber++,
              question_type: type
            });
          }
          
          ////console.log(`✅ Added ${questions.length} reordered ${type} questions`);
        });
      } else {
        // Fallback to original manual selection logic
        ////console.log('📝 Using original manual selection (no reordering data)');
        
        const questionTypes = Object.keys(selectedQuestions).map(type => ({
          type: type as QuestionType,
          questions: selectedQuestions[type] || []
        }));

        let orderNumber = 1;
        
        for (const qType of questionTypes) {
          const qList = Array.isArray(qType.questions) ? qType.questions : [];
          
          // FIX: Skip if no questions of this type
          if (qList.length === 0) {
            ////console.log(`⏭️ Skipping ${qType.type} questions (0 questions provided)`);
            continue;
          }
          
          ////console.log(`🔍 Verifying ${qList.length} manually selected ${qType.type} questions`);
          
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

          ////console.log(`✅ Found ${existingQuestions.length} valid ${qType.type} questions`);

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

          ////console.log(`✅ Added ${existingQuestions.length} manually selected ${qType.type} questions`);
        }
      }
    } else {
      // Auto selection logic - FIXED to include Urdu/English question types
      ////console.log('🤖 Using auto question selection');
      
      // Define all question types including Urdu/English specific ones
      const questionTypes = [
        { type: 'mcq' as const, count: mcqCount, difficulty: mcqDifficulty },
        { type: 'short' as const, count: shortCount, difficulty: shortDifficulty },
        { type: 'long' as const, count: longCount, difficulty: longDifficulty },
        // Urdu specific types
        { type: 'poetry_explanation' as const, count: poetry_explanationCount, difficulty: poetry_explanationDifficulty },
        { type: 'prose_explanation' as const, count: prose_explanationCount, difficulty: prose_explanationDifficulty },
        { type: 'passage' as const, count: passageCount, difficulty: passageDifficulty },
        { type: 'sentence_correction' as const, count: sentence_correctionCount, difficulty: sentence_correctionDifficulty },
        { type: 'sentence_completion' as const, count: sentence_completionCount, difficulty: sentence_completionDifficulty },
        // English specific types
        { type: 'translate_urdu' as const, count: translate_urduCount, difficulty: translate_urduDifficulty },
        { type: 'translate_english' as const, count: translate_englishCount, difficulty: translate_englishDifficulty },
        { type: 'idiom_phrases' as const, count: idiom_phrasesCount, difficulty: idiom_phrasesDifficulty },
        { type: 'activePassive' as const, count: activePassiveCount, difficulty: activePassiveDifficulty },
        { type: 'directInDirect' as const, count: directInDirectCount, difficulty: directInDirectDifficulty }
      ];

      let orderNumber = 1;

      for (const qType of questionTypes) {
        // FIX: Only process if count > 0
        if (qType.count > 0) {
          ////console.log(`🔍 Finding ${qType.count} ${qType.type} questions...`);
          
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
            ////console.log(`✅ Added ${questions.length} ${qType.type} questions`);
          } else {
            console.warn(`⚠️ No ${qType.type} questions found`);
          }
        } else {
          ////console.log(`⏭️ Skipping ${qType.type} questions (count is 0)`);
        }
      }
    }

    // Get MCQ questions for key generation
    const mcqQuestions = [];
    if (mcqCount > 0) {
      ////console.log(`🔍 Finding ${mcqCount} MCQ questions for key generation...`);

      const mcqResults = await findQuestionsWithFallback(
        'mcq',
        subjectId,
        classId,
        chapterIds,
        source_type,
        mcqDifficulty,
        mcqCount,
        randomSeed
      );

      if (mcqResults && mcqResults.length > 0) {
        mcqResults.forEach((question, index) => {
          mcqQuestions.push({
            order_number: index + 1,
            question_type: 'mcq',
            question_id: question.id,
            questions: question
          });
        });
        ////console.log(`✅ Found ${mcqQuestions.length} MCQ questions for key generation`);
      } else {
        console.warn(`⚠️ No MCQ questions found for key generation`);
      }
    }

    // Generate PDF
    ////console.log('🔄 Generating HTML content...');
    const htmlContent = await generatePaperHTML(paper, user.id, requestData, logoBase64);

    ////console.log('🔄 Creating PDF from HTML...');

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await generatePDFFromHTML(htmlContent);
    } catch (pdfError) {
      console.error('❌ PDF generation failed:', pdfError);

      // Fallback for development: create a simple PDF
      if (process.env.NODE_ENV === 'development') {
        ////console.log('🔄 Using fallback PDF generation for development...');
        pdfBuffer = await createFallbackPDF(htmlContent, paper.title || 'Paper');
        ////console.log('✅ Fallback PDF generated successfully');
      } else {
        throw pdfError;
      }
    }

    // Check if user is non-trial (paid user) and save PDF to storage
    const isPaidUser = await checkUserSubscription(user.id);
    let pdfPath: string | null = null;
    let keyPath: string | null = null;

    if (isPaidUser) {
      try {
        ////console.log('💾 Saving PDF to storage for paid user...');
        pdfPath = await saveUserPDF(user.id, pdfBuffer, paper.title || 'Paper');
        ////console.log('✅ PDF saved to storage successfully');
      } catch (storageErr) {
        console.warn('Failed to save PDF to storage:', storageErr);
        // Don't fail the request if storage fails
      }

      // Generate and save MCQ key if there are MCQ questions
      if (mcqQuestions.length > 0) {
        try {
          ////console.log('🔑 Generating MCQ key for paid user...');
          keyPath = await generateAndSaveMCQKey(user.id, paper.id, mcqQuestions, requestData.subjectId, requestData.classId);
          ////console.log('✅ MCQ key saved to storage successfully');
        } catch (keyErr) {
          console.warn('Failed to generate and save MCQ key:', keyErr);
          // Don't fail the request if key generation fails
        }
      }
    }

    // Update paper record with PDF and key URLs
    if (pdfPath || keyPath) {
      try {
        const updateData: any = {};
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        ////console.log('Supabase URL:', supabaseUrl);
        if (pdfPath) updateData.paperPdf = `${supabaseUrl}/storage/v1/object/public/generated-papers/${pdfPath}`;
        if (keyPath) updateData.paperKey = `${supabaseUrl}/storage/v1/object/public/key/${keyPath}`;

        ////console.log('Updating paper with:', updateData);

        const { error } = await supabaseAdmin
          .from('papers')
          .update(updateData)
          .eq('id', paper.id);
        if (error) {
          console.error('Update error:', error);
        } else {
          ////console.log('✅ Updated paper record with PDF and key URLs');
        }
      } catch (updateErr) {
        console.warn('Failed to update paper with PDF/key URLs:', updateErr);
      }
    }

    // Increment user's papers_generated counter (best-effort)
    try {
      await incrementPapersGenerated(user.id);
    } catch (incErr) {
      console.warn('Failed to increment papers generated count:', incErr);
    }

    ////console.log(`✅ Paper generation completed successfully in ${Date.now() - startTime}ms`);

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
        ////console.log('✅ Cleaned up paper record after error');
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
    ////console.log(`⏱️ Total request time: ${Date.now() - startTime}ms`);
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