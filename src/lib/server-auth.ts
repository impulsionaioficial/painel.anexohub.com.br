import crypto from 'crypto';
import { prisma } from './prisma';
import { UserAccount, ALL_PERMISSIONS } from './auth-types';

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'ALLWHATSPY_SALT_2026').digest('hex');
}

export async function ensureTablesAndAdminCreated(): Promise<void> {
  try {
    // 1. Auto DDL Migration for PostgreSQL: Create User and Session tables if missing
    await prisma.$executeRawUnsafe(`
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
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Session" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "token" TEXT UNIQUE NOT NULL,
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Seed Default Admin if table is empty
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      const allPerms = ALL_PERMISSIONS.map((p) => p.key);
      await prisma.user.create({
        data: {
          name: 'Administrador',
          email: 'admin@allwhatspy.com',
          password: hashPassword('admin123'),
          role: 'admin',
          permissions: allPerms,
        },
      });
      console.log('🟢 Initial Admin user successfully seeded into PostgreSQL DB.');
    }
  } catch (err) {
    console.error('Error ensuring database tables and admin creation:', err);
  }
}

export async function authenticateUserServer(email: string, passwordRaw: string): Promise<UserAccount | null> {
  await ensureTablesAndAdminCreated();
  const hashedPassword = hashPassword(passwordRaw);

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  if (!user || user.password !== hashedPassword) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as any,
    permissions: user.permissions as any,
    createdAt: user.createdAt.toLocaleDateString('pt-BR'),
  };
}
