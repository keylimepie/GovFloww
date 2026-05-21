// =============================================
// Zod Validation Pipe for NestJS
// =============================================
// Uses Zod schemas from @govflow/shared for request validation.

import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map(
          (err) => `${err.path.join('.')}: ${err.message}`,
        );
        throw new BadRequestException({
          message: formattedErrors,
          error: 'Validation Failed',
        });
      }
      throw new BadRequestException('Invalid request data');
    }
  }
}
