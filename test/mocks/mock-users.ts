import { RoleEnum } from 'src/common/enum/role.enum';

export const adminUser = {
  name: 'Test Admin',
  email: 'testadmin@email.com',
  password: 'TestPassword.123',
  role: RoleEnum.Admin,
  isActive: true,
  lastPasswordResetAt: new Date(),
};

export const registeredUser = {
  name: 'Test User',
  email: 'testuser@email.com',
  password: 'TestPassword.123',
  role: 'user',
  isActive: true,
  lastPasswordResetAt: new Date(),
};

export const resetTargetUser = {
  name: 'Reset User',
  email: 'resetuser@email.com',
  password: 'TestPassword.123',
  role: 'user',
  isActive: true,
  lastPasswordResetAt: new Date(),
};

export const authorUser = {
  name: 'Test Author',
  email: 'testauthor@email.com',
  password: 'TestPassword.123',
  role: RoleEnum.Author,
  isActive: true,
  lastPasswordResetAt: new Date(),
};
