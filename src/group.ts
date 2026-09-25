import type { SendCommandsFunction } from "./index.js";
import { DynSecCommandResponse, handleResponse } from "./common.js";

export interface GroupRole {
  rolename: string;
  priority?: number;
}

export interface GroupClient {
  username: string;
  priority?: number;
}

export interface CreateGroupPayload {
  groupname: string;
  textname?: string;
  textdescription?: string;
  roles?: GroupRole[];
}

export interface GetGroupPayload {
  groupname: string;
}

export interface ListGroupsPayload {
  count?: number;
  offset?: number;
  verbose?: boolean;
}

export interface ModifyGroupPayload {
  groupname: string;
  textname?: string;
  textdescription?: string;
  roles?: GroupRole[];
  clients?: GroupClient[];
}

export interface RemoveGroupPayload {
  groupname: string;
}

export interface AddGroupClientPayload {
  groupname: string;
  username: string;
  priority?: number;
}

export interface RemoveGroupClientPayload {
  groupname: string;
  username: string;
}

export interface AddGroupRolePayload {
  groupname: string;
  rolename: string;
  priority?: number;
}

export interface RemoveGroupRolePayload {
  groupname: string;
  rolename: string;
}

export interface SetAnonymousGroupPayload {
  groupname: string;
}

export interface GroupDetails {
  groupname: string;
  textname?: string;
  textdescription?: string;
  roles: Array<{ rolename: string; priority: number }>;
  clients: Array<{ username: string; priority: number }>;
}

export interface GetGroupData {
  group: GroupDetails;
}

export interface ListGroupsData {
  totalCount: number;
  groups: string[] | GroupDetails[];
}

export interface GetAnonymousGroupData {
  group: {
    groupname: string;
  };
}

export function createGroupAPI(sendCommands: SendCommandsFunction) {
  /**
   * Creates a new group on the Mosquitto broker.
   */
  const create = async (payload: CreateGroupPayload): Promise<void> => {
    const response = await sendCommands<DynSecCommandResponse>({
      commands: [{ command: "createGroup", ...payload }],
    });
    handleResponse(response, "createGroup");
  };

  /**
   * Retrieves group details and its associated roles and clients.
   */
  const get = async (payload: GetGroupPayload): Promise<GroupDetails> => {
    const response = await sendCommands<DynSecCommandResponse<GetGroupData>>({
      commands: [{ command: "getGroup", groupname: payload.groupname }],
    });
    const data = handleResponse(response, "getGroup");
    return data.group;
  };

  /**
   * Lists groups defined on the broker.
   */
  const list = async (payload?: ListGroupsPayload): Promise<ListGroupsData> => {
    const response = await sendCommands<DynSecCommandResponse<ListGroupsData>>({
      commands: [
        {
          command: "listGroups",
          count: payload?.count ?? -1,
          offset: payload?.offset ?? 0,
          verbose: payload?.verbose ?? false,
        },
      ],
    });
    return handleResponse(response, "listGroups");
  };

  /**
   * Modifies an existing group's metadata, roles, or clients.
   */
  const modify = async (payload: ModifyGroupPayload): Promise<void> => {
    const response = await sendCommands<DynSecCommandResponse>({
      commands: [{ command: "modifyGroup", ...payload }],
    });
    handleResponse(response, "modifyGroup");
  };

  /**
   * Deletes a group from the broker.
   */
  const remove = async (payload: RemoveGroupPayload): Promise<void> => {
    const response = await sendCommands<DynSecCommandResponse>({
      commands: [{ command: "deleteGroup", groupname: payload.groupname }],
    });
    handleResponse(response, "deleteGroup");
  };

  /**
   * Adds a client to a group.
   */
  const addClient = async (payload: AddGroupClientPayload): Promise<void> => {
    const response = await sendCommands<DynSecCommandResponse>({
      commands: [{ command: "addGroupClient", ...payload }],
    });
    handleResponse(response, "addGroupClient");
  };

  /**
   * Removes a client from a group.
   */
  const removeClient = async (payload: RemoveGroupClientPayload): Promise<void> => {
    const response = await sendCommands<DynSecCommandResponse>({
      commands: [{ command: "removeGroupClient", ...payload }],
    });
    handleResponse(response, "removeGroupClient");
  };

  /**
   * Associates a role with a group.
   */
  const addRole = async (payload: AddGroupRolePayload): Promise<void> => {
    const response = await sendCommands<DynSecCommandResponse>({
      commands: [{ command: "addGroupRole", ...payload }],
    });
    handleResponse(response, "addGroupRole");
  };

  /**
   * Removes a role from a group.
   */
  const removeRole = async (payload: RemoveGroupRolePayload): Promise<void> => {
    const response = await sendCommands<DynSecCommandResponse>({
      commands: [{ command: "removeGroupRole", ...payload }],
    });
    handleResponse(response, "removeGroupRole");
  };

  /**
   * Sets the group assigned to anonymous (unauthenticated) clients.
   */
  const setForAnonymousClients = async (payload: SetAnonymousGroupPayload): Promise<void> => {
    const response = await sendCommands<DynSecCommandResponse>({
      commands: [{ command: "setAnonymousGroup", groupname: payload.groupname }],
    });
    handleResponse(response, "setAnonymousGroup");
  };

  /**
   * Retrieves the group currently assigned to anonymous clients.
   */
  const getForAnonymousClients = async (): Promise<{ groupname: string }> => {
    const response = await sendCommands<DynSecCommandResponse<GetAnonymousGroupData>>({
      commands: [{ command: "getAnonymousGroup" }],
    });
    const data = handleResponse(response, "getAnonymousGroup");
    return data.group;
  };

  return {
    create,
    get,
    list,
    modify,
    remove,
    addClient,
    removeClient,
    addRole,
    removeRole,
    setForAnonymousClients,
    getForAnonymousClients,
  };
}