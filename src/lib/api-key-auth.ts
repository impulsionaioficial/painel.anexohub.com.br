import 'server-only';

import crypto from 'crypto';
import { prisma } from './prisma';
import { checkRateLimit } from './rate-limit';

export interface ValidatedApiKey {
  id: string;
  name: string;
  userId?: string | null;
  status: string;
}

export function hashApiKey(key: string): string {
  return `sha256:${crypto.createHash('sha256').update(key).digest('hex')}`;
}

export function apiKeyPreview(storedKey: string): string {
  if (storedKey.startsWith('sha256:')) return 'awp_live_••••••••';
  return storedKey.length > 8 ? `${storedKey.slice(0, 9)}••••${storedKey.slice(-4)}` : '••••••••';
}

export async function validateApiKey(request: Request): Promise<{ valid: boolean; apiKey?: ValidatedApiKey; error?: string; status?: number }> {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (!Number.isFinite(contentLength) || contentLength > 12 * 1024 * 1024) {
    return { valid: false, error: 'Corpo da requisição acima do limite.', status: 413 };
  }
  const rateLimitError = checkRateLimit(request, 'api-key', 120, 60_000);
  if (rateLimitError) return { valid: false, error: rateLimitError.error, status: rateLimitError.status };

  const authHeader = request.headers.get('authorization');
  const customHeader = request.headers.get('x-api-key');
  let keyInput = customHeader || '';

  if (!keyInput && authHeader) {
    keyInput = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.substring(7).trim() : authHeader.trim();
  }
  if (!keyInput || keyInput.length > 256) {
    return { valid: false, error: 'Chave de API ausente ou inválida.', status: 401 };
  }

  try {
    const hashedKey = hashApiKey(keyInput);
    let foundKey = await prisma.apiKey.findUnique({ where: { key: hashedKey } });

    if (!foundKey) {
      const legacyKey = await prisma.apiKey.findUnique({ where: { key: keyInput } });
      if (legacyKey) {
        foundKey = await prisma.apiKey.update({ where: { id: legacyKey.id }, data: { key: hashedKey } });
      }
    }

    if (!foundKey || foundKey.status !== 'active') {
      return { valid: false, error: 'Chave de API inválida ou revogada.', status: 401 };
    }

    await prisma.apiKey.update({ where: { id: foundKey.id }, data: { lastUsedAt: new Date() } });
    return {
      valid: true,
      apiKey: {
        id: foundKey.id,
        name: foundKey.name,
        userId: foundKey.userId,
        status: foundKey.status,
      },
    };
  } catch {
    return { valid: false, error: 'Serviço de autenticação da API indisponível.', status: 503 };
  }
}
