import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const PREFIX = 'scrypt$32768$8$1';
// Se realiza el mismo trabajo para usuarios inexistentes, sin revelar su existencia.
export const DUMMY_PASSWORD_HASH = `${PREFIX}$${'0'.repeat(32)}$${'0'.repeat(128)}`;

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt);
  return `${PREFIX}$${salt}$${key.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const valid = /^scrypt\$32768\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(
    encoded,
  );
  const parts = (valid ? encoded : DUMMY_PASSWORD_HASH).split('$');
  const actual = await derive(password, parts[4]);
  const matches = timingSafeEqual(actual, Buffer.from(parts[5], 'hex'));
  return valid && matches;
}
