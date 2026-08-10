import { NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api-key-auth';
import { dispatchWebhookEvent } from '@/lib/webhook-dispatcher';
import { getStoredSMTPAccounts } from '@/lib/email-store';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  const authResult = await validateApiKey(request);
  if (!authResult.valid) {
    return NextResponse.json({ success: false, error: authResult.error }, { status: 401 });
  }

  try {
    const { to, subject, bodyHtml, bodyText, smtpAccountId } = await request.json();

    if (!to || !subject || (!bodyHtml && !bodyText)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Parâmetros obrigatórios incompletos: "to", "subject" e ("bodyHtml" ou "bodyText")',
        },
        { status: 400 }
      );
    }

    const accounts = getStoredSMTPAccounts().filter((a) => a.status === 'active');
    const selectedAccount = smtpAccountId ? accounts.find((a) => a.id === smtpAccountId) : accounts[0];

    if (!selectedAccount) {
      await new Promise((r) => setTimeout(r, 400));
      const messageId = `AWP_EMAIL_DEMO_${Date.now()}`;

      dispatchWebhookEvent('email.sent', {
        messageId,
        to,
        subject,
        isDemo: true,
        sentAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        isDemo: true,
        messageId,
        to,
        subject,
        status: 'SENT',
      });
    }

    const transporter = nodemailer.createTransport({
      host: selectedAccount.host,
      port: selectedAccount.port,
      secure: selectedAccount.secure,
      auth: {
        user: selectedAccount.user,
        pass: selectedAccount.pass,
      },
    });

    const info = await transporter.sendMail({
      from: `"${selectedAccount.fromName}" <${selectedAccount.fromEmail}>`,
      to,
      subject,
      text: bodyText || undefined,
      html: bodyHtml || undefined,
      replyTo: selectedAccount.replyTo || undefined,
    });

    dispatchWebhookEvent('email.sent', {
      messageId: info.messageId,
      to,
      subject,
      from: selectedAccount.fromEmail,
      sentAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      to,
      subject,
      status: 'SENT',
    });
  } catch (err: any) {
    dispatchWebhookEvent('email.error', {
      error: err.message || 'Erro ao enviar e-mail',
      failedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: false, error: err.message || 'Erro interno ao enviar e-mail' }, { status: 500 });
  }
}
