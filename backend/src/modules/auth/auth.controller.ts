import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service.js';
import { AuthUser } from './jwt-auth.guard.js';
import { Public } from './public.decorator.js';
import { LoginDto } from './dto/login.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password);
  }

  @Get('me')
  me(@Req() req: Request & { user?: AuthUser }) {
    return this.authService.me(req.user!.sub);
  }
}