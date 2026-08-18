import { NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api-key-auth';
import { dispatchWebhookEvent } from '@/lib/webhook-dispatcher';
import { parseSpintax } from '@/lib/evolution-store';
import { getServerEvolutionConfig } from '@/lib/server-config';
import { assertSafeEvolutionBaseUrl } from '@/lib/network-safety';

export async function POST(request: Request) {
  // Validate API Key
  const authResult = await validateApiKey(request);
  if (!authResult.valid) {
    return NextResponse.json(
      {
        success: false,
        error: authResult.error || 'Não autorizado. Chave de API inválida.',
      },
      { status: authResult.status || 401 }
    );
  }

  try {
    const body = await request.json();
    const { phone, message, instanceName, attachment, variables } = body;

    if (!phone) {
      return NextResponse.json(
        {
          success: false,
          error: 'O parâmetro "phone" (número de telefone com DDD) é obrigatório.',
        },
        { status: 400 }
      );
    }

    if (!message && !attachment) {
      return NextResponse.json(
        {
          success: false,
          error: 'Informe "message" ou "attachment" para disparo.',
        },
        { status: 400 }
      );
    }
    if (typeof message === 'string' && message.length > 20_000) {
      return NextResponse.json({ success: false, error: 'Mensagem acima de 20.000 caracteres.' }, { status: 400 });
    }
    if (attachment?.base64 && String(attachment.base64).length > 10 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'Anexo acima do limite de 7,5 MB.' }, { status: 413 });
    }

    // Format phone
    let rawPhone = String(phone).trim();
    let cleanPhone = rawPhone;
    if (!rawPhone.includes('@')) {
      let digits = rawPhone.replace(/\D/g, '');
      if (digits.length === 10 || digits.length === 11) {
        digits = '55' + digits;
      }
      cleanPhone = digits;
    }

    // Parse variables if provided
    let finalMessage = message || '';
    if (variables && typeof variables === 'object') {
      Object.keys(variables).forEach((key) => {
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\{${escapedKey}\\}`, 'gi');
        finalMessage = finalMessage.replace(regex, String(variables[key]).slice(0, 2_000));
      });
    }
    finalMessage = parseSpintax(finalMessage);

    const config = getServerEvolutionConfig();
    const targetInstance = instanceName || config.instanceName;
    const baseUrl = config.baseUrl;
    const apiKey = config.apiKey;

    if (!baseUrl || !apiKey || !targetInstance) {
      return NextResponse.json({ success: false, error: 'Evolution API não configurada no servidor.' }, { status: 503 });
    }
    if (!/^[\w .-]{1,100}$/.test(targetInstance)) {
      return NextResponse.json({ success: false, error: 'Nome de instância inválido.' }, { status: 400 });
    }

    const cleanBaseUrl = await assertSafeEvolutionBaseUrl(baseUrl);
    let res: Response;

    if (attachment && attachment.base64) {
      let cleanBase64 = attachment.base64;
      if (cleanBase64.includes(',')) cleanBase64 = cleanBase64.split(',')[1];

      let mediaType = 'document';
      if (attachment.mimetype?.startsWith('image/')) mediaType = 'image';
      else if (attachment.mimetype?.startsWith('audio/')) mediaType = 'audio';
      else if (attachment.mimetype?.startsWith('video/')) mediaType = 'video';

      res = await fetch(`${cleanBaseUrl}/message/sendMedia/${targetInstance}`, {
        method: 'POST',
        headers: { apikey: apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: cleanPhone,
          mediatype: mediaType,
          mimetype: attachment.mimetype || 'application/octet-stream',
          caption: finalMessage,
          media: cleanBase64,
          fileName: attachment.name || 'arquivo',
          options: { delay: 1200, presence: 'composing' },
        }),
      });
    } else {
      res = await fetch(`${cleanBaseUrl}/message/sendText/${targetInstance}`, {
        method: 'POST',
        headers: { apikey: apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: cleanPhone,
          text: finalMessage,
          options: { delay: 1200, presence: 'composing', linkPreview: true },
        }),
      });
    }

    if (res.ok) {
      const data = await res.json();
      const messageId = data.key?.id || data.messageId || `AWP_${Date.now()}`;

      dispatchWebhookEvent('whatsapp.message.sent', {
        messageId,
        phone: cleanPhone,
        message: finalMessage,
        instanceName: targetInstance,
        sentAt: new Date().toISOString(),
        apiKeyName: authResult.apiKey?.name,
      });

      return NextResponse.json({
        success: true,
        messageId,
        phone: cleanPhone,
        instanceName: targetInstance,
        status: 'SENT',
      });
    } else {
      const errText = await res.text();

      dispatchWebhookEvent('whatsapp.message.error', {
        phone: cleanPhone,
        error: errText,
        statusCode: res.status,
        instanceName: targetInstance,
        failedAt: new Date().toISOString(),
        apiKeyName: authResult.apiKey?.name,
      });

      return NextResponse.json(
        {
          success: false,
          phone: cleanPhone,
          error: errText,
          statusCode: res.status,
        },
        { status: res.status >= 400 && res.status < 600 ? res.status : 400 }
      );
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Erro interno ao processar disparo de API' }, { status: 500 });
  }
}
