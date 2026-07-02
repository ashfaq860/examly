import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { isRateLimited, getClientIp } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (isRateLimited(`contact:${ip}`, 5, 10 * 60 * 1000)) {
      return NextResponse.json(
        { message: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const formData = await request.json();
    const { name, email, phone, subject, message, userType } = formData;

    // Validate required fields
    if (!name || !email || !subject || !message || !userType) {
      return NextResponse.json(
        { message: 'All required fields must be filled' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { message: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Create detailed log entry
    const timestamp = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    console.log('🚀 NEW CONTACT FORM SUBMISSION RECEIVED');
    console.log('════════════════════════════════════════');
    console.log(`📅 Timestamp: ${timestamp}`);
    console.log(`👤 Name: ${name}`);
    console.log(`📧 Email: ${email}`);
    console.log(`📞 Phone: ${phone || 'Not provided'}`);
    console.log(`🎯 User Type: ${userType}`);
    console.log(`📋 Subject: ${subject}`);
    console.log(`💬 Message: ${message}`);
    console.log('════════════════════════════════════════');
    console.log('✅ ACTION REQUIRED: Contact this person within 24 hours!');
    console.log(`   📧 Email: ${email}`);
    console.log(`   📞 Phone: ${phone || 'Use email'}`);
    console.log('════════════════════════════════════════\n');

    // Save to JSON file for persistence
    try {
      const submissionsDir = join(process.cwd(), 'contact-submissions');
      
      // Create directory if it doesn't exist
      if (!existsSync(submissionsDir)) {
        mkdirSync(submissionsDir, { recursive: true });
        console.log('📁 Created contact-submissions directory');
      }
      
      // Create filename with timestamp — strip anything but alphanumerics/
      // dashes from the user-supplied name so it can't escape submissionsDir
      // via path traversal sequences (e.g. "../../").
      const safeName = name.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'unknown';
      const filename = `contact-${Date.now()}-${safeName}.json`;
      const filepath = join(submissionsDir, filename);
      
      const submissionData = {
        name,
        email,
        phone: phone || null,
        userType,
        subject,
        message,
        timestamp: new Date().toISOString(),
        receivedAt: timestamp,
        ip: request.headers.get('x-forwarded-for') || 
            request.headers.get('x-real-ip') || 
            'unknown'
      };
      
      // Write to file
      writeFileSync(filepath, JSON.stringify(submissionData, null, 2));
      console.log(`💾 Submission saved to: contact-submissions/${filename}`);
      
    } catch (fileError) {
      console.log('⚠️ Could not save to file, but submission was logged to console');
    }

    // Also log to a simple text file for easy reading
    try {
      const logEntry = `
════════════════════════════════════════
NEW CONTACT FORM SUBMISSION
Timestamp: ${timestamp}
Name: ${name}
Email: ${email}
Phone: ${phone || 'Not provided'}
User Type: ${userType}
Subject: ${subject}
Message:
${message}
════════════════════════════════════════

`;
      
      const logPath = join(process.cwd(), 'contact-submissions', 'contact-log.txt');
      writeFileSync(logPath, logEntry, { flag: 'a' }); // Append mode
      console.log('📝 Added to contact-log.txt');
      
    } catch (logError) {
      console.log('⚠️ Could not write to log file');
    }

    // Return success response
    return NextResponse.json(
      { 
        success: true,
        message: 'Thank you for your message! We have received your inquiry and will contact you within 24 hours.',
        contactEmail: 'meshfaq@yahoo.com',
        contactPhone: '0304-5302981'
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('❌ Error processing contact form:', error);
    
    // Even if there's an error, try to log what we have
    try {
      const errorData = await request.json();
      console.log('📝 Partial form data received before error:', errorData);
    } catch (e) {
      console.log('📝 No form data could be extracted');
    }
    
    // Still return success to user, but log the error
    return NextResponse.json(
      { 
        success: true,
        message: 'Thank you for your message! We have received your details and will contact you shortly.',
        note: 'If you need immediate assistance, please call us at 0304-5302981'
      },
      { status: 200 }
    );
  }
}

export async function GET() {
  const stats = {
    status: '🟢 Contact API is working',
    timestamp: new Date().toISOString(),
    features: [
      'Form data logging to console',
      'JSON file storage',
      'Text log file',
      'Input validation',
      'Always returns success to user'
    ],
    instructions: 'Check your terminal/console for form submissions'
  };

  return NextResponse.json(stats, { status: 200 });
}