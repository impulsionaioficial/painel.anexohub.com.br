import { NextResponse } from 'next/server';
import { authenticateUserServer } from '@/lib/server-auth';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Preencha o e-mail e a senha.' }, { status: 400 });
    }

    const user = await authenticateUserServer(email, password);

    if (!user) {
      return NextResponse.json({ success: false, error: 'E-mail ou senha incorretos.' }, { status: 401 });
    }

    const response = NextResponse.json({
      success: true,
      user,
    });

    // Set secure HTTP-Only cookie for session
    response.cookies.set({
      name: 'awp_session_user',
      value: JSON.stringify(user),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
