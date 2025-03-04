import { Test, TestingModule } from '@nestjs/testing';
import { RoleGuard } from './role.guard';
import { Reflector } from '@nestjs/core';

const mockReflector = {
  getAllAndOverride: jest.fn(),
};
describe('RoleGuard', () => {
  let roleGuard: RoleGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RoleGuard, { provide: Reflector, useValue: mockReflector }],
    }).compile();

    roleGuard = module.get<RoleGuard>(RoleGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
  it('should be defined', () => {
    expect(roleGuard).toBeDefined();
  });
});
