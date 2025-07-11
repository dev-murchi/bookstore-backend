import { Reflector } from '@nestjs/core';
import { RoleEnum } from 'src/common/enum/role.enum';

export const Roles = Reflector.createDecorator<RoleEnum[]>();
