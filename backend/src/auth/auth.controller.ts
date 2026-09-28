import { Controller, Post, Body, Get, UseGuards, Request, Patch, Param } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() body: any) {
    return this.authService.login(body.email, body.password);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  async getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.sub);
  }

  @UseGuards(AuthGuard)
  @Post('register')
  async register(@Body() body: CreateUserDto, @Request() req: any) {
    return this.authService.register(body, req.user.sub);
  }

  @UseGuards(AuthGuard)
  @Get('users')
  async getAllUsers(@Request() req: any) {
    return this.authService.getAllUsers(req.user.sub);
  }

  @UseGuards(AuthGuard)
  @Patch('users/:id/toggle-active')
  async toggleUserActive(@Param('id') id: string, @Request() req: any) {
    return this.authService.toggleUserActive(Number(id), req.user.sub);
  }

  @UseGuards(AuthGuard)
  @Post('change-password')
  async changeOwnPassword(@Body() body: any, @Request() req: any) {
    return this.authService.changeOwnPassword(req.user.sub, body.currentPassword, body.newPassword);
  }

  @UseGuards(AuthGuard)
  @Post('users/:id/reset-password')
  async resetPasswordByAdmin(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.authService.resetPasswordByAdmin(req.user.sub, Number(id), body.newPassword);
  }
}
