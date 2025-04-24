import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CreateCategoryDTO } from './dto/create-category.dto';
import { CategoryService } from './category.service';
import { UserAccessGuard } from '../common/guards/user-access/user-access.guard';
import { Roles } from '../common/decorator/role/role.decorator';
import { RoleEnum } from '../common/role.enum';

@Controller('category')
export class CategoryController {
  constructor(private categoryService: CategoryService) {}
  @Get()
  async viewAllCategories() {
    return await this.categoryService.getAll();
  }

  @Post()
  @UseGuards(UserAccessGuard)
  @Roles([RoleEnum.Admin])
  async creatCategory(@Body() createCategoryDTO: CreateCategoryDTO) {
    return await this.categoryService.create(createCategoryDTO);
  }
}
