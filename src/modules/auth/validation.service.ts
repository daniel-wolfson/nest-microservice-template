import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { validate, ValidationError } from 'class-validator';
import { plainToClass } from 'class-transformer';

@Injectable()
export class ValidationService {
    private readonly logger = new Logger(ValidationService.name);

    /**
     * Validates a DTO object and throws BadRequestException if validation fails
     * @param dtoClass The DTO class to validate against
     * @param data The data to validate
     * @param context Optional context for logging
     * @returns The validated and transformed object
     */
    async validateDto<T extends object>(dtoClass: new () => T, data: any, context?: string): Promise<T> {
        this.logger.debug(`validateDto: Validating ${dtoClass.name}${context ? ` in ${context}` : ''}`);

        // Transform plain object to DTO class instance
        const dto = plainToClass(dtoClass, data);

        // Validate the DTO
        const validationErrors = await validate(dto);

        if (validationErrors.length > 0) {
            const formattedErrors = this.formatValidationErrors(validationErrors);

            this.logger.warn(`validateDto: Validation failed for ${dtoClass.name}`, {
                context,
                errors: formattedErrors,
                data: this.sanitizeDataForLogging(data),
            });

            throw new BadRequestException({
                success: false,
                message: `Validation failed for ${dtoClass.name}`,
                errors: formattedErrors,
                timestamp: new Date().toISOString(),
            });
        }

        this.logger.debug(`validateDto: Validation successful for ${dtoClass.name}${context ? ` in ${context}` : ''}`);
        return dto;
    }

    /**
     * Validates a DTO object and returns validation errors without throwing
     * @param dtoClass The DTO class to validate against
     * @param data The data to validate
     * @returns Object with isValid boolean and errors array
     */
    async validateDtoSilent<T extends object>(
        dtoClass: new () => T,
        data: any,
    ): Promise<{ isValid: boolean; errors: Record<string, string[]>; dto?: T }> {
        const dto = plainToClass(dtoClass, data);
        const validationErrors = await validate(dto);

        if (validationErrors.length > 0) {
            return {
                isValid: false,
                errors: this.formatValidationErrors(validationErrors),
            };
        }

        return {
            isValid: true,
            errors: {},
            dto,
        };
    }

    /**
     * Formats validation errors into a more readable structure
     * @param errors Array of ValidationError objects
     * @returns Formatted errors object
     */
    private formatValidationErrors(errors: ValidationError[]): Record<string, string[]> {
        return errors.reduce((acc, error) => {
            const constraints = error.constraints ? Object.values(error.constraints) : [];
            const childErrors = this.formatChildErrors(error.children || []);

            acc[error.property] = [...constraints, ...childErrors];
            return acc;
        }, {} as Record<string, string[]>);
    }

    /**
     * Recursively formats child validation errors (for nested objects)
     * @param children Array of child ValidationError objects
     * @returns Array of formatted child error messages
     */
    private formatChildErrors(children: ValidationError[]): string[] {
        return children.reduce((acc, child) => {
            const constraints = child.constraints ? Object.values(child.constraints) : [];
            const childErrors = this.formatChildErrors(child.children || []);

            const formattedConstraints = constraints.map(constraint => `${child.property}: ${constraint}`);
            const formattedChildErrors = childErrors.map(childError => `${child.property}.${childError}`);

            return [...acc, ...formattedConstraints, ...formattedChildErrors];
        }, [] as string[]);
    }

    /**
     * Sanitizes data for logging by removing sensitive fields
     * @param data The data to sanitize
     * @returns Sanitized data object
     */
    private sanitizeDataForLogging(data: any): any {
        if (!data || typeof data !== 'object') {
            return data;
        }

        const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
        const sanitized = { ...data };

        for (const field of sensitiveFields) {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        }

        return sanitized;
    }
}
