import { NextResponse } from 'next/server';
import { getAllServerCampaignReports } from '@/lib/campaign-runner';
import { requireSession } from '@/lib/server-auth';

export async function GET(request: Request) {
  const authError = await requireSession(request, 'module_whatsapp_logs');
  if (authError) return authError;
  try {
    const reports = getAllServerCampaignReports();
    return NextResponse.json({
      success: true,
      reports,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Erro ao buscar relatórios do servidor',
      reports: [],
    });
  }
}
