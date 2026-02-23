interface OriginCheckResult {
  allowed: boolean;
  allowedOrigins: string[];
  reason?: "missing_origin" | "invalid_origin" | "origin_not_allowed";
}

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function parseBoolean(value: string | undefined): boolean | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return null;
}

function getSameOriginFromRequest(request: Request): string[] {
  const requestUrl = new URL(request.url);
  const origins = new Set<string>([requestUrl.origin]);

  const forwardedProto = request.headers.get("x-forwarded-proto")?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.trim();
  const host = request.headers.get("host")?.trim();
  const resolvedHost = forwardedHost || host;

  if (resolvedHost) {
    const protocol = forwardedProto || requestUrl.protocol.replace(":", "") || "https";
    origins.add(`${protocol}://${resolvedHost}`);
  }

  return Array.from(origins);
}

export function isSecurityGuardsEnabled(): boolean {
  const configured = parseBoolean(process.env.SECURITY_GUARDS_ENABLED);
  if (configured !== null) {
    return configured;
  }

  return process.env.NODE_ENV === "production";
}

export function resolveAllowedOrigins(request: Request): string[] {
  const origins = new Set<string>(getSameOriginFromRequest(request));
  const configured = process.env.ALLOWED_ORIGINS;
  if (configured && configured.trim().length > 0) {
    const values = configured
      .split(",")
      .map((value) => normalizeOrigin(value.trim()))
      .filter((value): value is string => Boolean(value));

    if (values.length > 0) {
      for (const value of values) {
        origins.add(value);
      }
    }
  }

  return Array.from(origins);
}

export function validateOrigin(request: Request): OriginCheckResult {
  if (!isSecurityGuardsEnabled()) {
    return {
      allowed: true,
      allowedOrigins: resolveAllowedOrigins(request),
    };
  }

  const allowedOrigins = resolveAllowedOrigins(request);
  const originHeader = request.headers.get("origin")?.trim();

  if (!originHeader) {
    return {
      allowed: false,
      allowedOrigins,
      reason: "missing_origin",
    };
  }

  const normalizedOrigin = normalizeOrigin(originHeader);
  if (!normalizedOrigin) {
    return {
      allowed: false,
      allowedOrigins,
      reason: "invalid_origin",
    };
  }

  if (!allowedOrigins.includes(normalizedOrigin)) {
    return {
      allowed: false,
      allowedOrigins,
      reason: "origin_not_allowed",
    };
  }

  return {
    allowed: true,
    allowedOrigins,
  };
}
