import { NextResponse } from 'next/server';
import { getActiveCampaign } from '@/lib/campaign-runner';

export async function POST(request: Request) {
  try {
    const { baseUrl, apiKey, instanceName } = await request.json();

    const realLogs: any[] = [];
    const nowTime = new Date().toLocaleTimeString('pt-BR');

    // 1. Fetch active campaign logs from background server runner
    const activeCamp = getActiveCampaign();
    if (activeCamp && activeCamp.logs) {
      activeCamp.logs.forEach((l, idx) => {
        realLogs.push({
          id: `camp_log_${activeCamp.id}_${idx}`,
          timestamp: l.timestamp,
          type: l.status,
          category: 'DISPARO',
          message: `[${l.phone}] ${l.message}`,
        });
      });
    }

    if (!baseUrl || !apiKey || !instanceName || baseUrl.includes('exemplo.com')) {
      if (realLogs.length === 0) {
        realLogs.push({
          id: `log_demo_${Date.now()}_1`,
          timestamp: nowTime,
          type: 'success',
          category: 'EVOLUTION_API',
          message: `Sessão [${instanceName || 'teste'}] ativa na VPS.`,
        });
      }

      return NextResponse.json({
        success: true,
        isDemo: true,
        logs: realLogs,
        fetchedAt: nowTime,
      });
    }

    const cleanBaseUrl = baseUrl.replace(/\/$/, '');

    // 2. Fetch connection state from Evolution API
    const res = await fetch(`${cleanBaseUrl}/instance/connectionState/${instanceName || 'teste'}`, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();
      const state = data.instance?.state || data.state || 'close';

      realLogs.push({
        id: `log_ev_${Date.now()}`,
        timestamp: nowTime,
        type: state === 'open' ? 'success' : 'error',
        category: 'EVOLUTION_API',
        message: `Estado da instância [${instanceName || 'teste'}]: ${state.toUpperCase()}`,
      });
    } else {
      realLogs.push({
        id: `log_ev_err_${Date.now()}`,
        timestamp: nowTime,
        type: 'error',
        category: 'EVOLUTION_API',
        message: `Servidor Evolution respondeu com HTTP ${res.status}`,
      });
    }

    return NextResponse.json({
      success: true,
      logs: realLogs,
      fetchedAt: nowTime,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Erro ao buscar logs da Evolution API',
    });
  }
}
