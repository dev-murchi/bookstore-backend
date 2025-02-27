import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../user/dto/create-user.dto';

const mockUserService = {
  create: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;
  let userService: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should hash the password and call the create method of userService', async () => {
      const user: CreateUserDto = {
        name: 'test user',
        email: 'testuser@email.com',
        password: 'password123',
      };

      const hashedPassword = 'hashedPassword';

      jest.spyOn(bcrypt, 'hash').mockResolvedValue(hashedPassword as never);

      mockUserService.create.mockResolvedValue({
        message: 'User registered successfully',
      });

      const result = await service.register(user);

      expect(bcrypt.hash).toHaveBeenCalledWith(user.password, 10);
      expect(userService.create).toHaveBeenCalledWith({
        ...user,
        password: hashedPassword,
      });

      expect(result).toEqual({ message: 'User registered successfully' });
    });

    it('should handle error when bcrypt.hash fails', async () => {
      const user: CreateUserDto = {
        name: 'test user',
        email: 'test email',
        password: 'password123',
      };

      jest
        .spyOn(bcrypt, 'hash')
        .mockRejectedValue(new Error('Hashing failed') as never);

      await expect(service.register(user)).rejects.toThrow('Hashing failed');
    });

    it('should handle error when userService.create fails', async () => {
      const user: CreateUserDto = {
        name: 'test user',
        email: 'test email',
        password: 'password123',
      };

      const hashedPassword = 'hashedPassword';

      jest.spyOn(bcrypt, 'hash').mockResolvedValue(hashedPassword as never);

      jest
        .spyOn(userService, 'create')
        .mockRejectedValueOnce(new Error('User creation failed') as never);

      await expect(service.register(user)).rejects.toThrow(
        'User creation failed',
      );
    });
  });
});
