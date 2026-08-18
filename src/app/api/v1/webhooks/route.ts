import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/server-auth';
import { assertSafeOutboundUrl } from '@/lib/network-safety';
import { encryptSecret } from '@/lib/secret-crypto';

const ALLOWED_EVENTS = new Set([
  '*',
  'whatsapp.message.sent',
  'whatsapp.message.error',
  'whatsapp.connection.update',
  'email.sent',
  'email.error',
]);

export async function GET(request: Request) {
  const authError = await requireSession(request, 'module_integrations');
  if (authError) return authError;

  try {
    const webhooks = await prisma.webhook.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { logs: true } } },
    });
    return NextResponse.json({
      success: true,
      webhooks: webhooks.map(({ secret: _secret, ...webhook }) => ({ ...webhook, secretConfigured: true })),
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Banco de dados indisponível.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const authError = await requireSession(request, 'module_integrations');
  if (authError) return authError;

  try {
    const { name, url, events } = await request.json();
    if (typeof name !== 'string' || name.trim().length < 3 || name.length > 100 || typeof url !== 'string') {
      return NextResponse.json({ success: false, error: 'Nome ou URL inválidos.' }, { status: 400 });
    }
    await assertSafeOutboundUrl(url, { allowlistVariable: 'WEBHOOK_ALLOWED_HOSTS' });

    const selectedEvents = Array.isArray(events) && events.length > 0 ? events : ['whatsapp.message.sent', 'whatsapp.message.error'];
    if (selectedEvents.length > 10 || selectedEvents.some((event) => typeof event !== 'string' || !ALLOWED_EVENTS.has(event))) {
      return NextResponse.json({ success: false, error: 'Lista de eventos inválida.' }, { status: 400 });
    }

    const secret = `whsec_${crypto.randomBytes(32).toString('base64url')}`;
    const webhook = await prisma.webhook.create({
      data: { name: name.trim(), url: url.trim(), events: selectedEvents, secret: encryptSecret(secret), status: 'active' },
    });
    return NextResponse.json({
      success: true,
      webhook: { ...webhook, secret },
      warning: 'Copie o segredo agora. Ele não será exibido novamente.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível cadastrar o webhook.';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const authError = await requireSession(request, 'module_integrations');
  if (authError) return authError;

  try {
    const { id } = await request.json();
    if (typeof id !== 'string' || !id) return NextResponse.json({ success: false, error: 'ID inválido.' }, { status: 400 });
    await prisma.webhook.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Webhook removido com sucesso.' });
  } catch {
    return NextResponse.json({ success: false, error: 'Não foi possível remover o webhook.' }, { status: 503 });
  }
}
