import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
const roundsOfHashing = 10;

export class HelperService {
  static slugify(data: any): string {
    if (typeof data !== 'string') {
      throw new TypeError('Expected a string');
    }
    return data
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '') // Remove non-alphanumeric characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with -
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  static generateUUID(): string {
    return uuidv4();
  }

  static async generateHash(data: string | Buffer): Promise<string> {
    try {
      return await bcrypt.hash(data, roundsOfHashing);
    } catch (error) {
      console.error('Failed to generate hash. Error:', error);
      throw new Error('Failed to generate hash.');
    }
  }

  static async compareHash(
    data: string | Buffer,
    encrypted: string,
  ): Promise<boolean> {
    try {
      return await bcrypt.compare(data, encrypted);
    } catch (error) {
      console.error('Hash comparison failed. Error:', error);
      throw new Error('Failed to compare provided data with encrypted hash.');
    }
  }

  static generateToken(encoding: 'hex' | 'base64url' = 'hex'): string {
    try {
      return crypto.randomBytes(32).toString(encoding);
    } catch (error) {
      console.error('Token generation failed:', error);
      throw new Error('Failed to generate secure token.');
    }
  }

  static hashToken(
    token: string,
    encoding: 'hex' | 'base64url' = 'hex',
  ): string {
    try {
      return crypto.createHash('sha256').update(token).digest(encoding);
    } catch (error) {
      console.error('Token hashing failed:', error);
      throw new Error('Failed to hash token.');
    }
  }

  static verifyTokenHash(
    token: string,
    hash: string,
    encoding: 'hex' | 'base64url' = 'hex',
  ): boolean {
    try {
      const inputHash = this.hashToken(token, encoding);
      const inputBuffer = Buffer.from(inputHash, encoding);
      const storedBuffer = Buffer.from(hash, encoding);

      return crypto.timingSafeEqual(inputBuffer, storedBuffer);
    } catch (error) {
      console.error('Token verification failed:', error);
      return false;
    }
  }
}
