import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// Helper to convert HTML content into a clean plain text version for anti-spam filters
function htmlToPlainText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
}

export async function POST(request: Request) {
  try {
    const { smtpAccount, recipient, subject, bodyHtml, replyTo } = await request.json();

    if (!smtpAccount || !recipient || !subject || !bodyHtml) {
      return NextResponse.json({
        success: false,
        error: 'SMTP, Destinatário, Assunto e Corpo do e-mail são obrigatórios.',
      });
    }

    const { host, port, secure, user, pass, fromName, fromEmail } = smtpAccount;

    if (!host || host.includes('exemplo') || user.includes('seuemail@')) {
      // Demo simulated send latency
      await new Promise((r) => setTimeout(r, 700));
      return NextResponse.json({
        success: true,
        isDemo: true,
        messageId: `DEMO_EMAIL_${Date.now()}`,
        recipient: typeof recipient === 'string' ? recipient : recipient.email,
      });
    }

    const targetEmail = typeof recipient === 'string' ? recipient : recipient.email;
    const senderEmail = fromEmail || user;
    const senderDomain = senderEmail.includes('@') ? senderEmail.split('@')[1] : 'domain.com';

    // Create Nodemailer transport with sender domain alignment
    const transporter = nodemailer.createTransport({
      host: String(host).trim(),
      port: Number(port),
      secure: Boolean(secure),
      name: senderDomain,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false,
      },
    });

    const senderHeader = fromName ? `"${fromName}" <${senderEmail}>` : senderEmail;
    const plainText = htmlToPlainText(bodyHtml);
    const customMessageId = `<${Date.now()}.${Math.random().toString(36).substring(2, 8)}@${senderDomain}>`;

    const info = await transporter.sendMail({
      from: senderHeader,
      to: targetEmail,
      replyTo: replyTo || senderEmail,
      subject: subject,
      html: bodyHtml,
      text: plainText, // Crucial for anti-spam filters (Multipart/Alternative)
      messageId: customMessageId,
      headers: {
        // Essential anti-spam headers required by Gmail & Yahoo
        'List-Unsubscribe': `<mailto:${senderEmail}?subject=Unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Mailer': 'AllWhatsPy-Web-Mailer/1.0',
        'X-Report-Abuse': `mailto:${senderEmail}`,
      },
    });

    return NextResponse.json({
      success: true,
      messageId: info.messageId || 'OK',
      recipient: targetEmail,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Erro ao enviar e-mail via SMTP',
    });
  }
}
