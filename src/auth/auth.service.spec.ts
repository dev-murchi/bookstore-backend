import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';

const mockUserService = {
  create: jest.fn(),
  findBy: jest.fn(),
};

const mockJwtService = {
  signAsync: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;
  let userService: UserService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
    jwtService = module.get<JwtService>(JwtService);
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

  describe('login', () => {
    it('should throw UnauthorizedException error when user is not exist', async () => {
      jest.spyOn(userService, 'findBy').mockResolvedValue(null as never);
      try {
        await service.login({
          email: 'testuser@email.com',
          password: 'password123',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.message).toBe('Invalid user credentials');
      }
    });

    it('should throw UnauthorizedException error when password is incorrect', async () => {
      const user = {
        id: 1,
        name: 'test user',
        email: 'testuser@email.com',
        password: 'password123',
        role: 'user',
      };

      jest.spyOn(userService, 'findBy').mockResolvedValue(user as never);

      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      try {
        await service.login({
          email: 'testuser@email.com',
          password: 'password123',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.message).toBe('Invalid user credentials');
      }
    });

    it('should return an access token if login is successful', async () => {
      const user = {
        id: 1,
        name: 'test user',
        email: 'testuser@email.com',
        password: 'password123',
        role: 'user',
      };

      jest.spyOn(userService, 'findBy').mockResolvedValue(user as never);

      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      jest
        .spyOn(jwtService, 'signAsync')
        .mockResolvedValue('accesstoken' as never);

      const result = await service.login({
        email: 'testuser@email.com',
        password: 'password123',
      });

      expect(result).toEqual({ accessToken: 'accesstoken' });
    });
  });
});
