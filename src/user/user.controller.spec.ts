import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { AuthGuard } from '../common/guards/auth/auth.guard';
import { UserAccessGuard } from '../common/guards/user-access/user-access.guard';

const mockUserService = {
  findOne: jest.fn(),
};

describe('UserController', () => {
  let controller: UserController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: mockUserService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: jest.fn(),
      })
      .overrideGuard(UserAccessGuard)
      .useValue({
        canActivate: jest.fn(),
      })
      .compile();

    controller = module.get<UserController>(UserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
