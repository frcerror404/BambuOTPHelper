import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: true,
  });
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.useStaticAssets(join(__dirname, '.', 'public'));

  await app.listen(port);
  console.log(`Bambu OTP Service listening on port ${port}`);
}

bootstrap();
