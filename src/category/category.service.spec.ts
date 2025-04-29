import { Test, TestingModule } from '@nestjs/testing';
import { CategoryService } from './category.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDTO } from './dto/create-category.dto';

const mockPrismaService = {
  category: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('CategoryService', () => {
  let service: CategoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAll', () => {
    it('should return a list of categories', async () => {
      const expectedCategories = [
        { id: 1, category_name: 'Fiction' },
        { id: 2, category_name: 'Non-fiction' },
      ];
      mockPrismaService.category.findMany.mockResolvedValue(expectedCategories);

      const result = await service.getAll();

      expect(result).toEqual([
        { id: 1, category_name: 'Fiction' },
        { id: 2, category_name: 'Non-fiction' },
      ]);
      expect(mockPrismaService.category.findMany).toHaveBeenCalledWith({
        select: { id: true, category_name: true },
      });
    });

    it('should throw an error if categories could not be fetched', async () => {
      mockPrismaService.category.findMany.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.getAll()).rejects.toThrow(
        'Book Categories could not be fetched.',
      );
    });
  });

  describe('create', () => {
    it('should create a new category', async () => {
      const createCategoryDTO: CreateCategoryDTO = { category: 'Science' };
      const createdCategory = { id: 1, category_name: 'Science' };
      mockPrismaService.category.create.mockResolvedValue(createdCategory);

      const result = await service.create(createCategoryDTO);

      expect(result).toEqual({ id: 1, category_name: 'Science' });
      expect(mockPrismaService.category.create).toHaveBeenCalledWith({
        data: { category_name: createCategoryDTO.category },
        select: { id: true, category_name: true },
      });
    });

    it('should throw an error if the category could not be created', async () => {
      const createCategoryDTO: CreateCategoryDTO = { category: 'Science' };
      mockPrismaService.category.create.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.create(createCategoryDTO)).rejects.toThrow(
        'Book Category could not be created',
      );
    });
  });

  describe('update', () => {
    it('should update category name', async () => {
      mockPrismaService.category.update.mockResolvedValueOnce({
        id: 1,
        category_name: 'new-category',
      });

      const category = await service.update(1, 'new-category');

      expect(category).toEqual({ id: 1, category_name: 'new-category' });
    });

    it('should throw an error if the category name could not be updated', async () => {
      mockPrismaService.category.update.mockRejectedValueOnce(
        new Error('DB Error'),
      );

      await expect(service.update(1, 'new-category')).rejects.toThrow(
        new Error('Category name could not be updated.'),
      );
    });
  });

  describe('delete', () => {
    it('should delete category name', async () => {
      mockPrismaService.category.delete.mockResolvedValueOnce({});

      const result = await service.delete(1);

      expect(mockPrismaService.category.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });

      expect(result).toEqual({ message: 'Category deleted successfully' });
    });

    it('should throw an error if the category name could not be deleted', async () => {
      mockPrismaService.category.delete.mockRejectedValueOnce(
        new Error('DB Error'),
      );

      await expect(service.delete(1)).rejects.toThrow(
        new Error('Category name could not be deleted.'),
      );
    });
  });
});
