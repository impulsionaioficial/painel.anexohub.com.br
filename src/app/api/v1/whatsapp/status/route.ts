import { NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api-key-auth';
import { getServerEvolutionConfig } from '@/lib/server-config';
import { assertSafeEvolutionBaseUrl } from '@/lib/network-safety';

export async function GET(request: Request) {
  const authResult = await validateApiKey(request);
  if (!authResult.valid) {
    return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status || 401 });
  }

  const config = getServerEvolutionConfig();

  if (!config.baseUrl || !config.apiKey || !config.instanceName) {
    return NextResponse.json({ success: false, error: 'Evolution API não configurada no servidor.' }, { status: 503 });
  }

  try {
    const cleanBaseUrl = await assertSafeEvolutionBaseUrl(config.baseUrl);
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
