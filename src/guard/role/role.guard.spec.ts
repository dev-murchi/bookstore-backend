import { Test, TestingModule } from '@nestjs/testing';
import { RoleGuard } from './role.guard';
import { Reflector } from '@nestjs/core';
import { UnauthorizedException } from '@nestjs/common';

const mockReflector = {
  getAllAndOverride: jest.fn(),
};
describe('RoleGuard', () => {
  let roleGuard: RoleGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RoleGuard, { provide: Reflector, useValue: mockReflector }],
    }).compile();

    roleGuard = module.get<RoleGuard>(RoleGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
  it('should be defined', () => {
    expect(roleGuard).toBeDefined();
  });

  it('should throw an error when user is unauthenticatd', () => {
    const context = {
      switchToHttp: () => {
        return {
          getRequest: () => ({}),
        };
      },
    };

    try {
      roleGuard.canActivate(context as any);
    } catch (error) {
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.message).toBe('Authentication failed.');
      expect(reflector.getAllAndOverride).toHaveBeenCalledTimes(0);
    }
  });

  it('should throw an error when user role does not match', () => {
    const context = {
      switchToHttp: () => {
        return {
          getRequest: () => ({
            user: {
              id: 1,
              name: 'test user',
              email: 'teestuser@email.com',
              password: 'password',
              role: {
                id: 1,
                name: 'user',
              },
            },
          }),
        };
      },
      getHandler: () => {},
      getClass: () => {},
    };

    mockReflector.getAllAndOverride.mockReturnValueOnce('testrole');

    try {
      roleGuard.canActivate(context as any);
    } catch (error) {
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.message).toBe('Unauthorized user.');
    }
  });

  it('should allow to access', () => {
    const context = {
      switchToHttp: () => {
        return {
          getRequest: () => ({
            user: {
              id: 1,
              name: 'test user',
              email: 'teestuser@email.com',
              password: 'password',
              role: {
                id: 1,
                name: 'user',
              },
            },
          }),
        };
      },
      getHandler: () => {},
      getClass: () => {},
    };

    mockReflector.getAllAndOverride.mockReturnValueOnce('user');

    const result = roleGuard.canActivate(context as any);

    expect(result).toBe(true);
  });
});
