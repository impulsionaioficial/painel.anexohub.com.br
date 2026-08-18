import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/server-auth';
import { assertSafeEvolutionBaseUrl } from '@/lib/network-safety';

// Helper function to restore Brazilian 9th digit if lost during Evolution API LID mapping (PR #2688 fix)
function formatBrazilianPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 12 && clean.startsWith('55')) {
    const ddd = parseInt(clean.substring(2, 4), 10);
    const body = clean.substring(4);
    if (ddd >= 11 && ddd <= 99 && ['6', '7', '8', '9'].includes(body[0])) {
      return `55${ddd}9${body}`;
    }
  }
  return clean;
}

export async function POST(request: Request) {
  const authError = await requireSession(request, 'module_whatsapp_extrator');
  if (authError) return authError;
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
        ],
      });
    }

    const cleanBaseUrl = await assertSafeEvolutionBaseUrl(baseUrl);

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
          let cPhone = formatBrazilianPhone(cJid.split('@')[0].split(':')[0].replace(/\D/g, ''));
          let cLid = (c.lid || '').split('@')[0].replace(/\D/g, '');

          if (cLid && cPhone && cPhone.length >= 10 && cPhone.length <= 13) {
            lidToPhoneMap.set(cLid, cPhone);
          }
        });
      }
    } catch {}

    // 2. Fetch all groups
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

    const groups = await Promise.all(
      rawList.map(async (item: any) => {
        const id = item.id || item.jid || item.groupJid || '';
        const subject = item.subject || item.name || item.groupName || 'Grupo sem nome';
        const description = item.description || item.desc || '';
        const creation = item.creation || item.creationTime;
        const owner = item.owner || item.groupOwner || '';

        let rawParticipants = Array.isArray(item.participants)
          ? item.participants
          : item.members || item.groupParticipants || [];

        // If participants is empty or contains mostly LIDs, try calling Evolution v2.4.0 participant endpoints
        const hasLids = rawParticipants.some((p: any) => {
          const str = typeof p === 'string' ? p : p.id || p.jid || p.phoneNumber || '';
          return str.includes('@lid') || str.replace(/\D/g, '').length > 13;
        });

        if (id && (rawParticipants.length === 0 || hasLids)) {
          try {
            let partRes = await fetch(`${cleanBaseUrl}/group/participants/${instanceName}?groupJid=${encodeURIComponent(id)}`, {
              method: 'GET',
              headers: { 'apikey': apiKey, 'Content-Type': 'application/json' },
              cache: 'no-store',
            });

            if (!partRes.ok) {
              partRes = await fetch(`${cleanBaseUrl}/group/findGroupInfos/${instanceName}?groupJid=${encodeURIComponent(id)}`, {
                method: 'GET',
                headers: { 'apikey': apiKey, 'Content-Type': 'application/json' },
                cache: 'no-store',
              });
            }

            if (partRes.ok) {
              const partData = await partRes.json();
              const fetchedList = Array.isArray(partData)
                ? partData
                : partData.participants || partData.members || partData.group?.participants || [];

              if (fetchedList.length > 0) {
                rawParticipants = fetchedList;
              }
            }
          } catch {}
        }

        const participants = rawParticipants
          .map((p: any) => {
            let pJid = '';

            if (typeof p === 'string') {
              pJid = p;
            } else if (p && typeof p === 'object') {
              const phoneField = p.phoneNumber || p.phone || p.user || p.number;
              const jidField = p.jid || p.id;

              if (phoneField && !String(phoneField).includes('@lid')) {
                pJid = String(phoneField);
              } else if (jidField && !String(jidField).includes('@lid')) {
                pJid = String(jidField);
              } else {
                pJid = String(phoneField || jidField || '');
              }
            }

            let rawPhone = formatBrazilianPhone(pJid.split('@')[0].split(':')[0].replace(/\D/g, ''));

            let isLid = false;
            if (rawPhone.length > 13 || (rawPhone.length >= 14 && !rawPhone.startsWith('55'))) {
              isLid = true;
              if (lidToPhoneMap.has(rawPhone)) {
                rawPhone = formatBrazilianPhone(lidToPhoneMap.get(rawPhone)!);
                isLid = false;
              }
            }

            const rawName = typeof p === 'object' ? p.name || p.pushName || p.verifiedName || '' : '';
            const name = String(rawName).trim() || (isLid ? `Membro (ID: ${rawPhone})` : (rawPhone ? `+${rawPhone}` : 'Participante'));
            const admin = typeof p === 'object' && (p.admin || p.isAdmin) ? 'admin' : null;

            return {
              jid: pJid.includes('@') ? pJid : (isLid ? `${rawPhone}@lid` : `${rawPhone}@s.whatsapp.net`),
              phone: rawPhone,
              name,
              admin,
              isLid,
            };
          })
          .filter((p: any) => p.phone && p.phone.length >= 5);

        return {
          id,
          subject,
          description,
          creation,
          owner,
          size: participants.length || item.size || item.participantsCount || 0,
          participants,
        };
      })
    );

    // 3. Batch resolution for remaining LIDs using whatsappNumbers & fetchProfile
    const unresolvedLids = new Set<string>();
    groups.forEach((g: any) => {
      g.participants.forEach((p: any) => {
        if (p.isLid || p.phone.length > 13) {
          unresolvedLids.add(p.phone);
        }
      });
    });

    if (unresolvedLids.size > 0) {
      const lidsList = Array.from(unresolvedLids).slice(0, 100);

      // Attempt A: Batch call /chat/whatsappNumbers
      try {
        const wnRes = await fetch(`${cleanBaseUrl}/chat/whatsappNumbers/${instanceName}`, {
          method: 'POST',
          headers: { 'apikey': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ numbers: lidsList.map((l) => (l.includes('@') ? l : `${l}@lid`)) }),
          cache: 'no-store',
        });
        if (wnRes.ok) {
          const wnData = await wnRes.json();
          const items = Array.isArray(wnData) ? wnData : wnData.results || wnData.numbers || [];
          items.forEach((item: any) => {
            const rawJid = item.jid || item.wuid || item.number || '';
            const phone = formatBrazilianPhone(String(rawJid).split('@')[0].split(':')[0].replace(/\D/g, ''));
            const origLid = String(item.number || item.jid || '').split('@')[0].replace(/\D/g, '');

            if (phone && phone.length >= 10 && phone.length <= 13 && origLid) {
              lidToPhoneMap.set(origLid, phone);
            }
          });
        }
      } catch {}

      // Attempt B: /chat/fetchProfile for remaining LIDs
      const stillUnresolved = lidsList.filter((l) => !lidToPhoneMap.has(l)).slice(0, 50);
      await Promise.all(
        stillUnresolved.map(async (lid: string) => {
          try {
            const targetLid = lid.includes('@') ? lid : `${lid}@lid`;
            const profileRes = await fetch(`${cleanBaseUrl}/chat/fetchProfile/${instanceName}`, {
              method: 'POST',
              headers: { 'apikey': apiKey, 'Content-Type': 'application/json' },
              body: JSON.stringify({ number: targetLid }),
              cache: 'no-store',
            });

            if (profileRes.ok) {
              const profileData = await profileRes.json();
              const rawWuid = profileData.wuid || profileData.jid || profileData.number || profileData.id || '';
              const realPhone = formatBrazilianPhone(String(rawWuid).split('@')[0].split(':')[0].replace(/\D/g, ''));

              if (realPhone && realPhone.length >= 10 && realPhone.length <= 13) {
                lidToPhoneMap.set(lid, realPhone);
              }
            }
          } catch {}
        })
      );

      // Re-apply resolved map to all group participants
      groups.forEach((g: any) => {
        g.participants = g.participants.map((p: any) => {
          if ((p.isLid || p.phone.length > 13) && lidToPhoneMap.has(p.phone)) {
            const realPhone = lidToPhoneMap.get(p.phone)!;
            return {
              ...p,
              phone: realPhone,
              jid: `${realPhone}@s.whatsapp.net`,
              name: p.name && !p.name.includes('Membro') ? p.name : `+${realPhone}`,
              isLid: false,
            };
          }
          return p;
        });
      });
    }

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
