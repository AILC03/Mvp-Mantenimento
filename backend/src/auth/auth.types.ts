import type { UserRole } from '@prisma/client';
import type { Request } from 'express';

export type PublicUser = {
  id: string;
  username: string;
  name: string;
  role: UserRole;
};
export type AuthenticatedRequest = Request & {
  auth: { user: PublicUser; expiresAt: Date };
};
export const SESSION_COOKIE = 're_session';
export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

export function readSessionToken(request: Request): string | undefined {
  const cookie = request.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  const token = cookie?.slice(SESSION_COOKIE.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : undefined;
}
