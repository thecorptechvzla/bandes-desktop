import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { Public } from '../auth/public.decorator.js';
import { BlobService } from './blob.service.js';

@Controller('blob')
export class BlobController {
  constructor(private blobService: BlobService) {}

  @Public()
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('entityType') entityType?: string,
    @Body('entityId') entityId?: string,
  ) {
    return this.blobService.create(file, entityType, entityId);
  }

  @Public()
  @Get('view')
  async view(@Query('url') url: string, @Res() res: Response) {
    const attachment = await this.blobService.find(url);
    res.set({
      'Content-Type': attachment.mimeType,
      'Content-Disposition': `inline; filename="${attachment.filename}"`,
      'Cache-Control': 'public, max-age=86400',
    });
    res.send(attachment.data);
  }
}