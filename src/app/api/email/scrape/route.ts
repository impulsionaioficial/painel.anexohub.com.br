import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { keywords, platform, domainFilter } = await request.json();

    if (!keywords || !keywords.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Palavra-chave é obrigatória.',
      });
    }

    const cleanKw = keywords.trim();
    const providerQuery = domainFilter && domainFilter !== 'all' ? `"${domainFilter}"` : '("@gmail.com" OR "@hotmail.com" OR "@outlook.com" OR "@yahoo.com")';
    const siteQuery = platform && platform !== 'all' ? `site:${platform}.com` : '';
    const fullSearchQuery = `${cleanKw} ${siteQuery} ${providerQuery}`.trim();

    const realEmailsSet = new Set<string>();
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

    // Helper to fetch and extract emails from a search engine HTML response
    const fetchSearchSource = async (url: string) => {
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
          },
          cache: 'no-store',
        });

        if (res.ok) {
          const html = await res.text();
          const matches = html.match(emailRegex) || [];
          matches.forEach((e) => {
            const lower = e.toLowerCase();
            // Filter invalid assets, search engines or placeholders
            if (
              !lower.endsWith('.png') &&
              !lower.endsWith('.jpg') &&
              !lower.endsWith('.jpeg') &&
              !lower.endsWith('.svg') &&
              !lower.endsWith('.gif') &&
              !lower.endsWith('.webp') &&
              !lower.includes('duckduckgo') &&
              !lower.includes('bing') &&
              !lower.includes('google') &&
              !lower.includes('microsoft') &&
              !lower.includes('bootstrap') &&
              !lower.includes('schema.org') &&
              !lower.includes('w3.org') &&
              !lower.includes('sentry.io') &&
              !lower.includes('example.com') &&
              !lower.includes('domain.com') &&
              !lower.includes('github') &&
              !lower.includes('sentry') &&
              !lower.includes('@2x')
            ) {
              if (domainFilter && domainFilter !== 'all') {
                if (lower.endsWith(domainFilter.toLowerCase())) {
                  realEmailsSet.add(lower);
                }
              } else {
                realEmailsSet.add(lower);
              }
            }
          });
        }
      } catch {
        // Source error handled silently
      }
    };

    // Query 1: DuckDuckGo HTML
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(fullSearchQuery)}`;
    await fetchSearchSource(ddgUrl);

    // Query 2: Bing Search HTML
    const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(fullSearchQuery)}`;
    await fetchSearchSource(bingUrl);

    const leads: any[] = [];
    const emailsArray = Array.from(realEmailsSet);

    emailsArray.forEach((email, idx) => {
      const userPart = email.split('@')[0];
      const cleanNamePart = userPart.replace(/[._\-\d]/g, ' ').trim();
      const formattedName = cleanNamePart
        ? cleanNamePart
            .split(' ')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ')
        : 'Contato';

      leads.push({
        id: `scraped_real_${Date.now()}_${idx}`,
        email,
        name: formattedName,
        platform: platform !== 'all' ? platform : 'Web Scrape',
        sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(cleanKw)}`,
        dateFound: new Date().toLocaleDateString('pt-BR'),
      });
    });

    return NextResponse.json({
      success: true,
      query: fullSearchQuery,
      totalFound: leads.length,
      leads,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Erro ao realizar extração de e-mails',
    });
  }
}
