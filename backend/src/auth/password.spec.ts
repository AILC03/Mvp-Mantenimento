import { hashPassword, verifyPassword } from './password';

describe('Password hashing', () => {
  it('uses random salts and verifies only the correct password', async () => {
    const first = await hashPassword('PRUEBA123');
    const second = await hashPassword('PRUEBA123');
    expect(first).not.toBe(second);
    expect(first).not.toContain('PRUEBA123');
    expect(await verifyPassword('PRUEBA123', first)).toBe(true);
    expect(await verifyPassword('incorrecta', first)).toBe(false);
    expect(await verifyPassword('PRUEBA123', 'invalid-hash')).toBe(false);
  });
});
