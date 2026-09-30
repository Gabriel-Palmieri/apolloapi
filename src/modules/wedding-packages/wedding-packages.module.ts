import { Module } from '@nestjs/common';
import { WeddingPackagesController } from './wedding-packages.controller.js';
import { WeddingPackagesService } from './wedding-packages.service.js';

@Module({ controllers: [WeddingPackagesController], providers: [WeddingPackagesService] })
export class WeddingPackagesModule {}
