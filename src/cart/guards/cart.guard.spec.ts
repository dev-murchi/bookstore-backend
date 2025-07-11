import { CartGuard } from './cart.guard';
import { RoleEnum } from 'src/common/enum/role.enum';
import { ExecutionContext } from '@nestjs/common';

const mockRequestFn = jest.fn();

const mockExecutionContext = {
  switchToHttp: () => ({
    getRequest: mockRequestFn,
  }),
} as unknown as ExecutionContext;

describe('CartGuard', () => {
  let guard: CartGuard;

  beforeEach(() => {
    guard = new CartGuard();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should throw error if err is provided', () => {
    const error = new Error('Auth error');

    expect(() =>
      guard.handleRequest(error, null, null, {} as ExecutionContext),
    ).toThrow('Auth error');
  });

  it('should return user with guestCartToken = null if user is present', () => {
    const user = { id: 'user1', role: RoleEnum.User };
    mockRequestFn.mockReturnValue({ headers: {} });

    const result = guard.handleRequest(null, user, null, mockExecutionContext);

    expect(result).toEqual({ ...user, guestCartToken: null });
  });

  it('should return guest user with token if x-guest-cart-token is present', () => {
    mockRequestFn.mockReturnValue({
      headers: { 'x-guest-cart-token': 'abc123' },
    });

    const result = guard.handleRequest(null, null, null, mockExecutionContext);

    expect(result).toEqual({
      id: null,
      role: RoleEnum.GuestUser,
      guestCartToken: 'abc123',
    });
  });

  it('should return guest user with null token if header is missing', () => {
    mockRequestFn.mockReturnValue({ headers: {} });

    const result = guard.handleRequest(null, null, null, mockExecutionContext);

    expect(result).toEqual({
      id: null,
      role: RoleEnum.GuestUser,
      guestCartToken: null,
    });
  });

  it('should return guest user with null token if header is blank', () => {
    mockRequestFn.mockReturnValue({ headers: { 'x-guest-cart-token': '   ' } });

    const result = guard.handleRequest(null, null, null, mockExecutionContext);

    expect(result).toEqual({
      id: null,
      role: RoleEnum.GuestUser,
      guestCartToken: null,
    });
  });
});
