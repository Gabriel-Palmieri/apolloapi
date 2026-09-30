import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (error instanceof HttpException)
      return response.status(error.getStatus()).json(error.getResponse());
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (['P2002', 'P2003', 'P2004', 'P2034'].includes(error.code))
        return response.status(409).json({
          statusCode: 409,
          message: 'Conflito com os dados existentes.',
        });
      if (error.code === 'P2025')
        return response
          .status(404)
          .json({ statusCode: 404, message: 'Registro não encontrado.' });
    }
    // Never log raw SDK/database errors: they may contain credentials or customer data.
    this.logger.error(error instanceof Error ? error.name : 'UnknownError');
    return response.status(500).json({
      statusCode: 500,
      message: 'Não foi possível concluir a operação.',
    });
  }
}
