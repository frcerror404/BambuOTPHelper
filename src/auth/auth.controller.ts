import {
  Body,
  Controller,
  Get,
  Post,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from './auth.guard';
import { AuthService, FIVE_YEARS_SECONDS } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(
    @Body('username') username: string,
    @Body('password') password: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!this.authService.validateCredentials(username, password)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.authService.issueToken(username);

    res.cookie(this.authService.tokenCookieName, token, this.authService.getCookieOptions());

    return {
      token,
      expiresInSeconds: FIVE_YEARS_SECONDS,
    };
  }

  @UseGuards(AuthGuard)
  @Get('me')
  me() {
    return { ok: true };
  }
}
