import { BadRequestException, Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

interface LoginDto {
  username: string;
  password: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: LoginDto) {
    if (!body?.username || !body?.password) {
      throw new BadRequestException('Username and password are required');
    }

    if (!this.authService.validateCredentials(body.username, body.password)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.authService.issueToken(body.username);
  }
}
