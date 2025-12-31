/** app/api/papers/[paperId]/download/route.ts */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { translate } from '@vitalets/google-translate-api';
import type { Browser, Page } from 'puppeteer-core';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import PDFDocument from 'pdfkit';
import type { PaperGenerationRequest } from '@/types/types';

// --- Reused Optimizations ---

// 1. Puppeteer browser instance singleton with improved lifecycle management
let browserPromise: Promise<Browser> | null = null;
let browserCleanupInterval: NodeJS.Timeout | null = null;

async function getPuppeteerBrowser() {
  // Clear any stale promise if browser disconnected
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
    console.log('🚀 Launching Puppeteer browser for download...');

    try {
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
          '--disable-composited-antialiasing',
          '--disable-accelerated-2d-canvas',
          '--disable-canvas-aa',
          '--disable-3d-apis',
          '--disable-webrtc',
          '--disable-breakpad',
          '--disable-component-update',
          '--disable-device-discovery-notifications',
          '--disable-logging',
          '--disable-notifications',
          '--disable-offer-store-unmasked-wallet-cards',
          '--disable-offer-upload-credit-cards',
          '--disable-save-password-bubble',
          '--disable-speech-api',
          '--disable-threaded-animation',
          '--disable-threaded-scrolling',
          '--disable-translate-new-ux',
          '--disable-webgl',
          '--enable-aggressive-domstorage-flushing',
          '--enable-simple-cache-backend',
          '--max_old_space_size=4096',
          '--js-flags=--max-old-space-size=4096'
        ],
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
        timeout: 90000, // Increased timeout
        protocolTimeout: 120000, // Increased protocol timeout
      };

      if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
        console.log('🔧 Configuring Chromium for production...');
        launchOptions.executablePath = await chromium.executablePath();
        launchOptions.defaultViewport = chromium.defaultViewport;
      } else {
        console.log('🔧 Configuring for development...');
        const chromePath = getChromePath();
        if (chromePath) {
          launchOptions.executablePath = chromePath;
          launchOptions.headless = 'new'; // Use new headless mode
        } else {
          console.warn('⚠️ Chrome not found, trying default...');
        }
      }

      const browser = await puppeteer.launch(launchOptions);
      console.log('✅ Browser launched successfully');
      
      // Setup cleanup interval
      if (!browserCleanupInterval) {
        browserCleanupInterval = setInterval(async () => {
          try {
            const pages = await browser.pages();
            if (pages.length > 0) {
              console.log(`🧹 Cleaning up ${pages.length} unused pages`);
              for (const page of pages.slice(1)) { // Keep first page
                try {
                  await page.close();
                } catch (e) {
                  console.warn('Error closing page during cleanup:', e);
                }
              }
            }
          } catch (e) {
            console.warn('Browser cleanup check failed:', e);
          }
        }, 30000); // Every 30 seconds
      }
      
      browser.on('disconnected', () => {
        console.log('🔌 Browser disconnected, clearing instance');
        browserPromise = null;
        if (browserCleanupInterval) {
          clearInterval(browserCleanupInterval);
          browserCleanupInterval = null;
        }
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

function getChromePath() {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    return null;
  }

  const platform = process.platform;
  let paths: string[] = [];

  if (platform === 'win32') {
    paths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
      process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
      process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
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
    if (p && existsSync(p)) {
      console.log(`✅ Found Chrome at: ${p}`);
      return p;
    }
  }

  console.warn('⚠️ Chrome not found at any standard location');
  return null;
}

// 2. Font cache
const fontCache = new Map<string, string>();

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

// 3. Translation cache
const translationCache = new Map<string, string>();

// Helper functions
function formatQuestionText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

function simplifyHtmlContent(html: string): string {
  return html
    .replace(/\s+/g, ' ')
    .replace(/<!--.*?-->/g, '')
    .trim();
}

function hasActualUrduText(text: string | null): boolean {
  if (!text) return false;
  const urduRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return urduRegex.test(text);
}

function extractEnglishAndUrdu(field: string | null | undefined, fieldUr?: string | null | undefined) {
  const raw = (field || '').toString();
  const urFromSeparate = (fieldUr || '').toString().trim();
  const hasUrInRaw = hasActualUrduText(raw);
  const hasUrInSeparate = hasActualUrduText(urFromSeparate);

  if (hasUrInSeparate) {
    return { eng: raw.trim(), ur: urFromSeparate.trim() };
  }

  if (hasUrInRaw) {
    const parenMatch = raw.match(/^(.*?)[\r\n]*\(?\s*([\u0600-\u06FF\0-\uFFFF].+?)\)?\s*$/s);
    if (parenMatch && parenMatch[1] && parenMatch[2]) {
      return { eng: parenMatch[1].trim(), ur: parenMatch[2].trim() };
    }
    return { eng: '', ur: raw.trim() };
  }

  return { eng: raw.trim(), ur: '' };
}

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

function toRoman(num: number): string {
  const romans = ['i','ii','iii','iv','v','vi','vii','viii','ix','x','xi','xii','xiii','xiv','xv','xvi','xvii','xviii'];
  return romans[num - 1] || num.toString();
}

function formatTimeForDisplay(minutes: number, lang: string = 'eng'): string {
  if (!minutes || minutes <= 0) {
    if(lang === 'urdu' || lang === 'ur'){
      return '0 منٹ';
    } else {
      return '0 minutes';
    }
  }
  
  if (minutes < 60) {
    if(lang === 'urdu' || lang === 'ur'){
      return `${minutes} منٹ`;
    } else {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    if(lang === 'urdu' || lang === 'ur'){
      return `${hours} گھنٹے`;
    } else {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
  }
  
  const formattedMinutes = remainingMinutes.toString().padStart(2, '0');
  if(lang === 'urdu' || lang === 'ur'){
    return `${hours}:${formattedMinutes} گھنٹے`;
  } else {
    return `${hours}:${formattedMinutes} hour${hours !== 1 ? 's' : ''}`;
  }
}

// Token extraction
function extractToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (authHeader) {
    const m = authHeader.match(/Bearer\s+(.+)/i);
    if (m && m[1]) return m[1];
  }

  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  const cookiePairs = cookieHeader.split(';').map(c => c.trim());
  const candidates = ['sb-access-token', 'supabase-auth-token', 'sb:token', 'sb-session', 'sb-token'];

  for (const pair of cookiePairs) {
    const [name, ...rest] = pair.split('=');
    const value = rest.join('=');
    if (!name || !value) continue;

    const key = name.trim();
    if (!candidates.includes(key)) continue;

    let decoded = value;
    try { decoded = decodeURIComponent(value); } catch (e) { /* ignore */ }

    if (decoded.startsWith('{') || decoded.startsWith('%7B')) {
      try {
        const parsed = JSON.parse(decoded);
        if (parsed?.access_token) return parsed.access_token;
        if (parsed?.token) return parsed.token;
        if (parsed?.currentSession?.access_token) return parsed.currentSession.access_token;
        if (parsed?.persistedSession?.access_token) return parsed.persistedSession.access_token;
      } catch (e) {}
    }

    const bearer = decoded.match(/Bearer\s+(.+)/i);
    if (bearer && bearer[1]) return bearer[1];

    if (decoded.split('.').length === 3) return decoded;
  }

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

// Fetch user logo
async function getUserLogoBase64(userId: string): Promise<string> {
  try {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('logo')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.logo) {
      console.log('⚠️ No user logo found, using default logo');
      return loadImageAsBase64('examly.jpg');
    }

    const logoUrl = profile.logo;
    
    if (logoUrl.startsWith('data:image/')) {
      return logoUrl;
    }
    
    try {
      console.log('🔄 Fetching user logo from URL:', logoUrl);
      const response = await fetch(logoUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch logo: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
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
      return loadImageAsBase64('examly.jpg');
    }
    
  } catch (error) {
    console.error('❌ Error getting user logo:', error);
    return loadImageAsBase64('examly.jpg');
  }
}

// Check user subscription
async function checkUserSubscription(userId: string): Promise<boolean> {
  try {
    const now = new Date().toISOString();

    const { data: subscription, error } = await supabaseAdmin
      .from('user_packages')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('is_trial', false)
      .gt('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('Subscription check error:', error);
      return false;
    }

    return !!subscription;
  } catch (err) {
    console.warn('Error checking subscription:', err);
    return false;
  }
}

// PDF Generation with improved error handling
async function generatePDFFromHTML(htmlContent: string): Promise<Buffer> {
  let browser: Browser | null = null;
  let page: Page | null = null;
  
  const maxRetries = 3;
  let retryCount = 0;
  let lastError: Error | null = null;

  while (retryCount < maxRetries) {
    try {
      console.log(`🔄 Getting Puppeteer browser instance (attempt ${retryCount + 1}/${maxRetries})...`);
      browser = await getPuppeteerBrowser();
      console.log('✅ Browser instance obtained');

      page = await browser.newPage();
      console.log('✅ New page created');

      // Set reasonable timeouts
      page.setDefaultTimeout(60000);
      page.setDefaultNavigationTimeout(60000);

      console.log('🔄 Setting HTML content...');
      
      // Use data URL approach which is more stable than setContent
      const dataUrl = `data:text/html;charset=UTF-8,${encodeURIComponent(htmlContent)}`;
      await page.goto(dataUrl, {
        waitUntil: 'networkidle0',
        timeout: 60000
      });

      console.log('✅ HTML content set, waiting for fonts...');
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
      lastError = error as Error;
      console.error(`❌ PDF generation attempt ${retryCount + 1} failed:`, error);
      
      // Clean up failed page
      if (page && !page.isClosed()) {
        try {
          await page.close();
        } catch (e) {
          console.warn('Error closing failed page:', e);
        }
      }
      
      retryCount++;
      
      if (retryCount < maxRetries) {
        console.log(`🔄 Retrying PDF generation (${retryCount}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
      }
    } finally {
      // Only close page on success or final failure
      if (page && !page.isClosed() && retryCount === maxRetries) {
        try {
          await page.close();
        } catch (e) {
          console.warn('Error closing page in finally:', e);
        }
      }
    }
  }

  throw new Error(`Failed to generate PDF after ${maxRetries} attempts: ${lastError?.message}`);
}

// Improved fallback PDF generation
async function createFallbackPDF(htmlContent: string, title: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      console.log('🔄 Creating fallback PDF...');
      
      // Create a simple PDF without requiring external fonts
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 20, bottom: 20, left: 20, right: 20 }
      });
      
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        console.log('✅ Fallback PDF created');
        resolve(pdfBuffer);
      });

      // Add content
      doc.fontSize(20).text(title, { align: 'center' });
      doc.moveDown();
      
      doc.fontSize(12).text('Paper generated by Examly', { align: 'center' });
      doc.moveDown();
      
      doc.fontSize(10).fillColor('red')
        .text('⚠️ IMPORTANT NOTICE', { align: 'center' });
      doc.moveDown();
      
      doc.fillColor('black').fontSize(10);
      doc.text('This paper was generated in fallback mode due to PDF generation issues.');
      doc.moveDown();
      doc.text('For the full formatted paper with proper layout and styling,');
      doc.moveDown();
      doc.text('please try downloading again or contact support if the issue persists.');
      doc.moveDown(2);
      
      doc.fontSize(10).text(`Paper Details:`, { underline: true });
      doc.moveDown();
      doc.text(`• Generated on: ${new Date().toLocaleString()}`);
      doc.text(`• Content length: ${htmlContent.length} characters`);
      doc.text(`• Fallback mode: Simple text-only format`);
      
      doc.moveDown(3);
      doc.fontSize(8).text('Generated by Examly - www.examly.pk', { align: 'center' });

      doc.end();
    } catch (error) {
      console.error('❌ Fallback PDF creation failed:', error);
      reject(error);
    }
  });
}

// Generate Paper HTML for existing paper
async function generatePaperHTMLForExistingPaper(
  paper: any,
  userId: string,
  logoBase64: string,
  paperQuestions: any[],
  subject: string,
  subject_ur: string,
  paperClass: string
): Promise<string> {
  const {
    language = 'bilingual',
    mcq_marks: mcqMarks = 1,
    short_marks: shortMarks = 2,
    long_marks: longMarks = 5,
    mcq_placement: mcqPlacement = 'separate',
    time_minutes: timeMinutes = 60,
    paper_type: paperType = 'custom',
    
    // Additional marks
    poetry_explanation_marks: poetry_explanationMarks = 2,
    prose_explanation_marks: prose_explanationMarks = 5,
    passage_marks: passageMarks = 10,
    sentence_correction_marks: sentence_correctionMarks = 1,
    sentence_completion_marks: sentence_completionMarks = 1,
    translate_urdu_marks: translate_urduMarks = 4,
    translate_english_marks: translate_englishMarks = 5,
    idiom_phrases_marks: idiom_phrasesMarks = 1,
    activePassive_marks: activePassiveMarks = 1,
    directInDirect_marks: directInDirectMarks = 1
  } = paper;

  console.log('📋 Generating HTML for existing paper:', {
    title: paper.title,
    language,
    mcqPlacement,
    totalQuestions: paperQuestions.length
  });

  // Organize questions by type
  const questionsByType: Record<string, any[]> = {};
  paperQuestions.forEach((pq: any) => {
    const type = pq.question_type;
    if (!questionsByType[type]) {
      questionsByType[type] = [];
    }
    
    // Determine marks based on type
    let marks = mcqMarks;
    if (type === 'short') marks = shortMarks;
    else if (type === 'long') marks = longMarks;
    else if (type === 'poetry_explanation') marks = poetry_explanationMarks;
    else if (type === 'prose_explanation') marks = prose_explanationMarks;
    else if (type === 'passage') marks = passageMarks;
    else if (type === 'sentence_correction') marks = sentence_correctionMarks;
    else if (type === 'sentence_completion') marks = sentence_completionMarks;
    else if (type === 'translate_urdu') marks = translate_urduMarks;
    else if (type === 'translate_english') marks = translate_englishMarks;
    else if (type === 'idiom_phrases') marks = idiom_phrasesMarks;
    else if (type === 'activePassive') marks = activePassiveMarks;
    else if (type === 'directInDirect') marks = directInDirectMarks;
    
    questionsByType[type].push({
      ...pq.questions,
      order_number: pq.order_number,
      question_type: type,
      marks
    });
  });

  // Sort questions by order_number
  Object.keys(questionsByType).forEach(type => {
    questionsByType[type].sort((a, b) => a.order_number - b.order_number);
  });

  // Create toAttemptValues from paper
  const toAttemptValues: Record<string, number> = {
    mcq: paper.mcq_to_attempt || 0,
    short: paper.short_to_attempt || 0,
    long: paper.long_to_attempt || 0,
    poetry_explanation: paper.poetry_explanation_to_attempt || 0,
    prose_explanation: paper.prose_explanation_to_attempt || 0,
    passage: paper.passage_to_attempt || 0,
    sentence_correction: paper.sentence_correction_to_attempt || 0,
    sentence_completion: paper.sentence_completion_to_attempt || 0,
    translate_urdu: paper.translate_urdu_to_attempt || 0,
    translate_english: paper.translate_english_to_attempt || 0,
    idiom_phrases: paper.idiom_phrases_to_attempt || 0,
    activePassive: paper.activePassive_to_attempt || 0,
    directInDirect: paper.directInDirect_to_attempt || 0
  };

  // Reconstruct requestData
  const requestData: PaperGenerationRequest = {
    title: paper.title,
    subjectId: paper.subject_id,
    classId: paper.class_id,
    language,
    paperType,
    timeMinutes,
    mcqMarks,
    shortMarks,
    longMarks,
    mcqPlacement,
    toAttemptValues,
    
    // Marks for additional types
    poetry_explanationMarks,
    prose_explanationMarks,
    passageMarks,
    sentence_correctionMarks,
    sentence_completionMarks,
    translate_urduMarks,
    translate_englishMarks,
    idiom_phrasesMarks,
    activePassiveMarks,
    directInDirectMarks,
    
    // Pass the organized questions
    reorderedQuestions: questionsByType
  };

  // Load fonts
  const jameelNooriBase64 = loadFontAsBase64('JameelNooriNastaleeqKasheeda.ttf');
  const notoNastaliqBase64 = loadFontAsBase64('NotoNastaliqUrdu-Regular.ttf');
  const algerianBase64 = loadFontAsBase64('Algerian Regular.ttf');

  // Determine time values
  const getTimeValues = () => {
    const placement = mcqPlacement || 'separate';
    
    if (placement === 'separate') {
      return {
        mcqTime: 15,
        subjectiveTime: 45
      };
    } else {
      return {
        mcqTime: timeMinutes || 60,
        subjectiveTime: timeMinutes || 60
      };
    }
  };

  const timeValues = getTimeValues();
  const isUrdu = language === 'urdu';
  const isBilingual = language === 'bilingual';
  const isEnglish = language === 'english';
  const separateMCQ = mcqPlacement === 'separate';
  const englishTitle = `${paper.title}`;
  const urduTitle = paper.title;
  const isBoardPaper = paperType === 'model';
  const isPaidUser = await checkUserSubscription(userId);

  // Format time displays
  const mcqTimeDisplayEng = formatTimeForDisplay(timeValues.mcqTime, 'eng');
  const subjectiveTimeDisplayEng = formatTimeForDisplay(timeValues.subjectiveTime, 'eng');
  const mcqTimeDisplayUrdu = formatTimeForDisplay(timeValues.mcqTime, 'urdu');
  const subjectiveTimeDisplayUrdu = formatTimeForDisplay(timeValues.subjectiveTime, 'urdu');

  // Separate MCQ and subjective questions
  const mcqQuestions = questionsByType['mcq'] || [];
  const subjectiveQuestions = Object.entries(questionsByType)
    .filter(([type]) => type !== 'mcq')
    .flatMap(([_, questions]) => questions);

  // Get counts for each type
  const shortQuestions = questionsByType['short'] || [];
  const longQuestions = questionsByType['long'] || [];
  const poetryExplanationQuestions = questionsByType['poetry_explanation'] || [];
  const proseExplanationQuestions = questionsByType['prose_explanation'] || [];
  const passageQuestions = questionsByType['passage'] || [];
  const sentenceCorrectionQuestions = questionsByType['sentence_correction'] || [];
  const sentenceCompletionQuestions = questionsByType['sentence_completion'] || [];
  const translateUrduQuestions = questionsByType['translate_urdu'] || [];
  const translateEnglishQuestions = questionsByType['translate_english'] || [];
  const idiomPhrasesQuestions = questionsByType['idiom_phrases'] || [];
  const activePassiveQuestions = questionsByType['activePassive'] || [];
  const directInDirectQuestions = questionsByType['directInDirect'] || [];

  // Calculate section marks
  const calculateSectionMarks = (type: string, questions: any[], toAttempt: number): number => {
    const attempted = questions.slice(0, toAttempt);
    return attempted.reduce((sum, q) => sum + (q.marks || 0), 0);
  };

  const mcqSectionMarks = calculateSectionMarks('mcq', mcqQuestions, toAttemptValues.mcq || mcqQuestions.length);
  const subjectiveSectionMarks = paper.total_marks - mcqSectionMarks;

  // Build HTML
  let htmlContent = `
<!DOCTYPE html>
<html lang="${isUrdu ? 'ur' : 'en'}">
<head>
  <meta charset="UTF-8">
  <title>${isUrdu ? subject_ur : subject}</title>
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
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Times New Roman, sans-serif; padding: 0px; }
    .container { max-width: 900px; margin: 0 auto; background: white; padding: 0; }
    .header { text-align: center; font-size: 13px; }
    .header h1 { font-size: 14px; }
    .header h2 { font-size: 12px; }
    .institute { font-family: algerian; }
    .urdu { font-family: "Jameel Noori Nastaleeq", "Noto Nastaliq Urdu", serif; direction: rtl; }
    .eng { font-family: "Times New Roman", serif; direction: ltr; white-space: pre-line; }
    .options .urdu { font-family: "Jameel Noori Nastaleeq", "Noto Nastaliq Urdu"; direction: rtl; }
    .options .eng { font-family: "Times New Roman", serif; direction: ltr; }
    .meta { display: flex; justify-content: space-between; margin: 0 0; font-size: 12px; font-weight: bold; }
    .metaUrdu, .metaEng {
      display: inline-block;
      vertical-align: middle;
      line-height: 1.5;
      position: relative;
      font-size: 12px;
    }
    .metaUrdu {
      top: -0.7px;
      direction: rtl;
      font-family: 'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif;
    }
    .metaEng {
      top: 0;
      direction: ltr;
      font-family: 'Noto Sans', Arial, sans-serif;
    }
    .note { padding: 0px; margin: 0 0; font-size: 12px; line-height: 1.1; }
    table { width: 100%; border-collapse: collapse; margin: 4px 0; font-size: 10px; ${isEnglish && mcqPlacement !== 'three_papers' ? 'direction: ltr' : 'direction: rtl'}; }
    table, th, td { border: 1px solid #000; }
    td { padding: ${mcqPlacement === 'two_papers' || mcqPlacement === 'three_papers' ? '2px' : '4px'}; vertical-align: top; }
    hr { color: black; }
    .qnum { width: 20px; text-align: center; font-weight: bold; }
    .question { display: flex; justify-content: space-between; align-items: center; margin: 0 0; font-size: ${mcqPlacement === 'two_papers' || mcqPlacement === 'three_papers' ? '10px' : '12px'}; }
    ol li { font-size: 9px; }
    .student-info { margin-top: 10px; margin-bottom: 10px; display: flex; justify-content: space-between; flex-direction: ${isEnglish ? 'row-reverse' : 'row'}; }
    .options { margin-top: ${mcqPlacement === 'two_papers' || mcqPlacement === 'three_papers' ? '0px' : '2px'}; display: flex; justify-content: space-between; font-size: ${mcqPlacement === 'two_papers' || mcqPlacement === 'three_papers' ? '10px' : '12px'}; }
    .footer { text-align: left; margin-top: 10px; font-size: 10px; page-break-inside: avoid; break-inside: avoid; -webkit-column-break-inside: avoid; -webkit-region-break-inside: avoid; }
    .no-break { page-break-inside: avoid; break-inside: avoid; -webkit-column-break-inside: avoid; -webkit-region-break-inside: avoid; }
    .marks-display { color: #5a5a5a; font-weight: bold; margin-left: 2px; font-size: 10px; }
    .urdu .marks-display { margin-left: 0; margin-right: 2px; }
  </style>
</head>
<body>`;

  // Generate MCQ section if there are MCQ questions
  if (mcqQuestions.length > 0) {
    htmlContent += `
<div class="container" ${mcqPlacement === 'two_papers' ? 'style="height:525px; overflow:hidden"' : mcqPlacement === 'three_papers' ? 'style="height:345px; overflow:hidden"' : ''}>
  <div class="header">
    ${mcqPlacement === 'three_papers' ? `
      <h1 class="eng text-center">
        ${logoBase64 ? `<img src="${logoBase64}" class="header-img" height="30" width="70"/>` : ''}<br/>
        <span class="institute" style="font-size:12px; margin-top:-15px !important">${englishTitle}</span>
      </h1>
    ` : `
      <h1 class="eng text-center">
        ${logoBase64 ? `<img src="${logoBase64}" class="header-img" height="60" width="140"/>` : ''}<br/>
        <span class="institute">${englishTitle}</span>
      </h1>
    `}
  </div>
  
  <!-- Student Info Table -->
  <table style="width:100%; border-collapse:collapse; border:none !important; font-family:'Noto Nastaliq Urdu','Jameel Noori Nastaleeq','Noto Sans',Arial,sans-serif;">
    <!-- Row 1 -->
    <tr style="border:none !important; display:flex; justify-content:space-between; align-items:center;">
      <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1.5;">
        ${isUrdu || isBilingual || mcqPlacement === "three_papers" ? `<span class="metaUrdu">نام طالبعلم:۔۔۔۔۔۔۔۔۔۔</span>` : ''}
        ${mcqPlacement === "three_papers" ? `<span class="metaUrdu">رول نمبر:۔۔۔۔۔۔</span>` : isEnglish || isBilingual ? `<span class="metaEng">Student Name:_________</span>` : ''}
      </td>
      <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1;">
        ${mcqPlacement === "three_papers" ? `<span class="metaUrdu">مضمون: ${subject_ur}(${paperClass} کلاس)</span> <span class="metaUrdu">کل نمبر: ${subjectiveSectionMarks}</span>` : `
          ${isUrdu || isBilingual ? `<span class="metaUrdu">رول نمبر:۔۔۔۔۔۔</span>` : ''}
          ${isEnglish || isBilingual ? `<span class="metaEng">Roll No:_________</span>` : ''}
        `}
      </td>
      <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1;">
        ${mcqPlacement === "three_papers" ? `<span class="metaUrdu">وقت: ${subjectiveTimeDisplayUrdu}</span><span class="metaUrdu">تاریخ:${formatPaperDate(paper.created_at)}</span>` : `
          ${isUrdu || isBilingual ? `<span class="metaUrdu">سیکشن:۔۔۔۔۔۔</span>` : ''}
          ${isEnglish || isBilingual ? `<span class="metaEng">Section:_______</span>` : ''}
        `}
      </td>
    </tr>`;

    if (mcqPlacement !== "three_papers") {
      htmlContent += `
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
        ${isUrdu || isBilingual ? `<span class="metaUrdu">تاریخ:${formatPaperDate(paper.created_at)}</span>` : ''}
        ${isEnglish || isBilingual ? `<span class="metaEng">Date:${formatPaperDate(paper.created_at)}</span>` : ''}
      </td>
    </tr>
    
    <!-- Row 3 -->
    <tr style="border:none !important; display:flex; justify-content:space-between; align-items:center;">
      <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1.5;">
        ${isUrdu || isBilingual ? `<span class="metaUrdu">وقت: ${mcqPlacement === 'separate' ? formatTimeForDisplay(timeValues.mcqTime, 'ur') : formatTimeForDisplay(timeValues.subjectiveTime, 'urdu')}</span>` : ''}
        ${isEnglish || isBilingual ? `<span class="metaEng">Time Allowed: ${mcqPlacement === 'separate' ? formatTimeForDisplay(timeValues.mcqTime, 'eng') : formatTimeForDisplay(timeValues.subjectiveTime, 'eng')}</span>` : ''}
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
        ${mcqPlacement === "separate" || mcqPlacement === "two_papers" ? (isUrdu || isBilingual ? `<span class="metaUrdu">حصہ معروضی</span>` : '') : isUrdu || isBilingual ? `<span class="metaUrdu">حصہ معروضی/انشائیہ</span>` : ''} 
        ${mcqPlacement === "separate" || mcqPlacement === "two_papers" ? (isEnglish || isBilingual ? `<span class="metaEng">Objective Part</span>` : '') : isEnglish || isBilingual ? `<span class="metaEng">Objective/Subjective Part</span>` : ''} 
      </td>
    </tr>`;
    }

    htmlContent += `
  </table>
  <hr style="color:black;"/> ${mcqPlacement !== 'three_papers' || mcqPlacement !== 'two_papers' ? '' : '<br/>'}`;

    // Add MCQ questions
    if (mcqQuestions.length > 0) {
      htmlContent += `<div class="note">`;
      if (isUrdu || isBilingual) {
        htmlContent += `<p class="urdu">نوٹ: ہر سوال کے چار ممکنہ جوابات A,B,C اور D دیئے گئے ہیں۔ درست جواب کے مطابق دائرہ پُر کریں۔ ایک سے زیادہ دائروں کو پُر کرنے کی صورت میں جواب غلط تصور ہوگا۔</p>`;
      }
      if ((isEnglish || isBilingual) && mcqPlacement !== 'three_papers') {
        htmlContent += `<p class="eng">Note: Four possible answers A, B, C and D to each question are given. Fill the correct option's circle. More than one filled circle will be treated wrong.</p>`;
      }
      htmlContent += `</div><table>`;

      mcqQuestions.forEach((question: any, index: number) => {
        const questionMarks = question.marks || mcqMarks;
        const { eng: englishQuestionRaw, ur: urduQuestionRaw } = extractEnglishAndUrdu(question.question_text, question.question_text_ur);
        const englishQuestion = formatQuestionText(englishQuestionRaw || '');
        const urduQuestion = formatQuestionText(urduQuestionRaw || '');
        
        let questionDisplayHtml = '<div class="question">';
        if (isEnglish) {
            questionDisplayHtml += `<span class="eng">${englishQuestion.trim()}</span>`;
        } else if (isUrdu) {
            questionDisplayHtml += `<span class="urdu">${urduQuestion.trim() || englishQuestion.trim()}</span>`;
        } else {
            questionDisplayHtml += `<span class="urdu">${urduQuestion.trim()}</span><span class="eng">${englishQuestion.trim()}</span>`;
        }
        questionDisplayHtml += '</div>';

        const options = [
          { letter: 'A', english: question.option_a || '', urdu: hasActualUrduText(question.option_a_ur) ? question.option_a_ur : '' },
          { letter: 'B', english: question.option_b || '', urdu: hasActualUrduText(question.option_b_ur) ? question.option_b_ur : '' },
          { letter: 'C', english: question.option_c || '', urdu: hasActualUrduText(question.option_c_ur) ? question.option_c_ur : '' },
          { letter: 'D', english: question.option_d || '', urdu: hasActualUrduText(question.option_d_ur) ? question.option_d_ur : '' }
        ];

        let optionsHtml = '';
        options.forEach(option => {
          if (option.english || option.urdu) {
            let optionDisplayHtml = `<span>(${option.letter}) `;
            if (isEnglish) {
                optionDisplayHtml += `<span class="eng">${option.english}</span>`;
            } else if (isUrdu) {
                optionDisplayHtml += `<span class="urdu">${option.urdu || option.english}</span>`;
            } else {
                optionDisplayHtml += `<span><span class="urdu">${option.urdu}</span> <span class="eng">${option.english}</span></span>`;
            }
            optionDisplayHtml += '</span>';
            optionsHtml += optionDisplayHtml;
          }
        });

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
${mcqPlacement === "separate" || mcqPlacement === "two_papers" || mcqPlacement === "three_papers" ? `
    <div class="footer no-break" style="margin-top: ${mcqPlacement === 'three_papers'?'0px;':'30px;'} text-align: center; font-size: 12px; color: #666;  padding-top: ${mcqPlacement === 'three_papers'?'0px;':'5px;'}">
    <p class="english">www.examly.pk | Generate papers Save Time | Generated on ${new Date(paper.created_at).toLocaleDateString()} by www.examly.pk </p>
  </div>
  </div>` : ``}
  
</div>`;
    }

    // Handle two_papers or three_papers layout
    if (mcqPlacement === "two_papers" && mcqQuestions.length > 0) {
      htmlContent += `
    <div class="watermark-1" style="position: fixed; top: 20%; left: 35%; z-index: 0; opacity: 0.1; pointer-events: none; transform: rotate(-45deg); ">
      ${isPaidUser ? `  
       <img src="${logoBase64}" alt="Examly Logo" style="width: 250px; height: auto;" />
 ` : `
       <img src="${loadImageAsBase64('examly.png')}" alt="Examly Logo" style="width: 250px; height: auto;" />  
       <div style="font-size: 16px; color: #000; text-align: center; margin-top: -25px; margin-left:60px">Trial version, get Package to set Your Water Mark.</div>
      `}
    </div>
    <div style="display:flex; align-items:center;">
      <span style="font-size:18px; margin-right:6px;">✂</span>
      <hr style="flex:1; border-top: 2px dotted black;" />
    </div>`;
    } else if (mcqPlacement === "three_papers" && mcqQuestions.length > 0) {
      htmlContent += `
    <div class="watermark-1" style="position: fixed; top: 13%; left: 30%; z-index: 0; opacity: 0.1; pointer-events: none; transform: rotate(-45deg);">
      ${isPaidUser ? `
       <img src="${logoBase64}" alt="Examly Logo" style="width: 300px; height: auto; " />
      ` : `
       <img src="${loadImageAsBase64('examly.png')}" alt="Examly Logo" style="width: 300px; height: auto; " />
       <div style="font-size: 16px; color: #000; text-align: center; margin-top: -25px; margin-left:60px">Trial version, get Package to set Your Water Mark.</div>
      `}
    </div>
    <div style="display:flex; align-items:center;">
      <span style="font-size:18px; margin-right:6px;">✂</span>
      <hr style="flex:1; border-top: 2px dotted black;" />
    </div>`;
    }
  }

  // Generate subjective section
  if (subjectiveQuestions.length > 0 || mcqQuestions.length === 0) {
    if (mcqQuestions.length > 0 && (mcqPlacement === "separate" || mcqPlacement === "two_papers" || mcqPlacement === "three_papers")) {
      htmlContent += `<div style="page-break-before: always;"></div>`;
    }
    
    let subjectiveContent = ``;
    
    const showSubjectiveStudentInfo = mcqPlacement === "separate" || mcqPlacement === "two_papers" || mcqPlacement === "three_papers" || mcqQuestions.length === 0;
    
    subjectiveContent += ` <div class="container" ${mcqPlacement === 'two_papers' ? 'style="height:525px; overflow:hidden"' : mcqPlacement === 'three_papers' ? 'style="height:345px; overflow:hidden"' : ''}>
  ${showSubjectiveStudentInfo ? `
     <div class="header">
     ${mcqPlacement === 'three_papers' ? `
      <h1 class="eng text-center">
      ${logoBase64 ? `<img src="${logoBase64}" class="header-img" height="30" width="70"/>` : ''}<br/>
      <span class="institute" style="font-size:12px; margin-top:-15px !important">${englishTitle}</span>
    </h1>
      ` : `
      <h1 class="eng text-center">
      ${logoBase64 ? `<img src="${logoBase64}" class="header-img" height="60" width="140"/>` : ''}<br/>
      <span class="institute">${englishTitle}</span>
    </h1>
`}
      </div>
    <!-- Student Info Table -->
<table style="width:100%; border-collapse:collapse; border:none !important; font-family:'Noto Nastaliq Urdu','Jameel Noori Nastaleeq','Noto Sans',Arial,sans-serif;">
<!-- Row 1 -->
<tr style="border:none !important; display:flex; justify-content:space-between; align-items:center;">
  <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1.5;">
    ${isUrdu || isBilingual || mcqPlacement === "three_papers" ? `<span class="metaUrdu">نام طالبعلم:۔۔۔۔۔۔۔۔۔۔</span>` : ''}
    ${mcqPlacement === "three_papers" ? `<span class="metaUrdu">رول نمبر:۔۔۔۔۔۔</span>` : isEnglish || isBilingual ? `<span class="metaEng">Student Name:_________</span>` : ''}
  </td>
  <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1;">
    ${mcqPlacement === "three_papers" ? `<span class="metaUrdu">مضمون: ${subject_ur}(${paperClass} کلاس)</span> <span class="metaUrdu">کل نمبر: ${subjectiveSectionMarks}</span>` : `
      ${isUrdu || isBilingual ? `<span class="metaUrdu">رول نمبر:۔۔۔۔۔۔</span>` : ''}
      ${isEnglish || isBilingual ? `<span class="metaEng">Roll No:_________</span>` : ''}
    `}
  </td>
  <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1;">
    ${mcqPlacement === "three_papers" ? `<span class="metaUrdu">وقت: ${subjectiveTimeDisplayUrdu}</span><span class="metaUrdu">تاریخ:${formatPaperDate(paper.created_at)}</span>` : `
      ${isUrdu || isBilingual ? `<span class="metaUrdu">سیکشن:۔۔۔۔۔۔</span>` : ''}
      ${isEnglish || isBilingual ? `<span class="metaEng">Section:_______</span>` : ''}
    `}
  </td>
</tr>

<!-- Row 2 -->
${mcqPlacement === "three_papers" ? `` : `
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
      ${isUrdu || isBilingual ? `<span class="metaUrdu">تاریخ:${formatPaperDate(paper.created_at)}</span>` : ''}
      ${isEnglish || isBilingual ? `<span class="metaEng">Date:${formatPaperDate(paper.created_at)}</span>` : ''}
    </td>
</tr>

<!-- Row 3 -->
<tr style="border:none !important; display:flex; justify-content:space-between; align-items:center;">
  <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1.5;">
    ${isUrdu || isBilingual ? `<span class="metaUrdu">وقت: ${subjectiveTimeDisplayUrdu}</span>` : ''}
    ${isEnglish || isBilingual ? `<span class="metaEng">Time Allowed: ${subjectiveTimeDisplayEng}</span>` : ''}
  </td>
  <td style="border:none !important; display:flex; justify-content:space-between; align-items:center; flex:1;">
      ${mcqPlacement === 'separate' || mcqPlacement === 'two_papers' || mcqQuestions.length === 0 ? 
        (isUrdu || isBilingual ? `<span class="metaUrdu">کل نمبر: ${subjectiveSectionMarks}</span>` : '') : 
        (isUrdu || isBilingual ? `<span class="metaUrdu">کل نمبر: ${paper.total_marks}</span>` : '')
      }
      ${mcqPlacement === 'separate' || mcqPlacement === 'two_papers' || mcqQuestions.length === 0 ? 
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
<hr style="color:black;"/>  ` : ``}
  `;

    // Add subjective questions based on paper type
    if (isBoardPaper) {
      // Board paper layout
      let questionNumber = 1;
      
      // Short questions
      if (shortQuestions.length > 0) {
        const shortMarksPerQuestion = shortQuestions[0]?.marks || shortMarks;
        const shortToAttemptValue = toAttemptValues.short || shortQuestions.length;
        const shortTotalMarks = shortToAttemptValue * shortMarksPerQuestion;
        
        subjectiveContent += `<div class="header" style="font-size:13px; font-weight:bold; display: flex; align-items: baseline; justify-content: center; gap: 5px;">
          (
          ${(isEnglish || isBilingual) ? `<span class="english" style="vertical-align: baseline;">Part - I</span>` : ''}
          ${(isUrdu || isBilingual) ? `<span class="urdu" style="vertical-align: baseline; position: relative; top: 1px;">حصہ اول</span>` : ''}
          )
        </div>`;
        
        // Group short questions
        let questionsPerGroup = 6;
        if (subject === 'urdu' || subject_ur === 'اردو' || subject === 'English' || subject === 'english' || subject === 'tarjuma ul quran') {
          questionsPerGroup = 8;
        } else if (subject === 'Islamiyat' || subject_ur === 'اسلامیات') {
          questionsPerGroup = 9;
        }
        
        const totalGroups = Math.ceil(shortQuestions.length / questionsPerGroup);
        
        for (let g = 0; g < totalGroups; g++) {
          const groupQuestions = shortQuestions.slice(g * questionsPerGroup, (g + 1) * questionsPerGroup);
          questionNumber = g + 2;
          
          let instructionHtml = '<div class="instructions1" style="font-weight: bold; font-size: 14px; line-height: 1.4; display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; margin-top: 4px;">';
          if (isEnglish || isBilingual) {
            instructionHtml += `<div class="eng" style="vertical-align: baseline;"><strong>${questionNumber}.</strong> Write short answers to any ${shortToAttemptValue} question(s). (${shortToAttemptValue} x ${shortMarksPerQuestion} = ${shortTotalMarks})</div>`;
          }
          if (isUrdu || isBilingual) {
            instructionHtml += `<div class="urdu" style="direction:rtl;"><strong><span>${subject === "urdu" ? questionNumber + 1 : questionNumber}.</span> سوالات میں سے ${shortToAttemptValue} سوالات کے مختصر جوابات لکھیں۔ </strong></div>`;
          }
          instructionHtml += '</div>';
          
          subjectiveContent += `<div class="short-questions ${isUrdu ? 'urdu' : ''}" style="line-height:1.2; font-size:12px;">${instructionHtml}`;
          
          if (subject === 'urdu') {
            // Two questions per row for Urdu
            for (let i = 0; i < groupQuestions.length; i += 2) {
              subjectiveContent += `<div class="short-question-row" style="display:flex; gap:10px; margin-bottom:2px;">`;
              for (let j = i; j < i + 2 && j < groupQuestions.length; j++) {
                const question = groupQuestions[j];
                const questionMarks = question.marks || shortMarks;
                const { eng: englishQuestionRaw, ur: urduQuestionRaw } = extractEnglishAndUrdu(question.question_text, question.question_text_ur);
                const urduQuestion = formatQuestionText(urduQuestionRaw || englishQuestionRaw || '');
                
                subjectiveContent += `
                  <div class="short-question-item" style="flex:1; line-height:1.5; font-size:12px;">
                    <div style="display:flex; align-items:flex-start; gap:5px; direction:rtl; text-align:right;">
                      <div style="flex-shrink:0; font-weight:bold;">(${toRoman(j + 1)})</div>
                      <div style="flex:1;">${urduQuestion} <span class="marks-display">(${questionMarks})</span></div>
                    </div>
                  </div>
                `;
              }
              subjectiveContent += `</div>`;
            }
          } else {
            // One question per row for English/bilingual
            groupQuestions.forEach((question: any, idx: number) => {
              const questionMarks = question.marks || shortMarks;
              const { eng: englishQuestionRaw, ur: urduQuestionRaw } = extractEnglishAndUrdu(question.question_text, question.question_text_ur);
              const englishQuestion = formatQuestionText(englishQuestionRaw || '');
              const urduQuestion = formatQuestionText(urduQuestionRaw || '');
              const hasUrdu = hasActualUrduText(urduQuestion);
              
              subjectiveContent += `
                <div class="short-question-item" style="line-height:1.0; font-size:12px; margin-bottom:0px;">
                  <div style="display:flex; align-items:flex-start; gap:5px;">
                    <div style="flex-shrink:0; font-weight:bold;">(${toRoman(idx + 1)})</div>
                    <div style="flex:1;">${englishQuestion} <span class="marks-display">(${questionMarks})</span></div>
                  </div>
                  ${(!isEnglish && hasUrdu) ? `
                    <div style="display:flex; align-items:flex-start; gap:5px; direction:rtl; text-align:right; margin-top:0px;">
                      <div style="flex-shrink:0; font-weight:bold;" class="urdu">(${toRoman(idx + 1)})</div>
                      <div style="flex:1;" class="urdu">${urduQuestion} <span class="marks-display">(${questionMarks})</span></div>
                    </div>
                  ` : ''}
                </div>
              `;
            });
          }
          
          subjectiveContent += `</div>`;
        }
      }
      
      // Long questions
      if (longQuestions.length > 0) {
        if (subject === 'urdu' || subject_ur === 'اردو' || subject === 'English' || subject === 'english') {
          subjectiveContent += `
            <div class="header" style="font-weight:bold; display: flex; align-items: baseline; justify-content: center; gap: 5px;">
              (
              ${(isEnglish || isBilingual) ? `<span class="english" style="vertical-align: baseline;">Part - II</span>` : ''}
              ${(isUrdu || isBilingual) ? `<span class="urdu" style="vertical-align: baseline; position: relative; top: 1px;">حصہ دوم</span>` : ''}
              )
            </div>`;
        }
        
        const longToAttemptValue = toAttemptValues.long || longQuestions.length;
        const showAttemptAny = longToAttemptValue < longQuestions.length;
        
        subjectiveContent += `<div class="instructions1" style="font-weight: bold; font-size: 14px; line-height: 1.4; margin-bottom: 2px; margin-top: 4px; display: flex; flex-direction: column;">`;
        
        if (isEnglish || isBilingual) {
          if (showAttemptAny) {
            subjectiveContent += `<div class="instruction-text eng" style="vertical-align: baseline; text-align:left;"><span>Note:</span> Attempt any ${longToAttemptValue} question(s) in detail.</div>`;
          } else {
            subjectiveContent += `<div class="instruction-text eng" style="vertical-align: baseline; text-align:left;"><span>Note:</span> Attempt the following questions in detail.</div>`;
          }
        }
        
        if (isUrdu || isBilingual) {
          if (showAttemptAny) {
            if (subject === 'urdu') {
              subjectiveContent += `<div class="instruction-text urdu" style="direction:rtl; text-align:right;"><span>نوٹ:</span>کوئی سے ${longToAttemptValue} سوالات کے جوابات تحریر کریں۔</div>`;
            } else {
              subjectiveContent += `<div class="instruction-text urdu" style="direction:rtl; text-align:right;"><span>نوٹ:</span>کوئی سے ${longToAttemptValue} سوالات کے تفصیل سے جوابات تحریر کریں۔</div>`;
            }
          } else {
            subjectiveContent += `<div class="instruction-text urdu" style="direction:rtl; text-align:right;"><span>نوٹ:</span> درج ذیل سوالات کے تفصیل سے جوابات تحریر کریں۔</div>`;
          }
        }
        
        subjectiveContent += `</div>`;
        
        longQuestions.forEach((question: any, idx: number) => {
          const questionMarks = question.marks || longMarks;
          const { eng: englishQuestionRaw, ur: urduQuestionRaw } = extractEnglishAndUrdu(question.question_text, question.question_text_ur);
          const englishQuestion = formatQuestionText(englishQuestionRaw || '');
          const urduQuestion = formatQuestionText(urduQuestionRaw || '');
          const hasUrduQuestion = hasActualUrduText(urduQuestion);
          
          subjectiveContent += `<div class="long-question" style="margin-bottom:2px;">`;
          
          if (isEnglish) {
            subjectiveContent += `
              <div class="eng" style="${subject === 'urdu' || subject === 'english' || subject === 'English' ? 'vertical-align: baseline; line-height:1.6; font-weight:bold' : ''}; width:100%;">
                <div style="display:flex; align-items:flex-start; gap:5px;">
                  <div style="flex-shrink:0;"><strong>${subject === 'urdu' || subject === 'english' || subject === 'English' ? idx + 1 : `Q.${idx + 1}`}.</strong></div>
                  <div style="flex:1;">${englishQuestion} <span class="marks-display">(${questionMarks})</span></div>
                </div>
              </div>
            `;
          } else if (isUrdu) {
            subjectiveContent += `
              <div class="urdu" style="width:100%; direction:rtl; text-align:right;">
                <div style="display:flex; align-items:flex-start; gap:5px; ${subject === 'urdu' ? ' font-size:14px; font-weight:bold; line-height:1.6;' : ''}">
                  <div style="flex-shrink:0;"><strong>${subject === 'urdu' ? idx + 1 : `سوال ${idx + 1}`}.</strong></div>
                  <div style="flex:1;">${urduQuestion} <span class="marks-display">(${questionMarks})</span></div>
                </div>
              </div>
            `;
          } else {
            subjectiveContent += `
              <div class="eng" style="width:48%;">
                <div style="display:flex; align-items:flex-start; gap:5px;">
                  <div style="flex-shrink:0;"><strong>Q.${idx + 1}.</strong></div>
                  <div style="flex:1;">${englishQuestion} <span class="marks-display">(${questionMarks})</span></div>
                </div>
              </div>
            `;
            if (hasUrduQuestion) {
              subjectiveContent += `
                <div class="urdu" style="width:48%; direction:rtl; text-align:right;">
                  <div style="display:flex; align-items:flex-start; gap:5px;">
                    <div style="flex-shrink:0;"><strong>سوال ${idx + 1}:</strong></div>
                    <div style="flex:1;">${urduQuestion} <span class="marks-display">(${questionMarks})</span></div>
                  </div>
                </div>
              `;
            }
          }
          
          subjectiveContent += `</div>`;
        });
      }
    } else {
      // Regular paper layout
      let partNumber = 1;
      
      // Render each question type
      const questionTypes = Object.keys(questionsByType).filter(type => type !== 'mcq');
      
      for (const type of questionTypes) {
        const typeQuestions = questionsByType[type] || [];
        if (typeQuestions.length === 0) continue;
        
        const isLongStyle = type === 'long' || type === 'passage';
        const toAttemptForType = toAttemptValues[type] || typeQuestions.length;
        const showAttemptAny = toAttemptForType > 0 && toAttemptForType < typeQuestions.length;
        
        if (subject === "urdu" || subject === "English" || mcqPlacement === "three_papers") {
          // Skip part headers for these subjects
        } else {
          subjectiveContent += `
            <div class="header" style="font-weight:bold; display: flex; align-items: baseline; justify-content: center; gap: 5px;">
              (
              ${(isEnglish || isBilingual) ? `<span class="english" style="vertical-align: baseline;">Part - ${partNumber}</span>` : ''}
              ${(isUrdu || isBilingual) ? `<span class="urdu" style="vertical-align: baseline; position: relative; top: 1px;">حصہ ${partNumber}</span>` : ''}
              )
            </div>
          `;
        }
        
        if (isLongStyle) {
          // Long questions layout
          if (subject === "urdu" || subject === "English") {
            // Special handling for Urdu/English subjects
          } else {
            subjectiveContent += `<div class="instructions1" style="font-weight: bold; font-size: 14px; line-height: 1.4; display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; margin-top: 4px;">`;
            
            if (isEnglish || isBilingual) {
              if (showAttemptAny) {
                subjectiveContent += `<div class="instruction-text eng" style="${mcqPlacement === 'three_papers' || mcqPlacement === 'two_papers' ? 'font-size:12px;' : 'vertical-align: baseline;'}"><span>Note:</span> Attempt any ${toAttemptForType} question(s) in detail.</div>`;
              } else {
                subjectiveContent += `<div class="instruction-text eng" style="${mcqPlacement === 'three_papers' || mcqPlacement === 'two_papers' ? 'font-size:12px;' : 'vertical-align: baseline;'}"><span>Note:</span> Attempt the following questions in detail.</div>`;
              }
            }
            
            if (isUrdu || isBilingual) {
              if (showAttemptAny) {
                subjectiveContent += `<div class="urdu" style="flex: 1; text-align: right; direction: rtl; ${mcqPlacement === 'three_papers' || mcqPlacement === 'two_papers' ? 'font-size:12px;' : ''}">  کوئی سے  ${toAttemptForType} سوالات کے  تفصیل سے جوابات تحریر کریں۔</div>`;
              } else {
                subjectiveContent += `<div class="urdu" style="flex: 1; text-align: right; direction: rtl; ${mcqPlacement === 'three_papers' || mcqPlacement === 'two_papers' ? 'font-size:12px;' : ''}">  درج ذیل سوالات کے تفصیل سے جوابات تحریر کریں۔</div>`;
              }
            }
            
            subjectiveContent += `</div>`;
          }
          
          // Render long questions
          let itemsPerRow = 1;
          if (mcqPlacement === 'three_papers' && (subject === "urdu" || subject === "english")) {
            itemsPerRow = 2;
          }
          
          typeQuestions.forEach((question: any, idx: number) => {
            const questionMarks = question.marks || longMarks;
            const { eng: englishQuestionRaw, ur: urduQuestionRaw } = extractEnglishAndUrdu(question.question_text, question.question_text_ur);
            const englishQuestion = formatQuestionText(englishQuestionRaw || '');
            const urduQuestion = formatQuestionText(urduQuestionRaw || '');
            const hasUrduQuestion = hasActualUrduText(urduQuestion);
            
            if (itemsPerRow > 1 && idx % itemsPerRow === 0) {
              subjectiveContent += `<div class="long-row" style="display:flex; gap:8px; margin-bottom:4px;">`;
            }
            
            subjectiveContent += `
              <div class="long-question" style="flex:1; width:${itemsPerRow > 1 ? `${100 / itemsPerRow}%` : '100%'}; margin-bottom:2px;">
            `;
            
            if (isEnglish) {
              subjectiveContent += `
                <div style="display:flex; align-items:flex-start; font-size:11px; line-height:1.15;">
                  <div style="width:26px; flex-shrink:0;"><strong>Q.${idx + 1}</strong></div>
                  <div style="flex:1;">${englishQuestion} <span class="marks-display">(${questionMarks})</span></div>
                </div>
              `;
            } else if (isUrdu) {
              subjectiveContent += `
                <div class="urdu" style="display:flex; align-items:flex-start; font-size:11px; line-height:1.2; direction:rtl;">
                  <div style="width:30px; flex-shrink:0; text-align:right;"><strong>سوال ${idx + 1}</strong></div>
                  <div style="flex:1; text-align:right;">${urduQuestion} <span class="marks-display">(${questionMarks})</span></div>
                </div>
              `;
            } else {
              subjectiveContent += `
                <div style="display:flex; gap:6px;">
                  <div style="display:flex; align-items:flex-start; width:50%; font-size:11px; line-height:1.15;">
                    <div style="width:26px; flex-shrink:0;"><strong>Q.${idx + 1}</strong></div>
                    <div style="flex:1;">${englishQuestion} <span class="marks-display">(${questionMarks})</span></div>
                  </div>
              `;
              
              if (hasUrduQuestion) {
                subjectiveContent += `
                  <div class="urdu" style="display:flex; align-items:flex-start; margin-right:0px; padding-right:0px; width:50%; font-size:11px; line-height:1.2;">
                    <div style="width:30px; flex-shrink:0;"><strong>سوال ${idx + 1}</strong></div>
                    <div style="flex:1;">${urduQuestion} <span class="marks-display">(${questionMarks})</span></div>
                  </div>
                `;
              }
              
              subjectiveContent += `</div>`;
            }
            
            subjectiveContent += `</div>`;
            
            if (itemsPerRow > 1 && (idx % itemsPerRow === itemsPerRow - 1 || idx === typeQuestions.length - 1)) {
              subjectiveContent += `</div>`;
            }
          });
        } else {
          // Short questions layout
          let itemsPerRow = 1;
          if (!isBilingual) {
            itemsPerRow = mcqPlacement === 'three_papers' ? 3 : 2;
          } else {
            itemsPerRow = mcqPlacement === 'three_papers' ? 2 : 1;
          }
          
          // Instruction
          let instructionHtml = '<div style="display:flex; justify-content:space-between; margin-bottom:0px; font-weight:bold">';
          
          switch(type) {
            case 'short':
              if (isEnglish || isBilingual) {
                if (showAttemptAny) {
                  instructionHtml += `<div class="eng" style="${mcqPlacement === 'three_papers' ? 'font-size:12px;' : ''}"> Write short answers of any ${toAttemptForType} question(s). </div>`;
                } else {
                  instructionHtml += `<div class="eng" style="${mcqPlacement === 'three_papers' ? 'font-size:12px;' : ''}"> Write short answers of the following questions. </div>`;
                }
              }
              if (isUrdu || isBilingual) {
                if (showAttemptAny) {
                  instructionHtml += `<div class="urdu" style="direction:rtl; ${mcqPlacement === 'three_papers' || mcqPlacement === 'two_papers' ? 'font-size:12px;' : ''}"> کوئی سے ${toAttemptForType} سوالات کے مختصر جوابات تحریر کریں۔</div>`;
                } else {
                  instructionHtml += `<div class="urdu" style="direction:rtl; ${mcqPlacement === 'three_papers' || mcqPlacement === 'two_papers' ? 'font-size:12px;' : ''}"> درج ذیل سوالات کے مختصر جوابات تحریر کریں۔</div>`;
                }
              }
              break;
            default:
              // Handle other question types
              instructionHtml += `<div class="eng">${type} questions</div>`;
          }
          
          instructionHtml += '</div>';
          subjectiveContent += `<div class="short-questions ${isUrdu ? 'urdu' : ''}">${instructionHtml}`;
          
          // Render questions
          typeQuestions.forEach((question: any, idx: number) => {
            const questionMarks = question.marks || shortMarks;
            const { eng: englishQuestionRaw, ur: urduQuestionRaw } = extractEnglishAndUrdu(question.question_text, question.question_text_ur);
            const englishQuestion = formatQuestionText(englishQuestionRaw || '');
            const urduQuestion = formatQuestionText(urduQuestionRaw || '');
            
            if (itemsPerRow > 1 && idx % itemsPerRow === 0) {
              subjectiveContent += `
                <div class="urdu-row" style="display:flex; gap:15px; margin-bottom:0px; direction:${isUrdu ? 'rtl' : 'ltr'}; font-size:${mcqPlacement === 'three_papers' ? '10px' : '12px'}; ${mcqPlacement === 'three_papers' ? 'letter-spacing:-0.5px;' : ''}">
              `;
            }
            
            subjectiveContent += `
              <div class="short-question-item" style="flex:1; width:${itemsPerRow > 1 ? `${100 / itemsPerRow}%` : '100%'}; font-size:${mcqPlacement === 'three_papers' ? '10px' : '12px'}; line-height:${isBilingual ? '0.9' : '1.3'}; ${mcqPlacement === 'three_papers' ? 'letter-spacing:-0.5px;' : ''}">
            `;
            
            if (isEnglish) {
              subjectiveContent += `
                <div style="display:flex; align-items:flex-start;">
                  <div style="width:22px; flex-shrink:0;">(${toRoman(idx + 1)})</div>
                  <div style="flex:1;">${englishQuestion} <span class="marks-display">(${questionMarks})</span></div>
                </div>
              `;
            } else if (isUrdu) {
              subjectiveContent += `
                <div class="urdu" style="display:flex; align-items:flex-start; direction:rtl;">
                  <div style="width:24px; flex-shrink:0; text-align:right;">(${toRoman(idx + 1)})</div>
                  <div style="flex:1; text-align:right;">${urduQuestion || englishQuestion} <span class="marks-display">(${questionMarks})</span></div>
                </div>
              `;
            } else {
              subjectiveContent += `
                <div style="display:flex; align-items:flex-start;">
                  <div style="width:22px; flex-shrink:0;">(${toRoman(idx + 1)})</div>
                  <div style="flex:1;">${englishQuestion} <span class="marks-display">(${questionMarks})</span></div>
                </div>
              `;
              
              if (hasActualUrduText(urduQuestion)) {
                subjectiveContent += `
                  <div class="urdu" style="display:flex; align-items:flex-start; direction:rtl; margin-top:1px;">
                    <div style="width:24px; flex-shrink:0; text-align:right;">(${toRoman(idx + 1)})</div>
                    <div style="flex:1; text-align:right;">${urduQuestion} <span class="marks-display">(${questionMarks})</span></div>
                  </div>
                `;
              }
            }
            
            subjectiveContent += `</div>`;
            
            if (itemsPerRow > 1 && (idx % itemsPerRow === itemsPerRow - 1 || idx === typeQuestions.length - 1)) {
              subjectiveContent += `</div>`;
            }
          });
          
          subjectiveContent += `</div>`;
        }
        
        partNumber++;
      }
    }
    
    // Footer
    subjectiveContent += `
  <div class="footer no-break" style="margin-top: ${mcqPlacement === 'three_papers' ? '5px;' : '30px;'} text-align: center; font-size: 12px; color: #666; border-top: 1px solid #ccc; padding-top: ${mcqPlacement === 'three_papers' ? '0px;' : '5px;'}">
    <p class="english">www.examly.pk | Generate papers Save Time | Generated on ${new Date(paper.created_at).toLocaleDateString()} by www.examly.pk </p>
  </div>
</div>
</div>
    `;
    
    // Handle layout for multi-paper formats
    if (mcqPlacement === "two_papers") {
      subjectiveContent = `<div style="display:flex; align-items:center;">
  <span style="font-size:18px; margin-right:6px;">✂</span>
  <hr style="flex:1; border-top: 2px dotted black;" />
</div>` + subjectiveContent;
      htmlContent += subjectiveContent;
    } else if (mcqPlacement === "three_papers") {
      subjectiveContent = `<div style="display:flex; align-items:center;">
  <span style="font-size:18px; margin-right:6px;">✂</span>
  <hr style="flex:1; border-top: 2px dotted black;" />
</div>` + subjectiveContent + `<div style="display:flex; align-items:center;">
  <span style="font-size:18px; margin-right:6px;">✂</span>
  <hr style="flex:1; border-top: 2px dotted black;" />
</div>` + subjectiveContent;
      htmlContent += subjectiveContent;
    } else {
      htmlContent += subjectiveContent + `
      <div class="watermark-text-9" style="position: fixed; top: 40%; left: 25%; z-index: 0; opacity: 0.1; pointer-events: none; transform: rotate(-45deg); ">
        ${isPaidUser ? `
          <img src="${logoBase64}" alt="Examly Logo" style="width: 400px; height: auto;" /><br/>
        ` : `
          <img src="${loadImageAsBase64('examly.png')}" alt="Examly Logo" style="width: 400px; height: auto;" /><br/>
          <div style="font-size: 16px; color: #000; text-align: center; margin-top: -25px; margin-left:60px">Trial version, get Package to set Your Water Mark.</div>
        `}
      </div>`;
    }
  }

  htmlContent += `
</body>
</html>`;

  return optimizeHtmlForPuppeteer(simplifyHtmlContent(htmlContent));
}

// Main GET function
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ paperId: string }> }
) {
  // Await params for Next.js 13+ dynamic routes
  const { paperId } = await params;
  console.log('📄 GET request received to download paper:', paperId);
  
  const startTime = Date.now();
  
  try {
    // Extract token
    const token = extractToken(request);
    console.log('🔐 Token present:', token ? `${token.slice(0,6)}...${token.slice(-6)}` : 'none');
    
    if (!token) {
      console.warn('No authorization token found');
      return NextResponse.json({ error: 'Authorization token required' }, { status: 401 });
    }

    // Verify user
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Token validation error:', userError);
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }

    console.log(`👤 User ${user.id} authenticated successfully`);

    // Fetch the paper
    const { data: paper, error: paperError } = await supabaseAdmin
      .from('papers')
      .select(`
        *,
        subjects (name),
        classes (name)
      `)
      .eq('id', paperId)
      .eq('created_by', user.id)
      .single();

    if (paperError || !paper) {
      console.error('Paper not found or access denied:', paperError);
      return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
    }

    console.log(`📋 Paper found: ${paper.title}`);

    // Fetch paper questions
    const { data: paperQuestions, error: pqError } = await supabaseAdmin
      .from('paper_questions')
      .select(`
        order_number,
        question_type,
        question_id,
        questions (
          id,
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
      .eq('paper_id', paperId)
      .order('order_number', { ascending: true });

    if (pqError) {
      console.error('Error fetching paper questions:', pqError);
      return NextResponse.json({ error: 'Failed to fetch paper questions' }, { status: 500 });
    }

    if (!paperQuestions || paperQuestions.length === 0) {
      console.error('No questions found for this paper');
      return NextResponse.json({ error: 'No questions found for this paper' }, { status: 404 });
    }

    console.log(`✅ Found ${paperQuestions.length} questions for paper`);

    // Get subject and class names
    const subject = (paper.subjects as any)?.name || 'Subject';
    const paperClass = (paper.classes as any)?.name?.toString() || 'Class';
    
    // Get Urdu translation for subject
    let subject_ur = '';
    const cachedTranslation = translationCache.get(subject);
    if (cachedTranslation) {
      subject_ur = cachedTranslation;
    } else {
      try {
        const translatedSubject = await translate(subject, { to: 'ur' });
        subject_ur = translatedSubject.text;
        translationCache.set(subject, subject_ur);
      } catch (translateError) {
        console.warn('Translation failed:', translateError);
        subject_ur = 'مضمون';
      }
    }

    // Get user logo
    const logoBase64 = await getUserLogoBase64(user.id);

    // Generate HTML content
    console.log('🔄 Generating HTML content...');
    const htmlContent = await generatePaperHTMLForExistingPaper(
      paper,
      user.id,
      logoBase64,
      paperQuestions,
      subject,
      subject_ur,
      paperClass
    );

    // Generate PDF
    console.log('🔄 Creating PDF from HTML...');
    
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await generatePDFFromHTML(htmlContent);
    } catch (pdfError) {
      console.error('❌ PDF generation failed:', pdfError);
      
      // Fallback for development
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Using fallback PDF generation for development...');
        pdfBuffer = await createFallbackPDF(htmlContent, paper.title || 'Paper');
        console.log('✅ Fallback PDF generated successfully');
      } else {
        console.error('❌ PDF generation failed in production:', pdfError);
        return NextResponse.json(
          { 
            error: 'PDF generation failed. Please try again or contact support.',
            details: process.env.NODE_ENV === 'development' ? (pdfError as Error).message : undefined
          },
          { status: 500 }
        );
      }
    }

    console.log(`✅ Paper download completed successfully in ${Date.now() - startTime}ms`);

    // Return PDF as response
    const filename = `${paper.title.replace(/[^a-z0-9_\-\.]/gi, '_')}.pdf`;
    
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdfBuffer.length),
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
    });
  } catch (error) {
    console.error('❌ Error downloading paper:', error);
    
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }

    return NextResponse.json(
      { 
        error: 'Failed to download paper. Please try again later.',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  } finally {
    console.log(`⏱️ Total download time: ${Date.now() - startTime}ms`);
  }
}

// Cleanup function for browser instance
function cleanupBrowser() {
  if (browserCleanupInterval) {
    clearInterval(browserCleanupInterval);
    browserCleanupInterval = null;
  }
  
  if (browserPromise) {
    browserPromise.then(browser => {
      if (browser && browser.isConnected()) {
        browser.close();
      }
    }).catch(console.error);
    browserPromise = null;
  }
}

// Register cleanup on process exit
if (typeof process !== 'undefined') {
  process.on('beforeExit', cleanupBrowser);
  process.on('SIGINT', cleanupBrowser);
  process.on('SIGTERM', cleanupBrowser);
}