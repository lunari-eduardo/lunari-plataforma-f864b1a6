/**
 * Core Services Barrel Export
 * Centralized access to all core services
 */

export { StorageService, storageService } from './StorageService';
export { ValidationService, validationService } from './ValidationService';
export { ErrorHandlingService, errorHandler } from './ErrorHandlingService';

export type { StorageMetadata, WithMetadata } from './StorageService';
export type { ValidationResult, FieldValidation } from './ValidationService';
export type { ErrorContext, SystemError } from './ErrorHandlingService';