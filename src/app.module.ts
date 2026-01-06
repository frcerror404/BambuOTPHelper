import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { OtpModule } from './otp/otp.module';
import { ImapModule } from './imap/imap.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, 'client'),
      renderPath: '/*',
      exclude: ['/auth*', '/otp*', '/socket.io*'],
    }),
    AuthModule,
    OtpModule,
    ImapModule,
  ],
})
export class AppModule {}
