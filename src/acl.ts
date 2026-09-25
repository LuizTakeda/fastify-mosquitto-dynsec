import type { SendCommandsFunction } from "./index.js";
import { DynSecCommandResponse, handleResponse } from "./common.js";

export type DefaultACLType =
  | "publishClientSend"
  | "publishClientReceive"
  | "subscribe"
  | "unsubscribe";

export interface DefaultACLRule {
  acltype: DefaultACLType;
  allow: boolean;
}

export interface SetDefaultACLAccessPayload {
  acls: DefaultACLRule[];
}

export interface GetDefaultACLAccessData {
  acls: DefaultACLRule[];
}

export function createAclAPI(sendCommands: SendCommandsFunction) {
  /**
   * Sets the default ACL access behavior on the Mosquitto broker.
   */
  const setDefaultAccess = async (
    payload: SetDefaultACLAccessPayload
  ): Promise<void> => {
    const response = await sendCommands<DynSecCommandResponse>({
      commands: [{ command: "setDefaultACLAccess", ...payload }],
    });
    handleResponse(response, "setDefaultACLAccess");
  };

  /**
   * Retrieves the default ACL access behavior from the Mosquitto broker.
   */
  const getDefaultAccess = async (): Promise<DefaultACLRule[]> => {
    const response = await sendCommands<
      DynSecCommandResponse<GetDefaultACLAccessData>
    >({
      commands: [{ command: "getDefaultACLAccess" }],
    });
    const data = handleResponse(response, "getDefaultACLAccess");
    return data.acls;
  };

  return {
    setDefaultAccess,
    getDefaultAccess,
  };
}
