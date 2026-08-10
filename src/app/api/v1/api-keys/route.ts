import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

// Fallback memory store if DB is offline
const inMemoryKeys: Array<{ id: string; name: string; key: string; status: string; createdAt: string }> = [
  {
    id: 'key_demo_default',
    name: 'Chave Padrão Demo CRM',
    key: 'awp_live_demo_123456',
    status: 'active',
    createdAt: new Date().toLocaleString('pt-BR'),
  },
];

export async function GET() {
  try {
    const keys = await prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ success: true, keys });
  } catch {
    return NextResponse.json({ success: true, keys: inMemoryKeys });
  }
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: 'O nome da chave de API é obrigatório' }, { status: 400 });
    }

    const randomBytes = crypto.randomBytes(18).toString('hex');
    const generatedKey = `awp_live_${randomBytes}`;

    try {
      const newKey = await prisma.apiKey.create({
        data: {
          name: name.trim(),
          key: generatedKey,
          status: 'active',
        },
      });

      return NextResponse.json({ success: true, key: newKey });
    } catch {
      const memoryKey = {
        id: `key_${Date.now()}`,
        name: name.trim(),
        key: generatedKey,
        status: 'active',
        createdAt: new Date().toLocaleString('pt-BR'),
      };
      inMemoryKeys.unshift(memoryKey);
      return NextResponse.json({ success: true, key: memoryKey });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Erro ao gerar chave de API' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID da chave é obrigatório' }, { status: 400 });
    }

    try {
      await prisma.apiKey.update({
        where: { id },
        data: { status: 'revoked' },
      });
      return NextResponse.json({ success: true, message: 'Chave revogada com sucesso' });
    } catch {
      const found = inMemoryKeys.find((k) => k.id === id);
      if (found) found.status = 'revoked';
      return NextResponse.json({ success: true, message: 'Chave revogada com sucesso (Modo Local)' });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Erro ao revogar chave' }, { status: 500 });
  }
}
