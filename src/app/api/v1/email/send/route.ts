import { NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api-key-auth';
import { dispatchWebhookEvent } from '@/lib/webhook-dispatcher';
import nodemailer from 'nodemailer';
import { getServerSmtpConfig } from '@/lib/server-config';
import { assertSafeHost } from '@/lib/network-safety';

export async function POST(request: Request) {
  const authResult = await validateApiKey(request);
  if (!authResult.valid) {
    return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status || 401 });
  }

  try {
    const { to, subject, bodyHtml, bodyText } = await request.json();

    if (!to || !subject || (!bodyHtml && !bodyText)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Parâmetros obrigatórios incompletos: "to", "subject" e ("bodyHtml" ou "bodyText")',
        },
        { status: 400 }
      );
    }
    if (String(subject).length > 998 || String(bodyHtml || bodyText).length > 1_000_000) {
      return NextResponse.json({ success: false, error: 'Conteúdo do e-mail acima do limite.' }, { status: 413 });
    }

    const selectedAccount = getServerSmtpConfig();
    if (!selectedAccount.host || !selectedAccount.port || !selectedAccount.user || !selectedAccount.pass || !selectedAccount.fromEmail) {
      return NextResponse.json({ success: false, error: 'SMTP não configurado no servidor.' }, { status: 503 });
    }
    if (![465, 587, 2525].includes(selectedAccount.port)) {
      return NextResponse.json({ success: false, error: 'Porta SMTP não permitida.' }, { status: 400 });
    }
    await assertSafeHost(selectedAccount.host, 'SMTP_ALLOWED_HOSTS');

    const transporter = nodemailer.createTransport({
      host: selectedAccount.host,
      port: selectedAccount.port,
      secure: selectedAccount.secure,
      requireTLS: !selectedAccount.secure,
      auth: {
        user: selectedAccount.user,
        pass: selectedAccount.pass,
      },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
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
