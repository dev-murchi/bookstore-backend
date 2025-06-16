import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const PORT = process.env.PORT ?? 3001;
  const HOST_PORT = process.env.HOST_PORT ?? 3001;

  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    bodyParser: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Book Store')
    .setDescription('Book Store API description')
    .setVersion('v1.0.0')
    .addBearerAuth()
    .addServer(`http://localhost:${HOST_PORT}/api/v1`, 'API v1')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  document.tags = [
    {
      name: 'Auth',
      description:
        'Handles user registration, login, logout, and password reset.',
    },
    {
      name: 'Users',
      description:
        'Manage user profiles, reviews, orders and admin user operations.',
    },
    {
      name: 'Books',
      description: 'Manage books, search, filter, and submit reviews.',
    },
    {
      name: 'Cart',
      description:
        'Shopping cart creation, updates, checkout, and item management.',
    },
    {
      name: 'Orders',
      description:
        'View and update orders, process refunds, and track order status.',
    },
    {
      name: 'Reviews',
      description: 'Manage book reviews with pagination and ratings.',
    },
    {
      name: 'Categories',
      description:
        'Admin-only endpoints to create, update, and delete book categories.',
    },
    {
      name: 'Payment',
      description: 'Handle Stripe webhook events for payment updates.',
    },
  ];

  SwaggerModule.setup('api/v1/docs', app, document, {
    swaggerOptions: {
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
    },
  });

  app.setGlobalPrefix('api/v1');

  await app.listen(PORT);
}
bootstrap();
