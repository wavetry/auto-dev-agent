import http from "node:http";
import https from "node:https";

interface HttpTestResult {
  statusCode: number | null;
  headers: Record<string, string>;
  body: string;
  error: string | null;
  durationMs: number;
}

/**
 * Perform an HTTP request for end-to-end API testing.
 * Equivalent to a simplified curl.
 */
export async function httpTest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
  } = {}
): Promise<HttpTestResult> {
  const {
    method = "GET",
    headers = {},
    body,
    timeoutMs = 10000,
  } = options;

  const start = Date.now();

  return new Promise((resolve) => {
    const parsedUrl = new URL(url);
    const transport = parsedUrl.protocol === "https:" ? https : http;

    const req = transport.request(
      url,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        timeout: timeoutMs,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode ?? null,
            headers: (res.headers as Record<string, string>) || {},
            body: data.slice(0, 5000), // Truncate large responses
            error: null,
            durationMs: Date.now() - start,
          });
        });
      }
    );

    req.on("error", (err) => {
      resolve({
        statusCode: null,
        headers: {},
        body: "",
        error: err.message,
        durationMs: Date.now() - start,
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({
        statusCode: null,
        headers: {},
        body: "",
        error: `Request timed out after ${timeoutMs}ms`,
        durationMs: Date.now() - start,
      });
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}
