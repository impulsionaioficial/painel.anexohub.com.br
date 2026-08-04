import { NextResponse } from 'next/server';

function parseMessageText(item: any): string {
  if (typeof item.message === 'string') return item.message;
  if (typeof item.text === 'string') return item.text;
  if (typeof item.body === 'string') return item.body;

  const msg = item.message || {};
  if (msg.conversation) return msg.conversation;
  if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
  if (msg.imageMessage?.caption) return `📷 [Imagem] ${msg.imageMessage.caption}`;
  if (msg.imageMessage) return '📷 [Imagem]';
  if (msg.documentMessage?.caption) return `📄 [Documento] ${msg.documentMessage.caption}`;
  if (msg.documentMessage?.fileName) return `📄 [Documento: ${msg.documentMessage.fileName}]`;
  if (msg.documentMessage) return '📄 [Documento]';
  if (msg.audioMessage) return '🎵 [Áudio do WhatsApp]';
  if (msg.videoMessage) return '🎥 [Vídeo do WhatsApp]';
  if (msg.stickerMessage) return '👾 [Sticker]';

  return '💬 [Mensagem do WhatsApp]';
}

function extractRawList(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.messages?.records)) return data.messages.records;
  if (Array.isArray(data.messages)) return data.messages;
  if (Array.isArray(data.records)) return data.records;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.response)) return data.response;
  if (Array.isArray(data.response?.messages)) return data.response.messages;
  if (typeof data === 'object' && data.key) return [data];
  return [];
}

export async function POST(request: Request) {
  try {
    const { baseUrl, apiKey, instanceName, remoteJid } = await request.json();

    console.log(`\n======================================================`);
    console.log(`[DEBUG MESSAGES] Request for instance: [${instanceName}], remoteJid: [${remoteJid}]`);

    if (!remoteJid) {
      return NextResponse.json({ success: false, error: 'remoteJid é obrigatório' });
    }

    if (!baseUrl || !apiKey || !instanceName || baseUrl.includes('exemplo.com')) {
      return NextResponse.json({
        success: true,
        isDemo: true,
        messages: [
          {
            id: `msg_1_${remoteJid}`,
            fromMe: false,
            text: `Olá! Esta é a conversa da instância demo com ${remoteJid.split('@')[0]}.`,
            timestamp: '12:35',
          },
        ],
      });
    }

    const cleanBaseUrl = baseUrl.replace(/\/$/, '');

    // Build list of candidate JIDs to query (ensuring full Baileys JID domains @s.whatsapp.net, @g.us, @lid and raw ID)
    const rawJid = String(remoteJid).trim();
    const candidateJids: string[] = [];

    if (rawJid.includes('@')) {
      candidateJids.push(rawJid);
      const cleanPart = rawJid.split('@')[0];
      if (cleanPart) candidateJids.push(cleanPart);
    } else {
      candidateJids.push(rawJid);
      if (/^\d+$/.test(rawJid)) {
        candidateJids.push(`${rawJid}@s.whatsapp.net`);
        candidateJids.push(`${rawJid}@g.us`);
        candidateJids.push(`${rawJid}@lid`);
      } else {
        candidateJids.push(`${rawJid}@g.us`);
        candidateJids.push(`${rawJid}@s.whatsapp.net`);
        candidateJids.push(`${rawJid}@lid`);
      }
    }

    const debugLogs: string[] = [];
    let rawList: any[] = [];

    // Helper to call Evolution API via POST or GET
    const fetchFromEvolution = async (endpoint: string, payload: any = null, method: string = 'POST') => {
      try {
        const fullUrl = `${cleanBaseUrl}${endpoint}`;
        debugLogs.push(`Calling ${method} ${fullUrl} ${payload ? `with body: ${JSON.stringify(payload)}` : ''}`);

        const fetchOptions: RequestInit = {
          method,
          headers: {
            'apikey': apiKey,
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        };

        if (method === 'POST' && payload) {
          fetchOptions.body = JSON.stringify(payload);
        }

        const res = await fetch(fullUrl, fetchOptions);

        const status = res.status;
        debugLogs.push(`Response HTTP Status: ${status}`);

        if (res.ok) {
          const json = await res.json();
          const items = extractRawList(json);
          debugLogs.push(`Extracted ${items.length} raw message records.`);
          return items;
        } else {
          const errText = await res.text();
          debugLogs.push(`HTTP ${status} Error body: ${errText.slice(0, 300)}`);
        }
      } catch (err: any) {
        debugLogs.push(`Fetch exception: ${err.message}`);
      }
      return [];
    };

    // Attempt candidates across endpoints and payload structures
    for (const targetJid of candidateJids) {
      if (rawList.length > 0) break;

      // Strategy 1: Baileys where { key: { remoteJid } }
      rawList = await fetchFromEvolution(`/chat/findMessages/${instanceName}`, {
        where: { key: { remoteJid: targetJid } },
        count: 50,
        limit: 50,
      });

      // Strategy 2: Evolution v2 where { remoteJid }
      if (rawList.length === 0) {
        rawList = await fetchFromEvolution(`/chat/findMessages/${instanceName}`, {
          where: { remoteJid: targetJid },
          count: 50,
          limit: 50,
        });
      }

      // Strategy 3: Direct { remoteJid }
      if (rawList.length === 0) {
        rawList = await fetchFromEvolution(`/chat/findMessages/${instanceName}`, {
          remoteJid: targetJid,
          count: 50,
          limit: 50,
        });
      }

      // Strategy 4: Evolution GET endpoint with query params
      if (rawList.length === 0) {
        rawList = await fetchFromEvolution(`/chat/findMessages/${instanceName}?remoteJid=${encodeURIComponent(targetJid)}&limit=50`, null, 'GET');
      }
    }

    // Strategy 5 Fallback: Fetch latest global messages for instance and filter by candidate JIDs / phone
    if (rawList.length === 0) {
      debugLogs.push('Target JID strategies returned 0. Attempting global instance message fetch (count: 100)...');
      let globalList = await fetchFromEvolution(`/chat/findMessages/${instanceName}`, {
        count: 100,
        limit: 100,
      });

      if (globalList.length === 0) {
        globalList = await fetchFromEvolution(`/chat/findMessages/${instanceName}?limit=100`, null, 'GET');
      }

      const cleanPhone = rawJid.split('@')[0].toLowerCase();
      rawList = globalList.filter((item: any) => {
        const itemJid = String(item.key?.remoteJid || item.remoteJid || item.jid || '').toLowerCase();
        return candidateJids.some((c) => c.toLowerCase() === itemJid) || (cleanPhone.length > 5 && itemJid.includes(cleanPhone));
      });
      debugLogs.push(`Global fallback filter matched ${rawList.length} messages.`);
    }

    console.log(`[DEBUG MESSAGES] Summary: ${debugLogs.join(' | ')}`);

    const formattedMessages = rawList.map((item: any) => {
      const fromMe = Boolean(item.key?.fromMe || item.fromMe);
      const text = parseMessageText(item);
      const rawTime = item.messageTimestamp || item.timestamp;
      const timestamp = rawTime
        ? new Date(Number(rawTime) * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : 'Recente';

      return {
        id: item.key?.id || item.id || `msg_${Date.now()}_${Math.random()}`,
        fromMe,
        text,
        timestamp,
      };
    });

    return NextResponse.json({
      success: true,
      messages: formattedMessages.reverse(),
      debugLogs,
    });
  } catch (error: any) {
    console.error('[DEBUG MESSAGES ERROR]', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Erro ao carregar mensagens da Evolution API',
    });
  }
}
