import { RefreshGuard } from './refresh.guard';
import { UnauthorizedException } from '@nestjs/common';

describe('RefreshGuard', () => {
  let guard: RefreshGuard;

  beforeEach(() => {
    guard = new RefreshGuard();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should throw the error if err is provided', () => {
    const error = new Error('Auth error');

    expect(() => guard.handleRequest(error, null, null, {} as any)).toThrow(
      'Auth error',
    );
  });

  it('should throw UnauthorizedException if user is null', () => {
    expect(() => guard.handleRequest(null, null, null, {} as any)).toThrowError(
      new UnauthorizedException('User not found or refresh token is invalid.'),
    );
  });

  it('should return user if valid', () => {
    const user = { id: 'user1', role: 'User' };
    const result = guard.handleRequest(null, user, null, {} as any);
    expect(result).toBe(user);
  });
});
