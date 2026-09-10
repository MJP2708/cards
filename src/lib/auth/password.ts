import bcrypt from "bcryptjs";

// 10 rounds: comfortably above bcrypt's practical minimum while staying fast enough
// that a booth login on a phone doesn't feel sluggish.
const ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export const MIN_PASSWORD_LENGTH = 8;
