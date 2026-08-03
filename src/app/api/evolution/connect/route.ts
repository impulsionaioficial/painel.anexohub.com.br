import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { baseUrl, apiKey, instanceName } = await request.json();

    if (!baseUrl || !apiKey || !instanceName || baseUrl.includes('exemplo.com')) {
      // Demo mode SVG QR code simulation
      const mockQrBase64 = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="250" height="250" viewBox="0 0 250 250"><rect width="250" height="250" fill="%23111827"/><rect x="25" y="25" width="60" height="60" fill="%2310B981"/><rect x="35" y="35" width="40" height="40" fill="%23111827"/><rect x="165" y="25" width="60" height="60" fill="%2310B981"/><rect x="175" y="35" width="40" height="40" fill="%23111827"/><rect x="25" y="165" width="60" height="60" fill="%2310B981"/><rect x="35" y="175" width="40" height="40" fill="%23111827"/><rect x="100" y="100" width="50" height="50" fill="%2310B981"/><text x="125" y="235" font-family="sans-serif" font-size="12" fill="%239CA3AF" text-anchor="middle">Modo Demonstrativo (Configure sua VPS)</text></svg>';
      
      return NextResponse.json({
        success: true,
        isDemo: true,
        qrcode: {
          base64: mockQrBase64,
          pairingCode: 'AWP-DEMO-1234',
        },
      });
    }

    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    
    // First attempt: Connect existing instance
    let res = await fetch(`${cleanBaseUrl}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    // If instance doesn't exist yet, create it first
    if (res.status === 404) {
      const createRes = await fetch(`${cleanBaseUrl}/instance/create`, {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceName: instanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        }),
      });

      if (createRes.ok) {
        const createData = await createRes.json();
        return NextResponse.json({
          success: true,
          qrcode: {
            base64: createData.qrcode?.base64 || createData.base64 || '',
            pairingCode: createData.qrcode?.pairingCode || createData.pairingCode,
          },
        });
      }
    }

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({
        success: false,
        error: `Erro ao obter QR Code (${res.status}): ${errText}`,
      });
    }

    const data = await res.json();
    return NextResponse.json({
      success: true,
      qrcode: {
        base64: data.base64 || data.qrcode?.base64 || data.code || '',
        pairingCode: data.pairingCode || data.qrcode?.pairingCode,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Falha na conexão com a VPS',
    });
  }
}
