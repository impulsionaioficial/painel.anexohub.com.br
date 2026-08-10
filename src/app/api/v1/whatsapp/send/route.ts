import { NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api-key-auth';
import { dispatchWebhookEvent } from '@/lib/webhook-dispatcher';
import { getStoredConfig, parseSpintax } from '@/lib/evolution-store';

export async function POST(request: Request) {
  // Validate API Key
  const authResult = await validateApiKey(request);
  if (!authResult.valid) {
    return NextResponse.json(
      {
        success: false,
        error: authResult.error || 'Não autorizado. Chave de API inválida.',
      },
      { status: 401 }
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
        const regex = new RegExp(`\\{${key}\\}`, 'gi');
        finalMessage = finalMessage.replace(regex, variables[key]);
      });
    }
    finalMessage = parseSpintax(finalMessage);

    // Get Evolution API config from store
    const config = getStoredConfig();
    const targetInstance = instanceName || config.instanceName || 'default';
    const baseUrl = config.baseUrl;
    const apiKey = config.apiKey;

    // Check if live VPS config exists or demo
    if (!baseUrl || !apiKey || baseUrl.includes('exemplo.com')) {
      await new Promise((r) => setTimeout(r, 400));

      const messageId = `AWP_API_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // Webhook dispatch
      dispatchWebhookEvent('whatsapp.message.sent', {
        messageId,
        phone: cleanPhone,
        message: finalMessage,
        instanceName: targetInstance,
        isDemo: true,
        sentAt: new Date().toISOString(),
        apiKeyName: authResult.apiKey?.name,
      });

      return NextResponse.json({
        success: true,
        isDemo: true,
        messageId,
        phone: cleanPhone,
        message: finalMessage,
        instanceName: targetInstance,
        status: 'SENT',
      });
    }

    // Live request to Evolution API
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
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
