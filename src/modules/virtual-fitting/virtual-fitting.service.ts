import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { File } from 'node:buffer';
import { fal } from '@fal-ai/client';
import { PrismaService } from '../prisma/prisma.service.js';

export interface FittingImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxImageBytes = 10 * 1024 * 1024;
const model = 'fal-ai/fashn/tryon/v1.6';

function isValidImage(image: FittingImage): boolean {
  if (!allowedMimeTypes.has(image.mimetype) || image.size > maxImageBytes)
    return false;
  if (image.mimetype === 'image/jpeg')
    return image.buffer[0] === 0xff && image.buffer[1] === 0xd8 && image.buffer[2] === 0xff;
  if (image.mimetype === 'image/png')
    return image.buffer
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return (
    image.buffer.subarray(0, 4).toString() === 'RIFF' &&
    image.buffer.subarray(8, 12).toString() === 'WEBP'
  );
}

@Injectable()
export class VirtualFittingService {
  private readonly falKey: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.falKey = config.get<string>('FAL_KEY');
    if (this.falKey) fal.config({ credentials: this.falKey });
  }

  async generate(
    productId: string,
    photo?: FittingImage,
    garment?: FittingImage,
    consent?: string,
  ) {
    if (consent !== 'true')
      throw new BadRequestException(
        'Confirme o envio das fotos à Fal.ai antes de gerar a prévia.',
      );
    if (!photo || !garment)
      throw new BadRequestException('Envie sua foto e a foto do traje escolhido.');
    if (!isValidImage(photo) || !isValidImage(garment))
      throw new BadRequestException(
        'Use imagens JPG, PNG ou WebP válidas, com até 10 MB cada.',
      );
    if (!this.falKey)
      throw new ServiceUnavailableException(
        'O provador ainda não está configurado no servidor.',
      );

    const product = await this.prisma.product.findFirst({
      where: { id: productId, active: true, category: 'Terno' },
      select: { name: true, color: true, fabric: true },
    });
    if (!product)
      throw new BadRequestException(
        'Este traje não está disponível para o provador.',
      );

    try {
      const [modelImage, garmentImage] = await Promise.all([
        this.upload(photo, 'foto-pessoa'),
        this.upload(garment, 'foto-traje'),
      ]);
      const result = await fal.subscribe(model, {
        input: {
          model_image: modelImage,
          garment_image: garmentImage,
          category: 'auto',
          mode: 'balanced',
          garment_photo_type: 'auto',
          num_samples: 1,
          output_format: 'jpeg',
        },
        logs: false,
      });
      const imageUrl = result.data.images?.[0]?.url;
      if (!imageUrl)
        throw new ServiceUnavailableException(
          'A Fal.ai não retornou uma imagem. Tente outra foto.',
        );
      return { imageUrl, product };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException(
        'Não foi possível gerar a prova agora. Tente novamente mais tarde.',
      );
    }
  }

  private upload(image: FittingImage, name: string) {
    const file = new File([image.buffer], `${name}.${this.extension(image.mimetype)}`, {
      type: image.mimetype,
    });
    return fal.storage.upload(file as unknown as Blob);
  }

  private extension(mimeType: string) {
    return mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1];
  }
}
