import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { BadRequestException } from '@nestjs/common';

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserService],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should successfully create a user if email is not taken', async () => {
      const user: CreateUserDto = new CreateUserDto();
      user.name = 'test user';
      user.email = 'testuser@email.com';
      user.password = 'password123';

      const result = await service.create(user);

      expect(result).toEqual({ message: 'User registered successfully' });
    });

    it('should throw an error if email is already in use', async () => {
      const user = new CreateUserDto();
      user.name = 'test user';
      user.email = 'testuser@email.com';
      user.password = 'password123';

      // create user
      await service.create({
        name: 'test user 2',
        email: 'testuser@email.com',
        password: 'password123',
      });
      try {
        await service.create(user);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Email already in use');
      }
    });
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      expect(await service.findAll()).toEqual([]);

      const user = new CreateUserDto();
      user.name = 'test user';
      user.email = 'testuser@email.com';
      user.password = 'password123';

      const users = [
        {
          email: 'testuser@email.com',
          name: 'test user',
          password: 'password123',
          role: 'user',
          id: 1,
        },
      ];

      await service.create(user);

      expect(await service.findAll()).toEqual(users);
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      const newUser = new CreateUserDto();
      newUser.name = 'test user';
      newUser.email = 'testuser@email.com';
      newUser.password = 'password123';

      await service.create(newUser);

      const user = await service.findOne(1);

      expect(user).toEqual({ ...newUser, role: 'user', id: 1 });
    });

    it('should return null an error if the user does not exist', async () => {
      expect(await service.findOne(999)).toBeNull();
    });
  });

  describe('findBy', () => {
    it('should return a user by email', async () => {
      const newUser = new CreateUserDto();
      newUser.name = 'test user';
      newUser.email = 'testuser@email.com';
      newUser.password = 'password123';

      await service.create(newUser);

      const user = await service.findBy('testuser@email.com');

      expect(user).toEqual({ ...newUser, role: 'user', id: 1 });
    });

    it('should return null if the user does not exist', async () => {
      expect(await service.findBy('invaliduser@email.com')).toBeNull();
    });
  });

  describe('update', () => {
    it('should successfully update a user', async () => {
      const user = new CreateUserDto();
      user.name = 'test user';
      user.email = 'testuser@email.com';
      user.password = 'password123';

      await service.create(user);

      const updatedUserDto: UpdateUserDto = {
        name: 'updated test user',
        email: 'updatedtestuser@email.com',
        password: 'newpassword123',
      };

      const result = await service.update(1, updatedUserDto);

      expect(result).toEqual({ message: 'User updated successfully' });
      const updateUser = await service.findOne(1);
      expect(updateUser.name).toBe('updated test user');
      expect(updateUser.email).toBe('updatedtestuser@email.com');
      expect(updateUser.password).toBe('newpassword123');
    });

    it('should throw an error if user does not exist', async () => {
      const user: UpdateUserDto = {
        name: 'updated test user',
        email: 'updatedtestuser@email.com',
        password: 'newpassword123',
      };

      try {
        await service.update(999, user);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('User could not be updated');
      }
    });
  });

  describe('remove', () => {
    it('should successfully delete a user', async () => {
      const user = new CreateUserDto();
      user.name = 'test user';
      user.email = 'testuser@email.com';
      user.password = 'password123';

      await service.create(user);

      const result = await service.remove(1);
      expect(result).toEqual({ message: 'User deleted successfully' });

      expect(await service.findOne(1)).toBeNull();
    });
    it('should throw an error if user does not exist', async () => {
      try {
        await service.remove(1);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('User could not be deleted');
      }
    });
  });
});
