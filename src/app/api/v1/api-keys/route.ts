import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { apiKeyPreview, hashApiKey } from '@/lib/api-key-auth';
import { requireSession } from '@/lib/server-auth';

export async function GET(request: Request) {
  const authError = await requireSession(request, 'module_integrations');
  if (authError) return authError;

  try {
    const keys = await prisma.apiKey.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json({
      success: true,
      keys: keys.map(({ key, ...record }) => ({ ...record, key: undefined, keyPreview: apiKeyPreview(key) })),
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Banco de dados indisponível.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const authError = await requireSession(request, 'module_integrations');
  if (authError) return authError;

  try {
    const { name } = await request.json();
    if (typeof name !== 'string' || name.trim().length < 3 || name.length > 100) {
      return NextResponse.json({ success: false, error: 'Informe um nome entre 3 e 100 caracteres.' }, { status: 400 });
    }

    const rawKey = `awp_live_${crypto.randomBytes(32).toString('base64url')}`;
    const newKey = await prisma.apiKey.create({
      data: { name: name.trim(), key: hashApiKey(rawKey), status: 'active' },
    });
    return NextResponse.json({
      success: true,
      key: { ...newKey, key: rawKey, keyPreview: apiKeyPreview(rawKey) },
      warning: 'Copie a chave agora. Ela não será exibida novamente.',
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Não foi possível gerar a chave.' }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const authError = await requireSession(request, 'module_integrations');
  if (authError) return authError;

  try {
    const { id } = await request.json();
    if (typeof id !== 'string' || !id) return NextResponse.json({ success: false, error: 'ID inválido.' }, { status: 400 });
    await prisma.apiKey.update({ where: { id }, data: { status: 'revoked' } });
    return NextResponse.json({ success: true, message: 'Chave revogada com sucesso.' });
  } catch {
    return NextResponse.json({ success: false, error: 'Não foi possível revogar a chave.' }, { status: 503 });
  }
}
