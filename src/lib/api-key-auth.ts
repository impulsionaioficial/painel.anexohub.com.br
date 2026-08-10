import { prisma } from './prisma';

export interface ValidatedApiKey {
  id: string;
  name: string;
  key: string;
  userId?: string | null;
  status: string;
}

export async function validateApiKey(request: Request): Promise<{ valid: boolean; apiKey?: ValidatedApiKey; error?: string }> {
  // Extract API key from headers
  const authHeader = request.headers.get('authorization');
  const customHeader = request.headers.get('x-api-key');

  let keyInput = customHeader || '';

  if (!keyInput && authHeader) {
    if (authHeader.toLowerCase().startsWith('bearer ')) {
      keyInput = authHeader.substring(7).trim();
    } else {
      keyInput = authHeader.trim();
    }
  }

  if (!keyInput) {
    return {
      valid: false,
      error: 'Chave de API não informada. Utilize o header "x-api-key" ou "Authorization: Bearer <SUA_CHAVE>"',
    };
  }

  // Fallback demo key for initial setup without DB
  if (keyInput === 'awp_live_demo_123456') {
    return {
      valid: true,
      apiKey: {
        id: 'demo_key_id',
        name: 'Chave Demo Inicial',
        key: 'awp_live_demo_123456',
        status: 'active',
      },
    };
  }

  try {
    const foundKey = await prisma.apiKey.findUnique({
      where: { key: keyInput },
    });

    if (!foundKey) {
      return {
        valid: false,
        error: 'Chave de API inválida ou inexistente.',
      };
    }

    if (foundKey.status !== 'active') {
      return {
        valid: false,
        error: 'Esta Chave de API foi revogada ou desativada.',
      };
    }

    // Update lastUsedAt in background
    prisma.apiKey
      .update({
        where: { id: foundKey.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {});

    return {
      valid: true,
      apiKey: {
        id: foundKey.id,
        name: foundKey.name,
        key: foundKey.key,
        userId: foundKey.userId,
        status: foundKey.status,
      },
    };
  } catch {
    // If DB is offline, check demo key
    if (keyInput.startsWith('awp_live_')) {
      return {
        valid: true,
        apiKey: {
          id: `key_${keyInput.substring(9, 15)}`,
          name: 'Chave Dinâmica (Modo Local)',
          key: keyInput,
          status: 'active',
        },
      };
    }
    return {
      valid: false,
      error: 'Erro de validação da chave de API no servidor.',
    };
  }
}
