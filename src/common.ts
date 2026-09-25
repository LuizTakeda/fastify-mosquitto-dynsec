import { DynsecError } from "./errors.js";

export interface DynSecCommandResponse<T = unknown> {
  responses: Array<{
    command: string;
    data?: T;
    error?: string;
  }>;
}

export function handleResponse<T>(res: DynSecCommandResponse<T>, expectedCommand: string): T {
  const response = res.responses?.[0];
  if (!response) {
    throw new DynsecError("Empty response received from DynSec broker", expectedCommand);
  }
  if (response.error) {
    throw new DynsecError(response.error, expectedCommand);
  }
  return response.data as T;
}