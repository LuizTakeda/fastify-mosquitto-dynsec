import type { SendCommandsFunction } from "./index.js";
import { DynSecCommandResponse, handleResponse } from "./common.js";

export type ACLType =
  | "publishClientSend"
  | "publishClientReceive"
  | "subscribePattern"
  | "subscribeLiteral"
  | "unsubscribePattern"
  | "unsubscribeLiteral";

export interface RoleACL {
  acltype: ACLType;
  topic: string;
  priority?: number;
  allow?: boolean;
}

export interface CreateRolePayload {
  rolename: string;
  textname?: string;
  textdescription?: string;
  acls?: RoleACL[];
}

export interface GetRolePayload {
  rolename: string;
}

export interface ListRolesPayload {
  count?: number;
  offset?: number;
  verbose?: boolean;
}

export interface ModifyRolePayload {
  rolename: string;
  textname?: string;
  textdescription?: string;
  acls?: RoleACL[];
}

export interface RemoveRolePayload {
  rolename: string;
}

export interface AddRoleACLPayload {
  rolename: string;
  acltype: ACLType;
  topic: string;
  priority?: number;
  allow?: boolean;
}

export interface RemoveRoleACLPayload {
  rolename: string;
  acltype: ACLType;
  topic: string;
}

export interface RoleDetails {
  rolename: string;
  textname?: string;
  textdescription?: string;
  acls: Array<RoleACL & { priority: number; allow: boolean }>;
}

export interface GetRoleData {
  role: RoleDetails;
}

export interface ListRolesData {
  totalCount: number;
  roles: string[] | RoleDetails[];
}

export function createRoleAPI(sendCommands: SendCommandsFunction) {
  const create = async (payload: CreateRolePayload): Promise<void> => {
    const response = await sendCommands<DynSecCommandResponse>({
      commands: [{ command: "createRole", ...payload }],
    });
    handleResponse(response, "createRole");
  };

  const get = async (payload: GetRolePayload): Promise<RoleDetails> => {
    const response = await sendCommands<DynSecCommandResponse<GetRoleData>>({
      commands: [{ command: "getRole", rolename: payload.rolename }],
    });
    const data = handleResponse(response, "getRole");
    return data.role;
  };

  const list = async (payload?: ListRolesPayload): Promise<ListRolesData> => {
    const response = await sendCommands<DynSecCommandResponse<ListRolesData>>({
      commands: [
        {
          command: "listRoles",
          count: payload?.count ?? -1,
          offset: payload?.offset ?? 0,
          verbose: payload?.verbose ?? false,
        },
      ],
    });
    return handleResponse(response, "listRoles");
  };

  const modify = async (payload: ModifyRolePayload): Promise<void> => {
    const response = await sendCommands<DynSecCommandResponse>({
      commands: [{ command: "modifyRole", ...payload }],
    });
    handleResponse(response, "modifyRole");
  };

  const remove = async (payload: RemoveRolePayload): Promise<void> => {
    const response = await sendCommands<DynSecCommandResponse>({
      commands: [{ command: "deleteRole", rolename: payload.rolename }],
    });
    handleResponse(response, "deleteRole");
  };

  const addACL = async (payload: AddRoleACLPayload): Promise<void> => {
    const response = await sendCommands<DynSecCommandResponse>({
      commands: [{ command: "addRoleACL", ...payload }],
    });
    handleResponse(response, "addRoleACL");
  };

  const removeACL = async (payload: RemoveRoleACLPayload): Promise<void> => {
    const response = await sendCommands<DynSecCommandResponse>({
      commands: [
        {
          command: "removeRoleACL",
          rolename: payload.rolename,
          acltype: payload.acltype,
          topic: payload.topic,
        },
      ],
    });
    handleResponse(response, "removeRoleACL");
  };

  return {
    create,
    get,
    list,
    modify,
    remove,
    addACL,
    removeACL,
  };
}