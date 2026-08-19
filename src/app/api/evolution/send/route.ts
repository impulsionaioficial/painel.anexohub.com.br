import { NextResponse } from 'next/server';
import { ErrorCategoryType } from '@/lib/types';
import { requireSession } from '@/lib/server-auth';
import { assertSafeEvolutionBaseUrl } from '@/lib/network-safety';
import {
  EvolutionMessageSequenceError,
  sendEvolutionMessageSequence,
} from '@/lib/evolution-message-sequence';
import { splitMessageSequence } from '@/lib/message-sequence';

function categorizeError(errText: string, status: number): { category: ErrorCategoryType; title: string } {
  const text = errText.toLowerCase();

  if (text.includes('not registered') || text.includes('exists: false') || text.includes('exists false') || text.includes('invalid number') || text.includes('not on whatsapp')) {
    return {
      category: 'NUMBER_NOT_EXISTS',
      title: '🚫 Número Não Registrado no WhatsApp',
    };
  }

  if (status === 401 || status === 404 || text.includes('unauthorized') || text.includes('session closed') || text.includes('connection closed') || text.includes('logged out') || text.includes('instance disconnected') || text.includes('instance not found') || text.includes('instance close') || text.includes('not connected')) {
    return {
      category: 'SENDER_BLOCKED',
      title: '🔒 Sessão Desconectada / Número Disparador Suspenso',
    };
  }

  if (status === 403 || text.includes('blocked') || text.includes('forbidden') || text.includes('user blocked')) {
    return {
      category: 'USER_BLOCKED',
      title: '⛔ Bloqueado pelo Destinatário',
    };
  }

  if (text.includes('timeout') || text.includes('econnrefused') || text.includes('fetch failed') || status === 408 || status === 502 || status === 503 || status === 504) {
    return {
      category: 'TIMEOUT',
      title: '📡 Timeout / VPS Sem Resposta',
    };
  }

  return {
    category: 'UNKNOWN',
    title: `❌ Erro da API (${status})`,
  };
}

export async function POST(request: Request) {
  const authError = await requireSession(request, 'module_whatsapp_disparador');
  if (authError) return authError;
  try {
    const {
      baseUrl,
      apiKey,
      instanceName,
      phone,
      message,
      attachment,
      typingSimulation,
      startMessagePart,
    } = await request.json();

    if (!phone) {
      return NextResponse.json({
        success: false,
        errorCategory: 'UNKNOWN',
        errorTitle: 'Dados incompletos',
        error: 'Telefone ou JID do destinatário é obrigatório',
      });
    }
    if (typeof message === 'string' && message.length > 20_000) {
      return NextResponse.json({ success: false, error: 'Mensagem acima de 20.000 caracteres.' }, { status: 400 });
    }
    if (attachment?.base64 && String(attachment.base64).length > 10 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'Anexo acima do limite de 7,5 MB.' }, { status: 413 });
    }

    const rawInput = String(phone).trim();
    let recipient = rawInput;

    // If input does NOT contain '@', perform standard phone formatting
    if (!rawInput.includes('@')) {
      let cleanDigits = rawInput.replace(/\D/g, '');
      if (cleanDigits.length === 10 || cleanDigits.length === 11) {
        cleanDigits = '55' + cleanDigits;
      }
      recipient = cleanDigits || rawInput;
    }

    if (!baseUrl || !apiKey || !instanceName || baseUrl.includes('exemplo.com')) {
      await new Promise((r) => setTimeout(r, 600));

      if (recipient.endsWith('00')) {
        return NextResponse.json({
          success: false,
          isDemo: true,
          errorCategory: 'NUMBER_NOT_EXISTS',
          errorTitle: '🚫 Número Não Registrado no WhatsApp',
          error: 'O número informado não possui uma conta ativa no WhatsApp (exists: false).',
          phone: recipient,
        });
      }

      return NextResponse.json({
        success: true,
        isDemo: true,
        messageId: `DEMO_MSG_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        messageIds: splitMessageSequence(message).map((_, index) => `DEMO_MSG_${Date.now()}_${index + 1}`),
        phone: recipient,
      });
    }

    const cleanBaseUrl = await assertSafeEvolutionBaseUrl(baseUrl);
    const result = await sendEvolutionMessageSequence({
      baseUrl: cleanBaseUrl,
      apiKey,
      instanceName,
      recipient,
      message,
      attachment,
      typingSimulation,
      startMessagePart,
    });
    return NextResponse.json({
      success: true,
      messageId: result.messageIds.at(-1) || 'OK',
      messageIds: result.messageIds,
      sentParts: result.sentParts,
      phone: result.recipient,
    });
  } catch (error: any) {
    const sequenceError = error instanceof EvolutionMessageSequenceError ? error : null;
    const errorStatus = sequenceError?.status || 500;
    const errorDetail = sequenceError?.detail || error.message || '';
    const parsedErr = categorizeError(errorDetail, errorStatus);

    return NextResponse.json({
      success: false,
      errorCategory: parsedErr.category,
      errorTitle: parsedErr.title,
      error: errorDetail || 'Erro interno ao enviar mensagem',
      nextMessagePart: sequenceError?.nextMessagePart,
      sentParts: sequenceError?.sentParts || 0,
    });
  }
}
