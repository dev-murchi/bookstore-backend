import { Reflector } from '@nestjs/core';
import { RoleEnum } from '../../../common/role.enum';

export const Roles = Reflector.createDecorator<RoleEnum[]>();
