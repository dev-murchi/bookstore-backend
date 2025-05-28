import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
const roundsOfHashing = 10;

export class HelperService {
  static slugify(text: string): string {
    return text
      .toString()
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
      console.error('Password generation failed. Error:', error);
      throw new Error('Password generation failed.');
    }
  }

  static async compareHash(
    data: string | Buffer,
    encrypted: string,
  ): Promise<boolean> {
    try {
      return await bcrypt.compare(data, encrypted);
    } catch (error) {
      console.error('Comparison failed. Error:', error);
      throw new Error('comparison failed.');
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

      if (inputBuffer.length !== storedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(inputBuffer, storedBuffer);
    } catch (error) {
      console.error('Token verification failed:', error);
      return false;
    }
  }
}
