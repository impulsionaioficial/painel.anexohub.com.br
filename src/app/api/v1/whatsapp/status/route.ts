import { NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api-key-auth';
import { getStoredConfig } from '@/lib/evolution-store';

export async function GET(request: Request) {
  const authResult = await validateApiKey(request);
  if (!authResult.valid) {
    return NextResponse.json({ success: false, error: authResult.error }, { status: 401 });
  }

  const config = getStoredConfig();

  if (!config.baseUrl || config.baseUrl.includes('exemplo.com')) {
    return NextResponse.json({
      success: true,
      isDemo: true,
      instanceName: config.instanceName || 'instancia_demo',
      state: 'open',
      profileName: 'Atendimento WhatsApp Demo',
      connectedAt: new Date().toISOString(),
    });
  }

  try {
    const cleanBaseUrl = config.baseUrl.replace(/\/$/, '');
    const res = await fetch(`${cleanBaseUrl}/instance/connectionState/${config.instanceName}`, {
      headers: { apikey: config.apiKey },
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({
        success: true,
        instanceName: config.instanceName,
        state: data.instance?.state || 'unknown',
        data,
      });
    } else {
      return NextResponse.json({
        success: false,
        instanceName: config.instanceName,
        state: 'close',
        error: 'Instância desconectada ou VPS inacessível',
      });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
