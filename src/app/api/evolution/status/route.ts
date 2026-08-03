import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { baseUrl, apiKey, instanceName } = await request.json();

    if (!baseUrl || !apiKey || !instanceName || baseUrl.includes('exemplo.com')) {
      // Demo mode fallback when VPS is not connected
      return NextResponse.json({
        success: true,
        isDemo: true,
        instance: {
          instanceName: instanceName || 'allwhatspy_demo',
          state: 'close',
        },
      });
    }

    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
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
    return NextResponse.json({
      success: true,
      instance: {
        instanceName: data.instance?.instanceName || instanceName,
        state: data.instance?.state || 'close',
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
