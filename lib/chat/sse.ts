interface ParsedSseEvent {
  event: string;
  data: unknown;
}

interface ParseSseResult {
  events: ParsedSseEvent[];
  remaining: string;
}

function parseSseFrame(frame: string): ParsedSseEvent | null {
  const lines = frame.split("\n");
  let eventName = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(":")) {
      continue;
    }

    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  const dataText = dataLines.join("\n");
  try {
    return {
      event: eventName,
      data: JSON.parse(dataText) as unknown,
    };
  } catch {
    return null;
  }
}

export function encodeSseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function parseSseEvents(buffer: string): ParseSseResult {
  const normalizedBuffer = buffer.replace(/\r/g, "");
  const events: ParsedSseEvent[] = [];
  let cursor = 0;

  while (true) {
    const delimiterIndex = normalizedBuffer.indexOf("\n\n", cursor);
    if (delimiterIndex < 0) {
      break;
    }

    const frame = normalizedBuffer.slice(cursor, delimiterIndex);
    const parsed = parseSseFrame(frame);
    if (parsed) {
      events.push(parsed);
    }

    cursor = delimiterIndex + 2;
  }

  return {
    events,
    remaining: normalizedBuffer.slice(cursor),
  };
}
