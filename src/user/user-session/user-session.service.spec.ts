import { Test, TestingModule } from '@nestjs/testing';
import { UserSessionService } from './user-session.service';
import { PrismaService } from 'src/prisma/prisma.service';

const mockPrismaService = {
  userSession: {
    create: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
  },
};

const mockUserId = '5610eb78-6602-4408-88f6-c2889cd136b7'; // just example

describe('UserSessionService', () => {
  let service: UserSessionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserSessionService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();
    service = module.get<UserSessionService>(UserSessionService);
    const fixedDate = new Date('2025-06-02T14:25:16.626'); // just example
    jest.spyOn(Date, 'now').mockReturnValue(fixedDate.getTime());
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSession', () => {
    it('should throw error when user session creation fails', async () => {
      mockPrismaService.userSession.create.mockRejectedValueOnce(
        new Error('DB Error'),
      );

      await expect(
        service.createSession(mockUserId, 'refreshTokenHash'),
      ).rejects.toThrow('User session creation failed.');
    });
    it('should return user session', async () => {
      const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
      mockPrismaService.userSession.create.mockResolvedValueOnce({
        id: 'session-id',
        userId: mockUserId,
        refreshToken: 'refreshTokenHash',
        refreshRequired: false,
        expiresAt: new Date(Date.now() + oneWeekMs),
      });

      const result = await service.createSession(
        mockUserId,
        'refreshTokenHash',
      );

      expect(result).toEqual({
        id: 'session-id',
        userId: mockUserId,
        refreshToken: 'refreshTokenHash',
        refreshRequired: false,
        expiresAt: new Date(Date.now() + oneWeekMs),
      });
      expect(mockPrismaService.userSession.create).toHaveBeenCalledWith({
        data: {
          user: { connect: { id: mockUserId } },
          refreshToken: 'refreshTokenHash',
          refreshRequired: false,
          expiresAt: new Date(Date.now() + oneWeekMs),
        },
      });
    });
  });
  describe('deleteSession', () => {
    it('should throw error when user session delete fails', async () => {
      mockPrismaService.userSession.delete.mockRejectedValueOnce(
        new Error('DB Error'),
      );

      await expect(
        service.deleteSession(mockUserId, 'session-id'),
      ).rejects.toThrow('User session delete failed.');
    });

    it('should successfully delete the user session', async () => {
      mockPrismaService.userSession.delete.mockResolvedValueOnce({});

      await expect(
        service.deleteSession(mockUserId, 'session-id'),
      ).resolves.toBeUndefined();

      expect(mockPrismaService.userSession.delete).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          id: 'session-id',
        },
      });
    });
  });

  describe('updateSession', () => {
    it('should throw error when user session update fails', async () => {
      mockPrismaService.userSession.update.mockRejectedValueOnce(
        new Error('DB Error'),
      );

      await expect(
        service.updateSession(mockUserId, 'session-id', 'newTokenHash'),
      ).rejects.toThrow('User session update failed');
    });

    it('should successfully update the user session', async () => {
      mockPrismaService.userSession.update.mockResolvedValueOnce({});

      await expect(
        service.updateSession(mockUserId, 'session-id', 'newTokenHash'),
      ).resolves.toBeUndefined();

      expect(mockPrismaService.userSession.update).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          id: 'session-id',
        },
        data: {
          refreshToken: 'newTokenHash',
          refreshRequired: false,
        },
      });
    });
  });
});
