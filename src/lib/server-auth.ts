import 'server-only';

import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from './prisma';
import { UserAccount, PermissionKey, ALL_PERMISSIONS } from './auth-types';
import { checkRateLimit } from './rate-limit';

export const SESSION_COOKIE_NAME = 'awp_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SCRYPT_PREFIX = 'scrypt';
const LEGACY_PASSWORD_SALT = 'ALLWHATSPY_SALT_2026';

function legacyHashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + LEGACY_PASSWORD_SALT).digest('hex');
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `${SCRYPT_PREFIX}$16384$8$1$${salt}$${derived.toString('hex')}`;
}

function verifyPassword(password: string, storedHash: string): { valid: boolean; legacy: boolean } {
  if (!storedHash.startsWith(`${SCRYPT_PREFIX}$`)) {
    const expected = Buffer.from(legacyHashPassword(password), 'hex');
    const actual = Buffer.from(storedHash, 'hex');
    return {
      valid: actual.length === expected.length && crypto.timingSafeEqual(actual, expected),
      legacy: true,
    };
  }

  const [prefix, nRaw, rRaw, pRaw, salt, hashHex] = storedHash.split('$');
  if (prefix !== SCRYPT_PREFIX || !salt || !hashHex) return { valid: false, legacy: false };

  try {
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(password, salt, expected.length, {
      N: Number(nRaw),
      r: Number(rRaw),
      p: Number(pRaw),
    });
    return {
      valid: actual.length === expected.length && crypto.timingSafeEqual(actual, expected),
      legacy: false,
    };
  } catch {
    return { valid: false, legacy: false };
  }
}

function toUserAccount(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  createdAt: Date;
}): UserAccount {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role === 'admin' ? 'admin' : 'user',
    permissions: user.permissions.filter((permission): permission is PermissionKey =>
      ALL_PERMISSIONS.some((definition) => definition.key === permission)
    ),
    createdAt: user.createdAt.toLocaleDateString('pt-BR'),
  };
}

export async function ensureTablesAndAdminCreated(): Promise<void> {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "email" TEXT UNIQUE NOT NULL,
      "password" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'user',
      "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "Session" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "token" TEXT UNIQUE NOT NULL,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const userCount = await prisma.user.count();
  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD;
  const initialEmail = process.env.ADMIN_INITIAL_EMAIL?.trim().toLowerCase() || 'admin@allwhatspy.com';

  if (userCount !== 0) {
    const legacyDefaultAdmin = await prisma.user.findFirst({
      where: {
        role: 'admin',
        password: legacyHashPassword('admin123'),
      },
    });

    if (legacyDefaultAdmin) {
      if (!initialPassword || initialPassword.length < 12) {
        throw new Error(
          'Uma conta administrativa ainda usa a senha padrão antiga. Defina ADMIN_INITIAL_PASSWORD com pelo menos 12 caracteres para rotacioná-la.'
        );
      }
      await prisma.user.update({
        where: { id: legacyDefaultAdmin.id },
        data: { password: hashPassword(initialPassword) },
      });
    }
    return;
  }

  if (!initialPassword || initialPassword.length < 12) {
    throw new Error('ADMIN_INITIAL_PASSWORD deve ser definida com pelo menos 12 caracteres antes do primeiro acesso.');
  }

  await prisma.user.create({
    data: {
      name: 'Administrador',
      email: initialEmail,
      password: hashPassword(initialPassword),
      role: 'admin',
      permissions: ALL_PERMISSIONS.map((permission) => permission.key),
    },
  });
}

export async function authenticateUserServer(email: string, passwordRaw: string): Promise<UserAccount | null> {
  await ensureTablesAndAdminCreated();

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!user) return null;

  const verification = verifyPassword(passwordRaw, user.password);
  if (!verification.valid) return null;

  if (verification.legacy) {
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashPassword(passwordRaw) },
    });
  }

  return toUserAccount(user);
}

function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.session.create({
    data: {
      userId,
      token: hashSessionToken(token),
      expiresAt,
    },
  });

  return { token, expiresAt };
}

function readCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1));
    } catch {
      return null;
    }
  }
  return null;
}

export async function deleteSessionForRequest(request: Request): Promise<void> {
  const token = readCookie(request, SESSION_COOKIE_NAME);
  if (!token) return;
  await prisma.session.deleteMany({ where: { token: hashSessionToken(token) } });
}

export async function getAuthenticatedUser(request: Request): Promise<UserAccount | null> {
  const token = readCookie(request, SESSION_COOKIE_NAME);
  if (!token) return null;

  const session = await prisma.session.findUnique({ where: { token: hashSessionToken(token) } });
  if (!session || session.expiresAt <= new Date()) {
    if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  return user ? toUserAccount(user) : null;
}

export function userHasPermission(user: UserAccount, permission?: PermissionKey): boolean {
  if (!permission) return true;
  return user.role === 'admin' || user.permissions.includes(permission);
}

export async function requireSession(request: Request, permission?: PermissionKey): Promise<NextResponse | null> {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (!Number.isFinite(contentLength) || contentLength > 12 * 1024 * 1024) {
    return NextResponse.json({ success: false, error: 'Corpo da requisição acima do limite.' }, { status: 413 });
  }

  const pathname = new URL(request.url).pathname;
  const rateLimitError = checkRateLimit(request, `session:${pathname}`, 120, 60_000);
  if (rateLimitError) {
    return NextResponse.json({ success: false, error: rateLimitError.error }, { status: rateLimitError.status });
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.headers.get('origin');
    const expectedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
    if (origin && expectedHost) {
      try {
        if (new URL(origin).host !== expectedHost) {
          return NextResponse.json({ success: false, error: 'Origem da requisição não permitida.' }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ success: false, error: 'Origem da requisição inválida.' }, { status: 403 });
      }
    }
  }

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Não autenticado.' }, { status: 401 });
    }
    if (!userHasPermission(user, permission)) {
      return NextResponse.json({ success: false, error: 'Acesso não autorizado.' }, { status: 403 });
    }
    return null;
  } catch {
    return NextResponse.json({ success: false, error: 'Serviço de autenticação indisponível.' }, { status: 503 });
  }
}
