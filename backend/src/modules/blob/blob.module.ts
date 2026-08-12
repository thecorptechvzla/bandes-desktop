import { Module } from '@nestjs/common';
import { BlobController } from './blob.controller.js';
import { BlobService } from './blob.service.js';

@Module({
  controllers: [BlobController],
  providers: [BlobService],
  exports: [BlobService],
})
export class BlobModule {}