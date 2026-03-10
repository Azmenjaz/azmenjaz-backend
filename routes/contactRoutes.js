const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

/**
 * POST /api/contact
 * Receives a contact form submission and forwards it via email
 *
 * Required env vars:
 *   SMTP_HOST     – your SMTP server host  (e.g. mail.safarsmart.com  OR smtp.gmail.com)
 *   SMTP_PORT     – SMTP port              (465 for SSL, 587 for STARTTLS)
 *   SMTP_SECURE   – "true" for port 465, "false" for 587
 *   SMTP_USER     – sender email address   (e.g. noreply@safarsmart.com)
 *   SMTP_PASS     – sender email password
 *   CONTACT_TO    – recipient email        (defaults to info@safarsmart.com)
 */

const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '465'),
        secure: process.env.SMTP_SECURE !== 'false', // true by default (SSL)
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        tls: {
            rejectUnauthorized: false, // allow self-signed certs on shared hosting
        },
        connectionTimeout: 10000,
        socketTimeout: 10000,
    });
};

router.post('/', async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        // Basic validation
        if (!name || !email || !message) {
            return res.status(400).json({
                status: 'error',
                message: 'Name, email, and message are required.',
            });
        }

        // Email format check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid email address.',
            });
        }

        const toAddress = process.env.CONTACT_TO || 'info@safarsmart.com';
        const subjectLine = subject
            ? `[SafarSmart Contact] ${subject}`
            : '[SafarSmart Contact] New Message';

        const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 32px; border-radius: 12px;">
        <div style="background: linear-gradient(135deg, #1A365D, #2d4a7a); padding: 20px 24px; border-radius: 10px 10px 0 0;">
          <h2 style="color: white; margin: 0; font-size: 1.3rem;">📩 رسالة جديدة من موقع SafarSmart</h2>
        </div>
        <div style="background: white; padding: 24px; border-radius: 0 0 10px 10px; border: 1px solid #e2e8f0; border-top: none;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
            <tr>
              <td style="padding: 10px 0; color: #64748b; font-weight: 700; width: 130px;">الاسم / Name:</td>
              <td style="padding: 10px 0; color: #1A365D; font-weight: 600;">${escapeHtml(name)}</td>
            </tr>
            <tr style="background: #f8fafc;">
              <td style="padding: 10px; color: #64748b; font-weight: 700;">البريد / Email:</td>
              <td style="padding: 10px; color: #1A365D;">
                <a href="mailto:${escapeHtml(email)}" style="color: #48BB78;">${escapeHtml(email)}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #64748b; font-weight: 700;">الموضوع / Subject:</td>
              <td style="padding: 10px 0; color: #1A365D;">${escapeHtml(subject || 'غير محدد / Not specified')}</td>
            </tr>
          </table>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">

          <h3 style="color: #1A365D; font-size: 0.95rem; margin-bottom: 10px;">الرسالة / Message:</h3>
          <div style="background: #f8fafc; border-radius: 8px; padding: 16px; color: #334155; line-height: 1.7; white-space: pre-wrap; border-left: 4px solid #48BB78;">
${escapeHtml(message)}
          </div>

          <p style="color: #94a3b8; font-size: 0.8rem; margin-top: 24px; text-align: center;">
            هذه الرسالة أُرسلت تلقائياً من نموذج التواصل على safarsmart.com
          </p>
        </div>
      </div>
    `;

        const transporter = createTransporter();

        const mailOptions = {
            from: `"SafarSmart Contact" <${process.env.SMTP_USER}>`,
            to: toAddress,
            replyTo: email,          // so you can click Reply and reach the sender directly
            subject: subjectLine,
            html: htmlBody,
            text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject || 'N/A'}\n\nMessage:\n${message}`,
        };

        await transporter.sendMail(mailOptions);

        console.log(`✅ Contact email sent from ${email} (${name}) at ${new Date().toISOString()}.`);

        res.json({ status: 'success', message: 'Message sent successfully.' });

    } catch (error) {
        console.error('❌ Contact email error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to send email. Please try again later.',
        });
    }
});

// Simple HTML-escape helper – prevents XSS in email body
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

module.exports = router;
