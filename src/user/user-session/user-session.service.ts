import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UserSessionService {
  constructor(private readonly prisma: PrismaService) {}
  async createSession(userId: string, tokenHash: string) {
    try {
      const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
      const session = await this.prisma.userSession.create({
        data: {
          user: { connect: { id: userId } },
          refreshToken: tokenHash,
          refreshRequired: false,
          expiresAt: new Date(Date.now() + oneWeekMs),
        },
      });

      return session;
    } catch (error) {
      console.error('User session creation failed. Error:', error);
      throw new Error('User session creation failed.');
    }
  }

  async deleteSession(userId: string, sessionId: string) {
    try {
      await this.prisma.userSession.delete({
        where: {
          userId: userId,
          id: sessionId,
        },
      });
    } catch (error) {
      console.error('User session delete failed. Error:', error);
      throw new Error('User session delete failed.');
    }
  }

  async updateSession(userId: string, sessionId: string, token: string) {
    try {
      await this.prisma.userSession.update({
        where: {
          userId: userId,
          id: sessionId,
        },
        data: {
          refreshToken: token,
          refreshRequired: false,
        },
      });
    } catch (error) {
      console.error('User session update failed. Error:', error);
      throw new Error('User session update failed');
    }
  }
}
