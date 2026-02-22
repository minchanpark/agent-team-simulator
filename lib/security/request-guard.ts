import { NextResponse } from "next/server";
import { ApiErrorResponse } from "@/lib/types";
import { createApiErrorResponse } from "@/lib/security/error";
import { createRateLimitKey, checkRateLimit, RateLimitPolicy } from "@/lib/security/rate-limit";
import { validateOrigin } from "@/lib/security/origin";

interface GuardRequestConfig<TPayload> {
  routeKey: string;
  maxBodyBytes: number;
  rateLimit: RateLimitPolicy;
  parsePayload: (payload: unknown) => TPayload | null;
  payloadValidator?: (payload: TPayload) => string | null;
  requireJsonContentType?: boolean;
}

interface GuardFailure {
  ok: false;
  requestId: string;
  response: NextResponse<ApiErrorResponse>;
}

interface GuardSuccess<TPayload> {
  ok: true;
  requestId: string;
  payload: TPayload;
  clientIp: string;
}

export type GuardResult<TPayload> = GuardFailure | GuardSuccess<TPayload>;

function createRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor
      .split(",")
      .map((item) => item.trim())
      .find((item) => item.length > 0);

    if (first) {
      return first;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "0.0.0.0";
}

function createInvalidRequestResponse(requestId: string, message: string): NextResponse<ApiErrorResponse> {
  return createApiErrorResponse({
    status: 400,
    errorCode: "INVALID_REQUEST",
    message,
    recoverable: false,
    requestId,
  });
}

function readBodyBytes(raw: string): number {
  return Buffer.byteLength(raw, "utf-8");
}

export async function guardJsonRequest<TPayload>(
  request: Request,
  config: GuardRequestConfig<TPayload>,
): Promise<GuardResult<TPayload>> {
  const requestId = createRequestId();

  if (config.requireJsonContentType !== false) {
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("application/json")) {
      return {
        ok: false,
        requestId,
        response: createInvalidRequestResponse(requestId, "요청 Content-Type은 application/json 이어야 합니다."),
      };
    }
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (!Number.isFinite(contentLength) || contentLength < 0) {
      return {
        ok: false,
        requestId,
        response: createInvalidRequestResponse(requestId, "요청 본문 길이 형식이 올바르지 않습니다."),
      };
    }

    if (contentLength > config.maxBodyBytes) {
      return {
        ok: false,
        requestId,
        response: createApiErrorResponse({
          status: 413,
          errorCode: "REQUEST_TOO_LARGE",
          message: `요청 본문이 너무 큽니다. 최대 ${config.maxBodyBytes} bytes까지 허용됩니다.`,
          recoverable: false,
          requestId,
        }),
      };
    }
  }

  const originResult = validateOrigin(request);
  if (!originResult.allowed) {
    return {
      ok: false,
      requestId,
      response: createApiErrorResponse({
        status: 403,
        errorCode: "UNSUPPORTED_ORIGIN",
        message: "허용되지 않은 요청 출처입니다.",
        recoverable: false,
        requestId,
      }),
    };
  }

  const clientIp = getClientIp(request);
  const rateLimitKey = createRateLimitKey(config.routeKey, clientIp);
  const rateLimitResult = checkRateLimit(rateLimitKey, config.rateLimit);
  if (!rateLimitResult.ok) {
    return {
      ok: false,
      requestId,
      response: createApiErrorResponse({
        status: 429,
        errorCode: "RATE_LIMITED",
        message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
        recoverable: true,
        requestId,
        retryAfterSec: rateLimitResult.retryAfterSec,
      }),
    };
  }

  let rawBody = "";
  try {
    rawBody = await request.text();
  } catch {
    return {
      ok: false,
      requestId,
      response: createInvalidRequestResponse(requestId, "요청 본문을 읽을 수 없습니다."),
    };
  }

  if (readBodyBytes(rawBody) > config.maxBodyBytes) {
    return {
      ok: false,
      requestId,
      response: createApiErrorResponse({
        status: 413,
        errorCode: "REQUEST_TOO_LARGE",
        message: `요청 본문이 너무 큽니다. 최대 ${config.maxBodyBytes} bytes까지 허용됩니다.`,
        recoverable: false,
        requestId,
      }),
    };
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return {
      ok: false,
      requestId,
      response: createInvalidRequestResponse(requestId, "요청 본문 JSON 형식이 올바르지 않습니다."),
    };
  }

  const payload = config.parsePayload(parsedBody);
  if (!payload) {
    return {
      ok: false,
      requestId,
      response: createInvalidRequestResponse(requestId, "요청 본문 형식이 올바르지 않습니다."),
    };
  }

  if (config.payloadValidator) {
    const validationError = config.payloadValidator(payload);
    if (validationError) {
      return {
        ok: false,
        requestId,
        response: createInvalidRequestResponse(requestId, validationError),
      };
    }
  }

  return {
    ok: true,
    requestId,
    payload,
    clientIp,
  };
}
