import { Response } from 'express';
import { ApiResponse, PaginationInfo } from '../types';

export class ResponseUtil {
  static success<T>(
    res: Response,
    data?: T,
    message?: string,
    statusCode: number = 200,
    pagination?: PaginationInfo
  ): Response {
    const response: ApiResponse<T> = {
      success: true,
      ...(data !== undefined && { data }),
      ...(message && { message }),
      ...(pagination && { pagination }),
    };

    return res.status(statusCode).json(response);
  }

  static created<T>(
    res: Response,
    data?: T,
    message: string = 'Resource created successfully'
  ): Response {
    return this.success(res, data, message, 201);
  }

  static noContent(res: Response, message?: string): Response {
    const response: ApiResponse = {
      success: true,
      ...(message && { message }),
    };

    return res.status(204).json(response);
  }

  static error(
    res: Response,
    message: string,
    code?: string,
    statusCode: number = 500,
    errors?: any[]
  ): Response {
    const response: ApiResponse = {
      success: false,
      message,
      ...(code && { code }),
      ...(errors && { errors }),
    };

    return res.status(statusCode).json(response);
  }

  static notFound(
    res: Response,
    message: string = 'Resource not found',
    code?: string
  ): Response {
    return this.error(res, message, code, 404);
  }

  static badRequest(
    res: Response,
    message: string = 'Bad request',
    code?: string,
    errors?: any[]
  ): Response {
    return this.error(res, message, code, 400, errors);
  }

  static unauthorized(
    res: Response,
    message: string = 'Unauthorized',
    code?: string
  ): Response {
    return this.error(res, message, code, 401);
  }

  static forbidden(
    res: Response,
    message: string = 'Forbidden',
    code?: string
  ): Response {
    return this.error(res, message, code, 403);
  }
}

export const sendSuccess = ResponseUtil.success;
export const sendCreated = ResponseUtil.created;
export const sendNoContent = ResponseUtil.noContent;
export const sendError = ResponseUtil.error;
export const sendNotFound = ResponseUtil.notFound;
export const sendBadRequest = ResponseUtil.badRequest;
export const sendUnauthorized = ResponseUtil.unauthorized;
export const sendForbidden = ResponseUtil.forbidden;
