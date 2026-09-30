import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { RecoverDto } from './dto/recover.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import {
  CurrentUser,
  Public,
} from '../../common/decorators/access.decorator.js';
import type { AuthenticatedRequest } from '../../common/decorators/access.decorator.js';
import type { Profile } from '../../generated/prisma/client.js';
@ApiTags('Auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  register(@Body() data: RegisterDto) {
    return this.service.register(data);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  login(@Body() data: LoginDto) {
    return this.service.login(data);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() data: RefreshDto) {
    return this.service.refresh(data.refreshToken);
  }

  @Post('logout')
  logout(@Req() req: AuthenticatedRequest) {
    return this.service.logout(req.accessToken);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('recover')
  requestPasswordReset(@Body() data: RecoverDto) {
    return this.service.requestPasswordReset(data.email);
  }

  @Post('reset-password')
  resetPassword(
    @Req() req: AuthenticatedRequest,
    @Body() data: ResetPasswordDto,
  ) {
    return this.service.resetPassword(req.accessToken, data.password);
  }

  @Get('me')
  readProfile(@CurrentUser() user: Profile) {
    return user;
  }

  @Patch('me')
  updateProfile(@CurrentUser() user: Profile, @Body() data: UpdateProfileDto) {
    return this.service.updateProfile(user.id, data);
  }
}
