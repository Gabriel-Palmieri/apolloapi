import { Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { SupabaseService } from './supabase.service.js';
import { ProfilesController } from './profiles.controller.js';
@Module({
  controllers: [AuthController, ProfilesController],
  providers: [AuthService, SupabaseService],
  exports: [AuthService],
})
export class AuthModule {}
