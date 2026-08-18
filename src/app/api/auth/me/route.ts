import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server-auth';

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ success: false, error: 'Não autenticado.' }, { status: 401 });
    return NextResponse.json({ success: true, user });
  } catch {
    return NextResponse.json({ success: false, error: 'Serviço de autenticação indisponível.' }, { status: 503 });
  }
}
