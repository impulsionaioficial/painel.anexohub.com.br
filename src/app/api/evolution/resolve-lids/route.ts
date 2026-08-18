import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/server-auth';
import { assertSafeEvolutionBaseUrl } from '@/lib/network-safety';

export async function GET(request: Request) {
  const authError = await requireSession(request, 'module_whatsapp_extrator');
  if (authError) return authError;
  return NextResponse.json({
    success: true,
    message: 'Rota de resolucao de LIDs ativa. Use metodo POST para enviar lista de LIDs.',
  });
}

export async function POST(request: Request) {
  const authError = await requireSession(request, 'module_whatsapp_extrator');
  if (authError) return authError;
  try {
    const { baseUrl, apiKey, instanceName, lids } = await request.json();

    if (!baseUrl || !apiKey || !instanceName || baseUrl.includes('exemplo.com')) {
      return NextResponse.json({
        success: true,
        isDemo: true,
        resolved: {},
      });
    }

    if (!Array.isArray(lids) || lids.length === 0) {
      return NextResponse.json({ success: true, resolved: {} });
    }

    const cleanBaseUrl = await assertSafeEvolutionBaseUrl(baseUrl);
    const resolvedMap: Record<string, { phone: string; name?: string }> = {};

    // 1. Try resolving via contacts database first
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
            resolvedMap[cLid] = {
              phone: cPhone,
              name: c.name || c.pushName || '',
            };
          }
        });
      }
    } catch {}

    // 2. For remaining unresolved LIDs, query fetchProfile on Evolution API
    const unresolvedLids = lids.filter((lid: string) => !resolvedMap[lid]).slice(0, 100);

    await Promise.all(
      unresolvedLids.map(async (lid: string) => {
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
            const realPhone = String(rawWuid).split('@')[0].split(':')[0].replace(/\D/g, '');

            if (realPhone && realPhone.length >= 10 && realPhone.length <= 13) {
              resolvedMap[lid] = {
                phone: realPhone,
                name: profileData.name || profileData.pushName || '',
              };
            }
          }
        } catch {}
      })
    );

    return NextResponse.json({
      success: true,
      resolved: resolvedMap,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Erro ao resolver LIDs na Evolution API',
    });
  }
}
