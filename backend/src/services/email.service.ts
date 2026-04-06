/**
 * Email Service
 * Currently uses console logging for development.
 * Swap EMAIL_PROVIDER env var to 'sendgrid' and provide SENDGRID_API_KEY for prod.
 */

const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'console';

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

async function sendEmail(payload: EmailPayload): Promise<void> {
  if (EMAIL_PROVIDER === 'sendgrid') {
    // SendGrid integration placeholder
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: payload.to }] }],
          from: { email: process.env.EMAIL_FROM || 'noreply@nutribot.app', name: 'NutriBot' },
          subject: payload.subject,
          content: [
            { type: 'text/plain', value: payload.text },
            { type: 'text/html', value: payload.html },
          ],
        }),
      });
      if (!response.ok) {
        console.error('[Email] SendGrid error:', response.status, await response.text());
      }
    } catch (err) {
      console.error('[Email] SendGrid send failed:', err);
    }
  } else {
    // Console logging for development
    console.log('\n' + '='.repeat(60));
    console.log(`📧 EMAIL TO: ${payload.to}`);
    console.log(`📋 SUBJECT: ${payload.subject}`);
    console.log('-'.repeat(60));
    console.log(payload.text);
    console.log('='.repeat(60) + '\n');
  }
}

export async function sendVerificationEmail(to: string, name: string, verificationUrl: string): Promise<void> {
  await sendEmail({
    to,
    subject: 'Verify your NutriBot email address',
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
        <h1 style="color: #10b981;">Welcome to NutriBot, ${name}! 🌱</h1>
        <p>Please verify your email address to unlock plan generation.</p>
        <a href="${verificationUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">Verify Email</a>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">This link expires in 24 hours.</p>
        <p style="color: #6b7280; font-size: 12px;">If you didn't create an account, you can safely ignore this email.</p>
      </div>
    `,
    text: `Welcome to NutriBot, ${name}!\n\nVerify your email: ${verificationUrl}\n\nThis link expires in 24 hours.`,
  });
}

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string): Promise<void> {
  await sendEmail({
    to,
    subject: 'Reset your NutriBot password',
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
        <h1 style="color: #10b981;">Password Reset 🔐</h1>
        <p>Hi ${name}, we received a request to reset your password.</p>
        <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">Reset Password</a>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">This link expires in 1 hour.</p>
        <p style="color: #6b7280; font-size: 12px;">If you didn't request this, your account is still safe. No changes were made.</p>
      </div>
    `,
    text: `Hi ${name},\n\nReset your password: ${resetUrl}\n\nThis link expires in 1 hour.`,
  });
}

export async function sendPasswordChangedEmail(to: string, name: string): Promise<void> {
  await sendEmail({
    to,
    subject: 'Your NutriBot password was changed',
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
        <h1 style="color: #10b981;">Password Changed ✅</h1>
        <p>Hi ${name}, your password was successfully changed.</p>
        <p>All other sessions have been logged out for security.</p>
        <p style="color: #ef4444; font-weight: 600;">If you didn't make this change, please reset your password immediately.</p>
      </div>
    `,
    text: `Hi ${name},\n\nYour password was successfully changed. All other sessions have been logged out.\n\nIf you didn't make this change, please reset your password immediately.`,
  });
}

export async function sendSessionLimitEmail(to: string, name: string): Promise<void> {
  await sendEmail({
    to,
    subject: 'New sign-in on your NutriBot account',
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
        <h1 style="color: #f59e0b;">New Sign-In Detected ⚠️</h1>
        <p>Hi ${name}, a new session was created on your account, and your oldest session was automatically signed out (maximum 5 active sessions).</p>
        <p style="color: #6b7280; font-size: 14px;">If this wasn't you, please change your password and enable MFA.</p>
      </div>
    `,
    text: `Hi ${name},\n\nA new session was created on your account. Your oldest session was signed out (max 5 active sessions).\n\nIf this wasn't you, please change your password and enable MFA.`,
  });
}
