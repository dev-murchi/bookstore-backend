import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCategoryDTO } from 'src/common/dto/create-category.dto';
import { CustomAPIError } from 'src/common/errors/custom-api.error';
import { CategoryDTO } from 'src/common/dto/category.dto';

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}
  async getAll(): Promise<CategoryDTO[]> {
    try {
      const categories = await this.prisma.category.findMany({
        select: { id: true, name: true },
      });

      return categories.map(
        (category) => new CategoryDTO(category.id, category.name),
      );
    } catch (error) {
      console.error('Categories could not be fetched. Error:', error);
      throw new Error('Categories could not be fetched.');
    }
  }

  async create(createCategoryDTO: CreateCategoryDTO): Promise<CategoryDTO> {
    try {
      const category = await this.prisma.category.create({
        data: { name: createCategoryDTO.value },
        select: { id: true, name: true },
      });

      return new CategoryDTO(category.id, category.name);
    } catch (error) {
      console.error('Category could not be created. Error:', error);
      // unique constraint
      if (error.code === 'P2002')
        throw new CustomAPIError('Category is already exist.');
      throw new Error('Category could not be created.');
    }
  }

  async update(categoryId: number, name: string) {
    try {
      const category = await this.prisma.category.update({
        where: { id: categoryId },
        data: { name: name },
        select: { id: true, name: true },
      });

      return new CategoryDTO(category.id, category.name);
    } catch (error) {
      console.error('Category name could not be updated. Error:', error);
      throw new Error('Category name could not be updated.');
    }
  }

  async delete(categoryId: number) {
    try {
      await this.prisma.category.delete({ where: { id: categoryId } });
      return { message: 'Category deleted successfully' };
    } catch (error) {
      console.error('Category name could not be deleted. Error:', error);
      throw new Error('Category name could not be deleted.');
    }
  }
}
