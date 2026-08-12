export const JWT_EXPIRES_IN = '12h';

export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET no está definida');
  }
  return secret;
}