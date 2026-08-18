import { NextResponse } from 'next/server';
import { authenticateUserServer, createSession, SESSION_COOKIE_NAME } from '@/lib/server-auth';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const rateLimitError = checkRateLimit(request, 'login', 10, 15 * 60_000);
  if (rateLimitError) {
    return NextResponse.json({ success: false, error: rateLimitError.error }, { status: rateLimitError.status });
  }

  try {
    const { email, password } = await request.json();

    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password || password.length > 256) {
      return NextResponse.json({ success: false, error: 'Preencha o e-mail e a senha.' }, { status: 400 });
    }

    const user = await authenticateUserServer(email, password);

    if (!user) {
      return NextResponse.json({ success: false, error: 'E-mail ou senha incorretos.' }, { status: 401 });
    }

    const session = await createSession(user.id);
    const response = NextResponse.json({ success: true, user });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: session.token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      expires: session.expiresAt,
    });
    response.cookies.delete('awp_session_user');

    return response;
  } catch {
    return NextResponse.json({ success: false, error: 'Não foi possível autenticar no momento.' }, { status: 503 });
  }
}
