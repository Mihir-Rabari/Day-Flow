import { expect, test, describe, mock } from "bun:test";
import { requestLogger } from "../middleware/requestLogger";
import { Request, Response } from "express";

describe("requestLogger middleware", () => {
  test("should assign a valid UUID to req.requestId", () => {
    const req = {
      method: "GET",
      originalUrl: "/test",
      ip: "127.0.0.1",
      get: (header: string) => "test-agent",
      startTime: 0,
    } as unknown as Request;

    const res = {
      end: mock(() => {}),
      statusCode: 200,
    } as unknown as Response;

    const next = mock(() => {});

    requestLogger(req, res, next);

    expect(req.requestId).toBeDefined();
    expect(typeof req.requestId).toBe("string");
    // Basic UUID v4 regex check
    expect(req.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(next).toHaveBeenCalled();
  });
});
