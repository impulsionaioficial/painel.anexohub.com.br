import { NextResponse } from 'next/server';
import { promises as dns } from 'dns';

export async function POST(request: Request) {
  try {
    const { domain } = await request.json();

    if (!domain) {
      return NextResponse.json({ success: false, error: 'Domínio é obrigatório.' });
    }

    const cleanDomain = String(domain)
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/^www\./, '');

    const result = {
      domain: cleanDomain,
      spf: { found: false, record: '', status: 'error', message: 'Registro SPF não encontrado no DNS.' },
      dmarc: { found: false, record: '', status: 'error', message: 'Registro DMARC não encontrado no DNS.' },
      dkim: { found: false, record: '', status: 'warning', message: 'DKIM requer o seletor específico do seu provedor (ex: default._domainkey).' },
    };

    // 1. Check SPF
    try {
      const txts = await dns.resolveTxt(cleanDomain);
      const spf = txts.map((t) => t.join('')).find((r) => r.toLowerCase().startsWith('v=spf1'));
      if (spf) {
        result.spf = {
          found: true,
          record: spf,
          status: 'success',
          message: 'Registro SPF encontrado no DNS.',
        };
      }
    } catch {
      // SPF not found
    }

    // 2. Check DMARC
    try {
      const dmarcTxts = await dns.resolveTxt(`_dmarc.${cleanDomain}`);
      const dmarc = dmarcTxts.map((t) => t.join('')).find((r) => r.toLowerCase().startsWith('v=dmarc1'));
      if (dmarc) {
        result.dmarc = {
          found: true,
          record: dmarc,
          status: 'success',
          message: 'Registro DMARC ativo e configurado com sucesso!',
        };
      }
    } catch {
      // DMARC not found
    }

    // 3. Check Common DKIM selectors
    const commonSelectors = ['default', 'google', 'k1', 's1', 'mail', 'dkim'];
    for (const selector of commonSelectors) {
      try {
        const dkimTxts = await dns.resolveTxt(`${selector}._domainkey.${cleanDomain}`);
        const dkim = dkimTxts.map((t) => t.join('')).find((r) => r.toLowerCase().includes('v=dkim1') || r.toLowerCase().includes('p='));
        if (dkim) {
          result.dkim = {
            found: true,
            record: `${selector}._domainkey: ${dkim.slice(0, 50)}...`,
            status: 'success',
            message: `Registro DKIM encontrado no seletor [${selector}._domainkey]!`,
          };
          break;
        }
      } catch {
        // try next
      }
    }

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Erro ao realizar checagem DNS',
    });
  }
}
