import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

// Fallback memory store if DB is offline
const inMemoryWebhooks: Array<{
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  status: string;
  createdAt: string;
}> = [];

export async function GET() {
  try {
    const webhooks = await prisma.webhook.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { logs: true },
        },
      },
    });
    return NextResponse.json({ success: true, webhooks });
  } catch {
    return NextResponse.json({ success: true, webhooks: inMemoryWebhooks });
  }
}

export async function POST(request: Request) {
  try {
    const { name, url, events } = await request.json();

    if (!name || !url) {
      return NextResponse.json({ success: false, error: 'Nome e URL do Webhook são obrigatórios' }, { status: 400 });
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json({ success: false, error: 'URL do Webhook é inválida' }, { status: 400 });
    }

    const secret = `whsec_${crypto.randomBytes(16).toString('hex')}`;
    const selectedEvents = Array.isArray(events) && events.length > 0 ? events : ['whatsapp.message.sent', 'whatsapp.message.error'];

    try {
      const webhook = await prisma.webhook.create({
        data: {
          name: name.trim(),
          url: url.trim(),
          events: selectedEvents,
          secret,
          status: 'active',
        },
      });

      return NextResponse.json({ success: true, webhook });
    } catch {
      const memoryWebhook = {
        id: `wh_${Date.now()}`,
        name: name.trim(),
        url: url.trim(),
        events: selectedEvents,
        secret,
        status: 'active',
        createdAt: new Date().toLocaleString('pt-BR'),
      };
      inMemoryWebhooks.unshift(memoryWebhook);
      return NextResponse.json({ success: true, webhook: memoryWebhook });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Erro ao cadastrar webhook' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID do webhook é obrigatório' }, { status: 400 });
    }

    try {
      await prisma.webhook.delete({
        where: { id },
      });
      return NextResponse.json({ success: true, message: 'Webhook removido com sucesso' });
    } catch {
      const idx = inMemoryWebhooks.findIndex((w) => w.id === id);
      if (idx !== -1) inMemoryWebhooks.splice(idx, 1);
      return NextResponse.json({ success: true, message: 'Webhook removido com sucesso' });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Erro ao remover webhook' }, { status: 500 });
  }
}
