import { DynsecError } from "./errors.js";

/**
 * Shape of responses returned by the Mosquitto Dynamic Security plugin.
 */
export interface DynSecCommandResponse<T = unknown> {
  responses: Array<{
    command: string;
    data?: T;
    error?: string;
  }>;
}

/**
 * Validates the DynSec broker response and returns its data payload.
 *
 * @throws {DynsecError} If the broker returns an error or an empty response.
 */
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