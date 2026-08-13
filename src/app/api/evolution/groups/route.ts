import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { baseUrl, apiKey, instanceName } = await request.json();

    // Check for Demo mode or invalid credentials
    if (!baseUrl || !apiKey || !instanceName || baseUrl.includes('exemplo.com')) {
      return NextResponse.json({
        success: true,
        isDemo: true,
        groups: [
          {
            id: '120363011111111111@g.us',
            subject: '🚀 VIP Clientes ImpulsionaAI',
            description: 'Grupo exclusivo de clientes VIP e suporte de automação.',
            creation: 1690000000,
            size: 18,
            owner: '5511998887777@s.whatsapp.net',
            participants: [
              { phone: '5511998887777', name: 'Carlos Eduardo (Admin)', jid: '5511998887777@s.whatsapp.net', admin: 'admin' },
              { phone: '5511977776666', name: 'Juliana Costa', jid: '5511977776666@s.whatsapp.net', admin: null },
              { phone: '5521996543210', name: 'Marcos Vinicius', jid: '5521996543210@s.whatsapp.net', admin: null },
              { phone: '5531988112233', name: 'Ana Paula Rocha', jid: '5531988112233@s.whatsapp.net', admin: null },
              { phone: '5541991234567', name: 'Fernanda Lima', jid: '5541991234567@s.whatsapp.net', admin: null },
            ],
          },
          {
            id: '120363022222222222@g.us',
            subject: '💬 Comunidade AllWhatsPy PRO',
            description: 'Troca de experiências sobre campanhas e estratégias de mensagens.',
            creation: 1695000000,
            size: 45,
            owner: '5511998887777@s.whatsapp.net',
            participants: [
              { phone: '5511998887777', name: 'Carlos Eduardo (Admin)', jid: '5511998887777@s.whatsapp.net', admin: 'superadmin' },
              { phone: '5581987654321', name: 'Lucas Mendes', jid: '5581987654321@s.whatsapp.net', admin: null },
              { phone: '5571999887766', name: 'Beatriz Santos', jid: '5571999887766@s.whatsapp.net', admin: null },
            ],
          },
        ],
      });
    }

    const cleanBaseUrl = baseUrl.replace(/\/$/, '');

    // 1. Fetch contacts to build a LID-to-Phone map
    const lidToPhoneMap = new Map<string, string>();
    try {
      const contactsRes = await fetch(`${cleanBaseUrl}/chat/findContacts/${instanceName}`, {
        method: 'POST',
        headers: { 'apikey': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        cache: 'no-store',
      });
      if (contactsRes.ok) {
        const contactsData = await contactsRes.json();
        const rawContacts = Array.isArray(contactsData) ? contactsData : contactsData.contacts || contactsData.records || [];
        rawContacts.forEach((c: any) => {
          let cJid = c.remoteJid || c.jid || c.id || '';
          let cPhone = cJid.split('@')[0].split(':')[0].replace(/\D/g, '');
          let cLid = (c.lid || '').split('@')[0].replace(/\D/g, '');

          if (cLid && cPhone && cPhone.length >= 10 && cPhone.length <= 13) {
            lidToPhoneMap.set(cLid, cPhone);
          }
        });
      }
    } catch {}

    // 2. Fetch groups
    let res = await fetch(`${cleanBaseUrl}/group/fetchAllGroups/${instanceName}?getParticipants=true`, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      res = await fetch(`${cleanBaseUrl}/group/fetchAllGroups/${instanceName}?getParticipants=true`, {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ getParticipants: true }),
        cache: 'no-store',
      });
    }

    if (!res.ok) {
      res = await fetch(`${cleanBaseUrl}/group/findGroups/${instanceName}`, {
        method: 'GET',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });
    }

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({
        success: false,
        error: `Erro ao buscar grupos da Evolution API (${res.status}): ${errText}`,
      });
    }

    const data = await res.json();
    const rawList = Array.isArray(data) ? data : data.groups || data.records || [];

    const groups = rawList.map((item: any) => {
      const id = item.id || item.jid || item.groupJid || '';
      const subject = item.subject || item.name || item.groupName || 'Grupo sem nome';
      const description = item.description || item.desc || '';
      const creation = item.creation || item.creationTime;
      const owner = item.owner || item.groupOwner || '';

      const rawParticipants = Array.isArray(item.participants)
        ? item.participants
        : item.members || item.groupParticipants || [];

      const participants = rawParticipants
        .map((p: any) => {
          let pJid = '';
          let phoneCandidate = '';

          if (typeof p === 'string') {
            pJid = p;
          } else if (p && typeof p === 'object') {
            const phoneField = p.phoneNumber || p.phone || p.user;
            const jidField = p.jid || p.id;

            if (phoneField && !String(phoneField).includes('@lid')) {
              pJid = String(phoneField);
            } else if (jidField && !String(jidField).includes('@lid')) {
              pJid = String(jidField);
            } else {
              pJid = String(phoneField || jidField || '');
            }
          }

          let rawPhone = pJid.split('@')[0].split(':')[0].replace(/\D/g, '');

          // Check if rawPhone is a 14-16 digit LID ID, and resolve from lidToPhoneMap
          let isLid = false;
          if (rawPhone.length > 13 || (rawPhone.length >= 14 && !rawPhone.startsWith('55'))) {
            isLid = true;
            if (lidToPhoneMap.has(rawPhone)) {
              rawPhone = lidToPhoneMap.get(rawPhone)!;
              isLid = false;
            }
          }

          const rawName = typeof p === 'object' ? p.name || p.pushName || p.verifiedName || '' : '';
          const name = String(rawName).trim() || (isLid ? 'Membro da Comunidade (Oculto)' : (rawPhone ? `+${rawPhone}` : 'Participante'));
          const admin = typeof p === 'object' && (p.admin || p.isAdmin) ? 'admin' : null;

          return {
            jid: pJid || `${rawPhone}@s.whatsapp.net`,
            phone: rawPhone,
            name,
            admin,
            isLid,
          };
        })
        .filter((p: any) => p.phone && p.phone.length >= 8);

      return {
        id,
        subject,
        description,
        creation,
        owner,
        size: participants.length || item.size || item.participantsCount || 0,
        participants,
      };
    });

    return NextResponse.json({
      success: true,
      groups: groups.filter((g: any) => g.id && g.id.includes('@g.us')),
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Erro interno ao processar requisição de grupos',
    });
  }
}
