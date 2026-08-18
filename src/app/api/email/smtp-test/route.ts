import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { requireSession } from '@/lib/server-auth';
import { assertSafeHost } from '@/lib/network-safety';

export async function POST(request: Request) {
  const authError = await requireSession(request, 'can_manage_smtp');
  if (authError) return authError;
  try {
    const { host, port, secure, user, pass, fromEmail, testRecipient } = await request.json();

    if (!host || !port || !user || !pass) {
      return NextResponse.json({
        success: false,
        error: 'Host, porta, usuário e senha são obrigatórios.',
      });
    }

    if (host.includes('exemplo') || user.includes('seuemail@')) {
      return NextResponse.json({
        success: true,
        isDemo: true,
        message: 'Modo Demonstrativo: Preencha as credenciais SMTP reais do seu provedor para testar.',
      });
    }

    const senderEmail = fromEmail || user;
    const smtpHostDomain = String(host).trim();
    const smtpPort = Number(port);
    if (![465, 587, 2525].includes(smtpPort)) {
      return NextResponse.json({ success: false, error: 'Porta SMTP não permitida.' }, { status: 400 });
    }
    await assertSafeHost(smtpHostDomain, 'SMTP_ALLOWED_HOSTS');

    const transporter = nodemailer.createTransport({
      host: smtpHostDomain,
      port: smtpPort,
      secure: Boolean(secure),
      requireTLS: !Boolean(secure),
      name: smtpHostDomain, // HELO matches hostinger/gmail SMTP server domain
      auth: { user, pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });

    // Verify SMTP connection
    await transporter.verify();

    // If a test recipient is provided, send a quick test email
    if (testRecipient) {
      await transporter.sendMail({
        from: `"${user}" <${senderEmail}>`,
        to: testRecipient,
        subject: '🚀 Teste de Conexão SMTP - AllWhatsPy Web',
        text: 'Olá! Seu servidor SMTP foi configurado e testado com sucesso no AllWhatsPy Web.',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #0f172a; color: #f8fafc; border-radius: 10px;">
            <h2 style="color: #10b981;">🟢 Servidor SMTP Conectado com Sucesso!</h2>
            <p>Seu servidor <strong>${host}:${port}</strong> está pronto para realizar disparos de e-mail em massa com o AllWhatsPy Web.</p>
            <hr style="border-color: #334155; margin: 20px 0;"/>
            <p style="font-size: 12px; color: #94a3b8;">Enviado via AllWhatsPy Web Multi-Channel Platform.</p>
          </div>
        `,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Conexão SMTP verificada com sucesso!',
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Falha ao conectar com o servidor SMTP',
    });
  }
}
