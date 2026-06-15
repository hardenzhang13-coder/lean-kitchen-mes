import { NextResponse } from "next/server";

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
} as const;

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export function success<T>(data: T, status: number = HTTP_STATUS.OK): NextResponse {
  return NextResponse.json(
    { success: true, data } satisfies ApiResponse<T>,
    { status }
  );
}

export function created<T>(data: T): NextResponse {
  return success(data, HTTP_STATUS.CREATED);
}

export function error(
  message: string,
  status: number = HTTP_STATUS.BAD_REQUEST,
  code?: string
): NextResponse {
  return NextResponse.json(
    { success: false, error: message, code } satisfies ApiResponse,
    { status }
  );
}

export function paginated<T>(
  data: T[],
  pagination: PaginationMeta,
  status = HTTP_STATUS.OK
): NextResponse {
  return NextResponse.json(
    { success: true, data, pagination } satisfies ApiResponse<T[]>,
    { status }
  );
}

export const badRequest = (message: string) =>
  error(message, HTTP_STATUS.BAD_REQUEST, "BAD_REQUEST");

export const unauthorized = (message = "未登录或登录已过期") =>
  error(message, HTTP_STATUS.UNAUTHORIZED, "UNAUTHORIZED");

export const forbidden = (message = "无权访问") =>
  error(message, HTTP_STATUS.FORBIDDEN, "FORBIDDEN");

export const notFound = (message = "资源不存在") =>
  error(message, HTTP_STATUS.NOT_FOUND, "NOT_FOUND");

export const conflict = (message: string) =>
  error(message, HTTP_STATUS.CONFLICT, "CONFLICT");

export const internalError = (message = "服务器内部错误") =>
  error(message, HTTP_STATUS.INTERNAL_ERROR, "INTERNAL_ERROR");
