import { RoleGuard } from './role.guard';
import { Reflector } from '@nestjs/core';
import {
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';

const mockRequestFn = jest.fn();
const mockContext = {
  switchToHttp: () => ({
    getRequest: mockRequestFn,
  }),
  getHandler: () => 'mockHandler',
  getClass: () => 'mockClass',
} as unknown as ExecutionContext;

describe('RoleGuard', () => {
  let guard: RoleGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RoleGuard(reflector);
  });

  it('should throw UnauthorizedException if user is not present', async () => {
    mockRequestFn.mockReturnValueOnce({ user: undefined });
    jest.spyOn(reflector, 'getAllAndMerge').mockReturnValueOnce(['admin']);
    try {
      await guard.canActivate(mockContext);
    } catch (error) {
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.message).toBe('User authentication failed.');
    }
  });

  it('should return true if no roles are required', async () => {
    mockRequestFn.mockReturnValueOnce({ user: { role: 'user' } });
    jest.spyOn(reflector, 'getAllAndMerge').mockReturnValueOnce([]);
    await expect(guard.canActivate(mockContext)).resolves.toBe(true);
  });

  it('should return true if user has the required role', async () => {
    mockRequestFn.mockReturnValueOnce({ user: { role: 'admin' } });
    jest.spyOn(reflector, 'getAllAndMerge').mockReturnValueOnce(['admin']);
    await expect(guard.canActivate(mockContext)).resolves.toBe(true);
  });

  it('should throw ForbiddenException if user does not have the required role and is authenticated', async () => {
    mockRequestFn.mockReturnValueOnce({ user: { role: 'user', id: 1 } });
    jest.spyOn(reflector, 'getAllAndMerge').mockReturnValueOnce(['admin']);
    try {
      await guard.canActivate(mockContext);
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect(error.message).toBe('Access denied. Insufficient permissions.');
    }
  });

  it('should throw UnauthorizedException if user does not have the required role and is not authenticated', async () => {
    mockRequestFn.mockReturnValueOnce({ user: { role: 'user' } });
    jest.spyOn(reflector, 'getAllAndMerge').mockReturnValueOnce(['admin']);
    try {
      await guard.canActivate(mockContext);
    } catch (error) {
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.message).toBe('User is not authenticated or authorized.');
    }
  });
});
