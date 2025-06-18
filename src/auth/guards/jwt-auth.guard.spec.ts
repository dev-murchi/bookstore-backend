import { JwtAuthGuard } from './jwt-auth.guard';
import { RoleEnum } from '../../common/enum/role.enum';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should throw an error if err is provided', () => {
    const error = new Error('Some auth error');

    expect(() => guard.handleRequest(error, null, null, {} as any)).toThrow(
      'Some auth error',
    );
  });

  it('should return guest user if user is not provided', () => {
    const result = guard.handleRequest(null, null, null, {} as any);

    expect(result).toEqual({
      id: null,
      role: RoleEnum.GuestUser,
    });
  });

  it('should return the user if user is present', () => {
    const user = { id: 'u1', role: RoleEnum.Admin };

    const result = guard.handleRequest(null, user, null, {} as any);

    expect(result).toBe(user);
  });
});
