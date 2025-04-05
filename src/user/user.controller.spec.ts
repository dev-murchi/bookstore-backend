import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';

const mockUserService = {
  findOne: jest.fn(),
};

jest.mock('../common/guards/auth/auth.guard', () => {
  return {
    AuthGuard: jest.fn().mockImplementation(() => ({
      canActivate: jest.fn().mockResolvedValue(true),
    })),
  };
});

describe('UserController', () => {
  let controller: UserController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: mockUserService }],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
