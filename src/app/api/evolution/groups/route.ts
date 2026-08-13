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
              { phone: '5511982223344', name: 'Rodrigo Alves', jid: '5511982223344@s.whatsapp.net', admin: null },
              { phone: '5519971112233', name: 'Camila Martins', jid: '5519971112233@s.whatsapp.net', admin: null },
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
              { phone: '5561981119900', name: 'Gabriel Souza', jid: '5561981119900@s.whatsapp.net', admin: null },
              { phone: '5585994445566', name: 'Mariana Oliveira', jid: '5585994445566@s.whatsapp.net', admin: null },
            ],
          },
          {
            id: '120363033333333333@g.us',
            subject: '📈 Networking Marketing Digital 2026',
            description: 'Grupo aberto de gestores de tráfego, afiliados e infoprodutores.',
            creation: 1700000000,
            size: 120,
            owner: '5511988776655@s.whatsapp.net',
            participants: [
              { phone: '5511988776655', name: 'Felipe Ribeiro (Admin)', jid: '5511988776655@s.whatsapp.net', admin: 'admin' },
              { phone: '5548991112244', name: 'Thiago Ferreira', jid: '5548991112244@s.whatsapp.net', admin: null },
              { phone: '5551984443322', name: 'Vanessa Dias', jid: '5551984443322@s.whatsapp.net', admin: null },
              { phone: '5562993332211', name: 'Diego Barbosa', jid: '5562993332211@s.whatsapp.net', admin: null },
            ],
          },
        ],
      });
    }

    const cleanBaseUrl = baseUrl.replace(/\/$/, '');

    // Try fetchAllGroups with participants
    let res = await fetch(`${cleanBaseUrl}/group/fetchAllGroups/${instanceName}?getParticipants=true`, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      // Fallback: try POST method
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
      // Fallback 2: try findGroups
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

      const participants = rawParticipants.map((p: any) => {
        let pJid = typeof p === 'string' ? p : p.id || p.jid || p.user || '';
        const phone = pJid.split('@')[0];
        const rawName = p.name || p.pushName || p.verifiedName || '';
        const name = String(rawName).trim() || (phone ? `+${phone}` : 'Participante');
        const admin = p.admin || p.isAdmin ? 'admin' : null;

        return {
          jid: pJid,
          phone,
          name,
          admin,
        };
      });

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
