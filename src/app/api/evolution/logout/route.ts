import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { baseUrl, apiKey, instanceName } = await request.json();

    if (!baseUrl || !apiKey || !instanceName || baseUrl.includes('exemplo.com')) {
      return NextResponse.json({ success: true, isDemo: true });
    }

    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    const res = await fetch(`${cleanBaseUrl}/instance/logout/${instanceName}`, {
      method: 'DELETE',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json({
        success: false,
        error: `Erro ao desconectar (${res.status}): ${errorText}`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Erro de conexão ao desconectar',
    });
  }
}
