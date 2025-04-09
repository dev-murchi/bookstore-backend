import { Reflector } from '@nestjs/core';
import { RoleEnum } from 'src/common/role.enum';

export const Role = Reflector.createDecorator<RoleEnum>();
