import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/server-auth';
import { assertSafeEvolutionBaseUrl } from '@/lib/network-safety';

export async function POST(request: Request) {
  const authError = await requireSession(request, 'module_whatsapp_extrator');
  if (authError) return authError;
  try {
    const { baseUrl, apiKey, instanceName } = await request.json();

    if (!baseUrl || !apiKey || !instanceName || baseUrl.includes('exemplo.com')) {
      return NextResponse.json({
        success: true,
        isDemo: true,
        contacts: [
          { id: '5511998887777@s.whatsapp.net', name: 'Carlos Eduardo', phone: '5511998887777', pushName: 'Carlos VIP' },
          { id: '5511977776666@s.whatsapp.net', name: 'Juliana Costa', phone: '5511977776666', pushName: 'Ju Costa' },
          { id: '5521996543210@s.whatsapp.net', name: 'Marcos Vinicius', phone: '5521996543210', pushName: 'Marcos V.' },
          { id: '5531988112233@s.whatsapp.net', name: 'Ana Paula Rocha', phone: '5531988112233', pushName: 'Ana Paula' },
          { id: '5541991234567@s.whatsapp.net', name: 'Fernanda Lima', phone: '5541991234567', pushName: 'Fer Lima' },
          { id: '5581987654321@s.whatsapp.net', name: 'Lucas Mendes', phone: '5581987654321', pushName: 'Lucas Mendes' },
          { id: '5571999887766@s.whatsapp.net', name: 'Beatriz Santos', phone: '5571999887766', pushName: 'Bia Santos' },
          { id: '5561981119900@s.whatsapp.net', name: 'Gabriel Souza', phone: '5561981119900', pushName: 'Gabi Souza' },
        ],
      });
    }

    const cleanBaseUrl = await assertSafeEvolutionBaseUrl(baseUrl);

    // Try POST /chat/findContacts
    let res = await fetch(`${cleanBaseUrl}/chat/findContacts/${instanceName}`, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
      cache: 'no-store',
    });

    if (!res.ok) {
      // Fallback: try POST /contact/findContacts
      res = await fetch(`${cleanBaseUrl}/contact/findContacts/${instanceName}`, {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
        cache: 'no-store',
      });
    }

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({
        success: false,
        error: `Erro ao buscar contatos (${res.status}): ${errText}`,
      });
    }

    const data = await res.json();
    const rawList = Array.isArray(data) ? data : data.contacts || data.records || [];

    const formatted = rawList.map((item: any) => {
      let jid = item.remoteJid || item.jid || item.id || '';
      const phone = jid.split('@')[0];
      const rawName = item.name || item.pushName || item.verifiedName || item.shortName || '';
      const name = String(rawName).trim() || (phone ? `+${phone}` : 'Contato WhatsApp');

      return {
        id: jid || `${phone}@s.whatsapp.net`,
        name,
        phone,
        pushName: item.pushName || '',
      };
    });

    const validContacts = formatted.filter((c: any) => c.phone && !c.id.includes('g.us') && !c.id.includes('broadcast'));

    return NextResponse.json({
      success: true,
      contacts: validContacts,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Erro interno ao processar requisição de contatos',
    });
  }
}
