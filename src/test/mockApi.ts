// Screens reach the Api through src/lib/api. Component tests swap that module for the in-memory mock Api, one fresh copy per test.
//   vi.mock("../../../lib/api", async () => (await import("../../../test/mockApi")).apiModule);
import type { Api } from "../lib/contract";
import { createMockApi } from "../lib/mock";

let current: Promise<Api> = createMockApi();

export const apiModule = { inApp: false, api: (): Promise<Api> => current };

/** Starts the mock Api over with its sample data. Call in beforeEach, and use the result to arrange a test. */
export async function freshApi(): Promise<Api> {
  localStorage.clear();
  current = createMockApi();
  return current;
}
