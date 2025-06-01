import { HelperService } from './helper.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

jest.mock('bcrypt');
jest.mock('crypto', () => {
  return {
    randomBytes: jest.fn(() => Buffer.from('mockedtokenvalue')),
    createHash: jest.fn(() => ({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn((encoding: string) => {
        if (encoding === 'base64url') return 'mocked_base64_url';
        if (encoding === 'hex') return 'mocked_hex_hash';
        return 'mocked_default_hash';
      }),
    })),
    timingSafeEqual: jest.fn((a: Buffer, b: Buffer) => {
      return a.toString() === b.toString();
    }),
  };
});

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mocked-uuid-1234'),
}));

describe('HelperService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('slugify', () => {
    it('should convert a normal string into a slug', () => {
      const data =
        'From the green hills of the Shire, a travelling Hobbit bids you good day!';
      const result = HelperService.slugify(data);
      expect(result).toBe(
        'from-the-green-hills-of-the-shire-a-travelling-hobbit-bids-you-good-day',
      );
    });

    it('should throw TypeError for invalid inputs', () => {
      const invalidInputs = [null, undefined, 123, {}, [], true, false];

      for (const input of invalidInputs) {
        try {
          HelperService.slugify(input);
        } catch (error) {
          expect(error).toBeInstanceOf(TypeError);
          expect(error.message).toBe('Expected a string');
        }
      }
    });
  });

  describe('generateHash', () => {
    it('should return a hash string', async () => {
      const mockHash = '$2b$10$mockhashvalue';
      (bcrypt.hash as jest.Mock).mockResolvedValueOnce(mockHash);
      const result = await HelperService.generateHash('password');
      expect(result).toBe(mockHash);
      expect(bcrypt.hash).toHaveBeenCalledWith('password', 10);
    });

    it('should throw error if hashing fails', async () => {
      (bcrypt.hash as jest.Mock).mockRejectedValueOnce(new Error('Error'));
      await expect(HelperService.generateHash('fail')).rejects.toThrow(
        'Failed to generate hash.',
      );
    });
  });

  describe('compareHash', () => {
    it('should return true when bcrypt.compare resolves true', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await HelperService.compareHash('test', 'mocked-hash');
      expect(result).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith('test', 'mocked-hash');
    });

    it('should return false when bcrypt.compare resolves false', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await HelperService.compareHash('wrong', 'mocked-hash');
      expect(result).toBe(false);
    });

    it('should throw error if compare fails', async () => {
      (bcrypt.compare as jest.Mock).mockRejectedValue(new Error('Error'));

      await expect(
        HelperService.compareHash('fail', 'bad-hash'),
      ).rejects.toThrow('Failed to compare provided data with encrypted hash.');
    });
  });

  describe('generateUUID', () => {
    it('should generate a valid UUID v4', () => {
      const uuid = HelperService.generateUUID();
      expect(uuid).toBe('mocked-uuid-1234');
    });
  });

  describe('generateToken', () => {
    it('should generate a base64url token', () => {
      const expectedToken =
        Buffer.from('mockedtokenvalue').toString('base64url');
      const result = HelperService.generateToken('base64url');
      expect(result).toBe(expectedToken);
    });

    it('should generate a hex token by default', () => {
      const expectedToken = Buffer.from('mockedtokenvalue').toString('hex');
      const result = HelperService.generateToken();
      expect(result).toBe(expectedToken);
    });

    it('should throw error if crypto.randomBytes fails', () => {
      (crypto.randomBytes as jest.Mock).mockImplementationOnce(() => {
        throw new Error('crypto error');
      });
      expect(() => HelperService.generateToken()).toThrow(
        'Failed to generate secure token.',
      );
    });
  });

  describe('hashToken', () => {
    it('should return mocked hex hash by default', () => {
      const token = 'abc123';
      const hashed = HelperService.hashToken(token);
      expect(hashed).toBe('mocked_hex_hash');
    });

    it('should return mocked base64url hash when encoding specified', () => {
      const hashed = HelperService.hashToken('abc123', 'base64url');
      expect(hashed).toBe('mocked_base64_url');
    });

    it('should throw error if createHash fails', () => {
      (crypto.createHash as jest.Mock).mockImplementationOnce(() => {
        throw new Error('hash failure');
      });
      expect(() => HelperService.hashToken('token')).toThrow(
        'Failed to hash token.',
      );
    });
  });

  describe('verifyTokenHash', () => {
    it('should return true for matching tokens using timingSafeEqual', () => {
      const token = 'secure-token';
      const hash = HelperService.hashToken(token);
      const result = HelperService.verifyTokenHash(token, hash);
      expect(result).toBe(true);
    });

    it('should return false for tokens that differ', () => {
      (crypto.timingSafeEqual as jest.Mock).mockImplementationOnce(() => false);
      const valid = HelperService.verifyTokenHash('token1', 'hash2');
      expect(valid).toBe(false);
    });

    it('should return false if hashing throws during verify', () => {
      jest.spyOn(HelperService, 'hashToken').mockImplementationOnce(() => {
        throw new Error('hashing failed');
      });
      expect(HelperService.verifyTokenHash('token', 'hash')).toBe(false);
    });

    it('should support base64url encoding', () => {
      const token = 'secure-token';
      const hash = HelperService.hashToken(token, 'base64url');
      const verified = HelperService.verifyTokenHash(token, hash, 'base64url');
      expect(verified).toBe(true);
    });
  });
});
