import { NextResponse } from 'next/server';
import { ErrorCategoryType } from '@/lib/types';
import { requireSession } from '@/lib/server-auth';
import { assertSafeEvolutionBaseUrl } from '@/lib/network-safety';

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
    const { baseUrl, apiKey, instanceName, phone, message, attachment } = await request.json();

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
        phone: recipient,
      });
    }

    const cleanBaseUrl = await assertSafeEvolutionBaseUrl(baseUrl);

    // Helper to send text message to a specific number/JID target
    const sendTextRequest = async (target: string) => {
      return fetch(`${cleanBaseUrl}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: target,
          text: message,
          options: {
            delay: 1200,
            presence: 'composing',
            linkPreview: true,
          },
        }),
        signal: AbortSignal.timeout(30_000),
      });
    };

    // If file attachment is provided, use sendMedia endpoint
    if (attachment && attachment.base64) {
      let mediaType = 'document';
      if (attachment.mimetype?.startsWith('image/')) mediaType = 'image';
      else if (attachment.mimetype?.startsWith('audio/')) mediaType = 'audio';
      else if (attachment.mimetype?.startsWith('video/')) mediaType = 'video';

      let cleanBase64 = attachment.base64;
      if (cleanBase64.includes(',')) {
        cleanBase64 = cleanBase64.split(',')[1];
      }

      const mediaRes = await fetch(`${cleanBaseUrl}/message/sendMedia/${instanceName}`, {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: recipient,
          mediatype: mediaType,
          mimetype: attachment.mimetype || 'application/octet-stream',
          caption: message || '',
          media: cleanBase64,
          fileName: attachment.name || 'arquivo',
          options: {
            delay: 1200,
            presence: 'composing',
          },
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!mediaRes.ok) {
        const errText = await mediaRes.text();
        const parsedErr = categorizeError(errText, mediaRes.status);
        return NextResponse.json({
          success: false,
          errorCategory: parsedErr.category,
          errorTitle: parsedErr.title,
          error: errText,
          phone: recipient,
        });
      }

      const mediaData = await mediaRes.json();
      return NextResponse.json({
        success: true,
        messageId: mediaData.key?.id || mediaData.messageId || 'OK',
        phone: recipient,
      });
    }

    // Text-only message sending
    let res = await sendTextRequest(recipient);
    let errText = '';

    if (!res.ok) {
      errText = await res.text();

      // Retry Fallback 1: If exists: false and target didn't have '@', try with @lid
      if ((errText.includes('exists:false') || errText.includes('exists":false') || errText.includes('not registered')) && !recipient.includes('@')) {
        console.log(`[SEND RETRY] Attempting @lid fallback for target: ${recipient}`);
        const fallbackRes = await sendTextRequest(`${recipient}@lid`);
        if (fallbackRes.ok) {
          res = fallbackRes;
        } else {
          // Retry Fallback 2: Try with @s.whatsapp.net explicitly
          console.log(`[SEND RETRY] Attempting @s.whatsapp.net fallback for target: ${recipient}`);
          const fallbackRes2 = await sendTextRequest(`${recipient}@s.whatsapp.net`);
          if (fallbackRes2.ok) {
            res = fallbackRes2;
          }
        }
      }
    }

    if (!res.ok) {
      const parsedErr = categorizeError(errText, res.status);
      return NextResponse.json({
        success: false,
        errorCategory: parsedErr.category,
        errorTitle: parsedErr.title,
        error: errText,
        phone: recipient,
      });
    }

    const data = await res.json();
    return NextResponse.json({
      success: true,
      messageId: data.key?.id || data.messageId || 'OK',
      phone: recipient,
    });
  } catch (error: any) {
    const parsedErr = categorizeError(error.message || '', 500);

    return NextResponse.json({
      success: false,
      errorCategory: parsedErr.category,
      errorTitle: parsedErr.title,
      error: error.message || 'Erro interno ao enviar mensagem',
    });
  }
}
