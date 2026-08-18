import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { inMemoryWebhookLogs, sendWebhookHttpRequest } from '@/lib/webhook-dispatcher';
import { requireSession } from '@/lib/server-auth';

export async function GET(request: Request) {
  const authError = await requireSession(request, 'module_integrations');
  if (authError) return authError;
  try {
    const logs = await prisma.webhookLog.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        webhook: {
          select: { name: true, url: true },
        },
      },
    });

    const formatted = logs.map((l) => ({
      id: l.id,
      webhookId: l.webhookId,
      webhookName: l.webhook?.name || 'Webhook Desconhecido',
      webhookUrl: l.webhook?.url || '',
      event: l.event,
      payload: l.payload,
      statusCode: l.statusCode,
      responseBody: l.responseBody,
      status: l.status,
      createdAt: new Date(l.createdAt).toLocaleString('pt-BR'),
    }));

    return NextResponse.json({ success: true, logs: formatted });
  } catch {
    return NextResponse.json({ success: true, logs: inMemoryWebhookLogs });
  }
}

// POST endpoint to re-send (retry) a log
export async function POST(request: Request) {
  const authError = await requireSession(request, 'module_integrations');
  if (authError) return authError;
  try {
    const { logId } = await request.json();
    if (!logId) {
      return NextResponse.json({ success: false, error: 'logId é obrigatório' }, { status: 400 });
    }

    try {
      const log = await prisma.webhookLog.findUnique({
        where: { id: logId },
        include: { webhook: true },
      });

      if (!log || !log.webhook) {
        return NextResponse.json({ success: false, error: 'Log de Webhook ou Webhook original não encontrado' }, { status: 404 });
      }

      const result = await sendWebhookHttpRequest(
        log.webhook.id,
        log.webhook.name,
        log.webhook.url,
        log.webhook.secret,
        log.event,
        log.payload
      );

      return NextResponse.json({ success: true, result });
    } catch {
      const memoryLog = inMemoryWebhookLogs.find((l) => l.id === logId);
      if (!memoryLog) {
        return NextResponse.json({ success: false, error: 'Log não encontrado na memória' }, { status: 404 });
      }

      const result = await sendWebhookHttpRequest(
        memoryLog.webhookId,
        memoryLog.webhookName || 'Webhook',
        memoryLog.webhookUrl || '',
        'secret',
        memoryLog.event,
        memoryLog.payload
      );

      return NextResponse.json({ success: true, result });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Erro ao re-enviar webhook' }, { status: 500 });
  }
}
