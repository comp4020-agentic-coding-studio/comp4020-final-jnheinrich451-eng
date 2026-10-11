import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

let active = 0;
export const validPassword = value => typeof value === 'string' && value.length >= 15 && value.length <= 128;
export function authError(message, status = 400) { return Object.assign(new Error(message), { status }); }

async function derive(password, salt) {
  // One ~32 MiB derivation at a time; do not queue unlimited expensive work
  // alongside the simulation on the current shared-CPU machine.
  if (active) throw authError('Sign-in is busy. Please try again in a moment.', 429);
  active++;
  try {
    return await new Promise((resolve, reject) => scrypt(password, salt, 64,
      { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
      (error, key) => error ? reject(error) : resolve(key)));
  } finally { active--; }
}
export async function hashPassword(password) {
  if (!validPassword(password)) throw authError('Use a password of 15–128 characters.');
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${(await derive(password, salt)).toString('hex')}`;
}
export async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || password.length > 128) return false;
  const parts = encoded?.split('$');
  const valid = parts?.length === 3 && parts[0] === 'scrypt' && /^[a-f0-9]{32}$/.test(parts[1]) && /^[a-f0-9]{128}$/.test(parts[2]);
  const candidate = await derive(password, valid ? parts[1] : '0'.repeat(32));
  return !!valid && timingSafeEqual(candidate, Buffer.from(parts[2], 'hex'));
}
