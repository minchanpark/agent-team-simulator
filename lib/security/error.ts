import { NextResponse } from "next/server";
import { ApiErrorCode, ApiErrorResponse } from "@/lib/types";

interface ErrorResponseOptions {
  status: number;
  errorCode: ApiErrorCode;
  message: string;
  recoverable: boolean;
  requestId: string;
  retryAfterSec?: number;
}

function setCommonHeaders(response: NextResponse, requestId: string, retryAfterSec?: number): void {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Request-Id", requestId);

  if (typeof retryAfterSec === "number" && Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
    response.headers.set("Retry-After", String(Math.ceil(retryAfterSec)));
  }
}

export function createApiErrorPayload(options: ErrorResponseOptions): ApiErrorResponse {
  return {
    errorCode: options.errorCode,
    message: options.message,
    recoverable: options.recoverable,
    requestId: options.requestId,
    retryAfterSec: options.retryAfterSec,
  };
}

export function createApiErrorResponse<TExtras extends Record<string, unknown> = Record<string, never>>(
  options: ErrorResponseOptions,
  extras?: TExtras,
): NextResponse<ApiErrorResponse & TExtras> {
  const payload = {
    ...createApiErrorPayload(options),
    ...(extras ?? ({} as TExtras)),
  };

  const response = NextResponse.json(payload, { status: options.status });
  setCommonHeaders(response, options.requestId, options.retryAfterSec);
  return response;
}

export function createSuccessResponse<T>(payload: T, requestId: string): NextResponse<T> {
  const response = NextResponse.json(payload);
  setCommonHeaders(response, requestId);
  return response;
}

export function toUpstreamErrorResponse(requestId: string): NextResponse<ApiErrorResponse> {
  return createApiErrorResponse({
    status: 502,
    errorCode: "UPSTREAM_UNAVAILABLE",
    message: "외부 AI 서비스 응답이 불안정합니다. 잠시 후 다시 시도해 주세요.",
    recoverable: true,
    requestId,
  });
}

export function toInternalErrorResponse(requestId: string): NextResponse<ApiErrorResponse> {
  return createApiErrorResponse({
    status: 500,
    errorCode: "INTERNAL_ERROR",
    message: "예상하지 못한 서버 오류가 발생했습니다.",
    recoverable: true,
    requestId,
  });
}
