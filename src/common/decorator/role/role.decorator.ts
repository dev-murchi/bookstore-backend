import { Reflector } from '@nestjs/core';
import { RoleEnum } from '../../enum/role.enum';

export const Roles = Reflector.createDecorator<RoleEnum[]>();
