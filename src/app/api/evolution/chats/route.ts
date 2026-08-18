import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/server-auth';
import { assertSafeEvolutionBaseUrl } from '@/lib/network-safety';

export async function POST(request: Request) {
  const authError = await requireSession(request, 'module_whatsapp_logs');
  if (authError) return authError;
  try {
    const { baseUrl, apiKey, instanceName } = await request.json();

    if (!baseUrl || !apiKey || !instanceName || baseUrl.includes('exemplo.com')) {
      return NextResponse.json({
        success: true,
        isDemo: true,
        chats: [
          {
            id: '5511998887777@s.whatsapp.net',
            name: '+55 11 99888-7777',
            phone: '5511998887777',
            lastMessage: 'Olá! Gostaria de saber mais sobre a proposta.',
            timestamp: '12:40',
            unreadCount: 2,
          },
          {
            id: '5511977776666@s.whatsapp.net',
            name: 'Juliana Costa',
            phone: '5511977776666',
            lastMessage: 'Perfeito, aguardo o envio do arquivo.',
            timestamp: '11:15',
            unreadCount: 0,
          },
        ],
      });
    }

    const cleanBaseUrl = await assertSafeEvolutionBaseUrl(baseUrl);

    const res = await fetch(`${cleanBaseUrl}/chat/findChats/${instanceName}`, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ success: false, error: `Erro ao buscar chats (${res.status}): ${errText}` });
    }

    const data = await res.json();
    const rawList = Array.isArray(data) ? data : data.chats || data.records || [];

    const formattedChats = rawList.map((item: any) => {
      // Prioritize actual WhatsApp JID fields over Prisma internal row CUID (item.id)
      let jid = item.remoteJid || item.jid || item.key?.remoteJid || '';
      if (!jid && typeof item.id === 'string') {
        jid = item.id;
      }
      const cleanPhone = jid.split('@')[0];

      const rawName =
        item.name ||
        item.pushName ||
        item.verifiedName ||
        item.contact?.name ||
        item.contact?.pushName ||
        item.user?.name ||
        '';

      const name = String(rawName).trim() || (cleanPhone ? `+${cleanPhone}` : 'Contato WhatsApp');

      const lastMsg =
        item.lastMessage?.message?.conversation ||
        item.lastMessage?.message?.extendedTextMessage?.text ||
        item.lastMessage?.text ||
        item.conversation ||
        '[Mensagem do WhatsApp]';

      const rawTime = item.conversationTimestamp || item.lastMessage?.messageTimestamp;
      const timestamp = rawTime
        ? new Date(Number(rawTime) * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : 'Recente';

      return {
        id: jid || `${cleanPhone}@s.whatsapp.net`,
        name,
        phone: cleanPhone,
        lastMessage: lastMsg,
        timestamp,
        unreadCount: item.unreadCount || 0,
      };
    });

    // Remove empty items and filter out status broadcasts
    const validChats = formattedChats.filter((c: any) => c.phone && !c.id.includes('status@broadcast'));

    return NextResponse.json({ success: true, chats: validChats });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Erro ao conectar com a Evolution API' });
  }
}
