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
    const { baseUrl, apiKey, action, instanceName } = await request.json();

    if (!baseUrl || !apiKey || baseUrl.includes('exemplo.com')) {
      return NextResponse.json({
        success: true,
        isDemo: true,
        instances: [
          { name: instanceName || 'teste', status: 'open', owner: '' },
          { name: 'Impulsiona Agência 6', status: 'close', owner: '' },
        ],
      });
    }

    const cleanBaseUrl = await assertSafeEvolutionBaseUrl(baseUrl);

    // ACTION: Create Instance
    if (action === 'create') {
      if (!instanceName) {
        return NextResponse.json({ success: false, error: 'Nome da instância é obrigatório' });
      }

      const createRes = await fetch(`${cleanBaseUrl}/instance/create`, {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceName: instanceName.trim(),
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        }),
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        return NextResponse.json({ success: false, error: `Erro ao criar (${createRes.status}): ${errText}` });
      }

      const createData = await createRes.json();
      return NextResponse.json({ success: true, instance: createData });
    }

    // ACTION: Delete Instance
    if (action === 'delete') {
      if (!instanceName) {
        return NextResponse.json({ success: false, error: 'Nome da instância a ser deletada é obrigatório' });
      }

      const deleteRes = await fetch(`${cleanBaseUrl}/instance/delete/${instanceName.trim()}`, {
        method: 'DELETE',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!deleteRes.ok) {
        const errText = await deleteRes.text();
        return NextResponse.json({ success: false, error: `Erro ao deletar (${deleteRes.status}): ${errText}` });
      }

      return NextResponse.json({ success: true, message: `Instância [${instanceName}] deletada com sucesso.` });
    }

    // DEFAULT ACTION: Fetch all instances
    const fetchRes = await fetch(`${cleanBaseUrl}/instance/fetchInstances`, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!fetchRes.ok) {
      const errText = await fetchRes.text();
      return NextResponse.json({ success: false, error: `Erro ao listar instâncias (${fetchRes.status}): ${errText}` });
    }

    const data = await fetchRes.json();
    const rawList = Array.isArray(data) ? data : data.instances || [];

    // Fetch precise connectionState for each instance concurrently
    const formattedInstances = await Promise.all(
      rawList.map(async (item: any) => {
        const name = item.instance?.instanceName || item.name || item.instanceName || item.instance?.name;
        if (!name) return null;

        let rawStatus =
          item.instance?.state ||
          item.instance?.status ||
          item.instance?.connectionStatus ||
          item.state ||
          item.status ||
          item.connectionStatus;

        // If status in list is missing or unclear, perform direct check for accuracy
        if (!rawStatus || rawStatus === 'close') {
          try {
            const stateRes = await fetch(`${cleanBaseUrl}/instance/connectionState/${name}`, {
              method: 'GET',
              headers: { 'apikey': apiKey, 'Content-Type': 'application/json' },
              cache: 'no-store',
            });
            if (stateRes.ok) {
              const stateData = await stateRes.json();
              rawStatus = stateData.instance?.state || stateData.state || stateData.status || rawStatus;
            }
          } catch {
            // Keep previous status
          }
        }

        return {
          name,
          status: normalizeState(rawStatus),
          owner: item.instance?.owner || item.owner || '',
        };
      })
    );

    const validInstances = formattedInstances.filter(Boolean);

    return NextResponse.json({ success: true, instances: validInstances });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Erro ao conectar à VPS' });
  }
}
