import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { baseUrl, apiKey, instanceName, phone, message } = await request.json();

    if (!phone || !message) {
      return NextResponse.json({
        success: false,
        error: 'Telefone e mensagem são obrigatórios',
      });
    }

    // Clean phone number format
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
      cleanPhone = '55' + cleanPhone;
    }

    if (!baseUrl || !apiKey || !instanceName || baseUrl.includes('exemplo.com')) {
      // Demo mode simulated send with small random latency
      await new Promise((r) => setTimeout(r, 600));
      return NextResponse.json({
        success: true,
        isDemo: true,
        messageId: `DEMO_MSG_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        phone: cleanPhone,
      });
    }

    const cleanBaseUrl = baseUrl.replace(/\/$/, '');

    // Evolution API text message endpoint
    const res = await fetch(`${cleanBaseUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: cleanPhone,
        text: message,
        options: {
          delay: 1200,
          presence: 'composing',
          linkPreview: true,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({
        success: false,
        error: `Erro Evolution (${res.status}): ${errText}`,
        phone: cleanPhone,
      });
    }

    const data = await res.json();
    return NextResponse.json({
      success: true,
      messageId: data.key?.id || data.messageId || 'OK',
      phone: cleanPhone,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Erro interno ao enviar mensagem',
    });
  }
}
