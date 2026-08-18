import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/server-auth';
import { assertSafeEvolutionBaseUrl } from '@/lib/network-safety';

function normalizeState(val: any): string {
  if (!val) return 'close';
  const str = String(val).toLowerCase();
  if (str.includes('open') || str.includes('connected') || str.includes('online') || str.includes('200')) {
    return 'open';
  }
  if (str.includes('connecting')) {
    return 'connecting';
  }
  return 'close';
}

export async function POST(request: Request) {
  const authError = await requireSession(request, 'module_whatsapp_config');
  if (authError) return authError;
  try {
    const { baseUrl, apiKey, instanceName } = await request.json();

    if (!baseUrl || !apiKey || !instanceName || baseUrl.includes('exemplo.com')) {
      return NextResponse.json({
        success: true,
        isDemo: true,
        instance: {
          instanceName: instanceName || 'allwhatspy_demo',
          state: 'close',
        },
      });
    }

    const cleanBaseUrl = await assertSafeEvolutionBaseUrl(baseUrl);
    const res = await fetch(`${cleanBaseUrl}/instance/connectionState/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json({
        success: false,
        error: `Evolution API erro ${res.status}: ${errorText}`,
        instance: { instanceName, state: 'close' },
      });
    }

    const data = await res.json();
    const rawState =
      data.instance?.state ||
      data.instance?.status ||
      data.instance?.connectionStatus ||
      data.connectionState?.state ||
      data.state ||
      data.status ||
      'close';

    const normalized = normalizeState(rawState);

    return NextResponse.json({
      success: true,
      instance: {
        instanceName: data.instance?.instanceName || instanceName,
        state: normalized,
        rawState,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Erro ao conectar à VPS',
      instance: { instanceName: 'instancia', state: 'close' },
    });
  }
}
