import { Module } from '@nestjs/common';
import { VirtualFittingController } from './virtual-fitting.controller.js';
import { VirtualFittingService } from './virtual-fitting.service.js';

@Module({ controllers: [VirtualFittingController], providers: [VirtualFittingService] })
export class VirtualFittingModule {}
