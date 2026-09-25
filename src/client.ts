import type { SendCommandsFunction } from "./index.js";
import { DynSecCommandResponse, handleResponse } from "./common.js";

export interface ClientRole {
  rolename: string;
  priority?: number;
}

export interface ClientGroup {
  groupname: string;
  priority?: number;
}

export interface CreateClientPayload {
  username: string;
  password?: string;
  clientid?: string;
  textname?: string;
  textdescription?: string;
  roles?: ClientRole[];
  groups?: ClientGroup[];
}

export interface RemoveClientPayload {
  username: string;
}

export interface EnableClientPayload {
  username: string;
}

export interface DisableClientPayload {
  username: string;
}

export interface GetClientPayload {
  username: string;
}

export interface ListClientsPayload {
  count?: number;
  offset?: number;
  verbose?: boolean;
}

export interface ModifyClientPayload {
  username: string;
  clientid?: string;
  password?: string;
  textname?: string;
  textdescription?: string;
  roles?: ClientRole[];
  groups?: ClientGroup[];
}

export interface SetClientIdPayload {
  username: string;
  clientid?: string;
}

export interface SetClientPasswordPayload {
  username: string;
  password?: string;
}

export interface AddClientRolePayload {
  username: string;
  rolename: string;
  priority?: number;
}

export interface RemoveClientRolePayload {
  username: string;
  rolename: string;
}

export interface AddClientToGroupPayload {
  username: string;
  groupname: string;
  priority?: number;
}

export interface RemoveClientFromGroupPayload {
  username: string;
  groupname: string;
}

export interface ClientDetails {
  username: string;
  clientid?: string;
  textname?: string;
  textdescription?: string;
  disabled?: boolean;
  roles: Array<{ rolename: string; priority?: number }>;
  groups: Array<{ groupname: string; priority?: number }>;
}

export interface GetClientData {
  client: ClientDetails;
}

export interface ListClientsData {
  totalCount: number;
  clients: string[] | ClientDetails[];
}

export function createClientAPI(sendCommands: SendCommandsFunction) {
  /**
   * Creates a new client on the Mosquitto broker.
   */
  const create = async (payload: CreateClientPayload): Promise<void> => {
    const response = await sendCommands<DynSecCommandResponse>({
      commands: [{ command: "createClient", ...payload }],
    });
    handleResponse(response, "createClient");
  };

  /**
   * Deletes a client from the Mosquitto broker.
   */
  const remove = async (payload: RemoveClientPayload): Promise<void> => {
    const response = await sendCommands<DynSecCommandResponse>({
      commands: [{ command: "deleteClient", username: payload.username }],
    });
    handleResponse(response, "deleteClient");
  };

  /**
   * Enables a client, allowing it to authenticate with the broker.
   */
  const enable = async (payload: EnableClientPayload): Promise<void> => {
    const response = await sendCommands<DynSecCommandResponse>({
      commands: [{ command: "enableClient", username: payload.username }],
    });
    handleResponse(response, "enableClient");
  };

  /**
   * Disables a client and kicks any active connections matching this username.
   */
  const disable = async (payload: DisableClientPayload): Promise<void> => {
    const response = await sendCommands<DynSecCommandResponse>({
      commands: [{ command: "disableClient", username: payload.username }],
    });
    handleResponse(response, "disableClient");
  };

  /**
   * Retrieves full details for a client, including its roles and groups.
   */
  const get = async (payload: GetClientPayload): Promise<ClientDetails> => {
    const response = await sendCommands<DynSecCommandResponse<GetClientData>>({
      commands: [{ command: "getClient", username: payload.username }],
    });
    const data = handleResponse(response, "getClient");
    return data.client;
  };

  /**
   * Lists clients registered on the broker.
   */
  const list = async (payload?: ListClientsPayload): Promise<ListClientsData> => {
    const response = await sendCommands<DynSecCommandResponse<ListClientsData>>({
      commands: [
        {
          command: "listClients",
          count: payload?.count ?? -1,
          offset: payload?.offset ?? 0,
          verbose: payload?.verbose ?? false,
        },
      ],
    });
    return handleResponse(response, "listClients");
  };

  /**
   * Modifies an existing client's configuration, roles, or groups.
   */
  const modify = async (payload: ModifyClientPayload): Promise<void> => {
    const response = await sendCommands<DynSecCommandResponse>({
      commands: [{ command: "modifyClient", ...payload }],
    });
    handleResponse(response, "modifyClient");
  };

  /**
   * Sets or clears the client ID restriction for a client.
   */
  const setId = async (payload: SetClientIdPayload): Promise<void> => {
    const response = await sendCommands<DynSecCommandResponse>({
      commands: [{ command: "setClientId", username: payload.username, clientid: payload.clientid ?? "" }],
    });
    handleResponse(response, "setClientId");
  };

  /**
   * Updates the password for a client.
   */
  const setPassword = async (payload: SetClientPasswordPayload): Promise<void> => {
    const response = await sendCommands<DynSecCommandResponse>({
      commands: [{ command: "setClientPassword", username: payload.username, password: payload.password ?? "" }],
    });
    handleResponse(response, "setClientPassword");
  };

  /**
   * Associates a role with a client.
   */
  const addRole = async (payload: AddClientRolePayload): Promise<void> => {
    const response = await sendCommands<DynSecCommandResponse>({
      commands: [{ command: "addClientRole", ...payload }],
    });
    handleResponse(response, "addClientRole");
  };

  /**
   * Removes a role from a client.
   */
  const removeRole = async (payload: RemoveClientRolePayload): Promise<void> => {
    const response = await sendCommands<DynSecCommandResponse>({
      commands: [{ command: "removeClientRole", username: payload.username, rolename: payload.rolename }],
    });
    handleResponse(response, "removeClientRole");
  };

  /**
   * Adds a client to a group.
   */
  const addToGroup = async (payload: AddClientToGroupPayload): Promise<void> => {
    const response = await sendCommands<DynSecCommandResponse>({
      commands: [{ command: "addGroupClient", groupname: payload.groupname, username: payload.username, priority: payload.priority }],
    });
    handleResponse(response, "addGroupClient");
  };

  /**
   * Removes a client from a group.
   */
  const removeFromGroup = async (payload: RemoveClientFromGroupPayload): Promise<void> => {
    const response = await sendCommands<DynSecCommandResponse>({
      commands: [{ command: "removeGroupClient", groupname: payload.groupname, username: payload.username }],
    });
    handleResponse(response, "removeGroupClient");
  };

  return {
    create,
    remove,
    enable,
    disable,
    get,
    list,
    modify,
    setId,
    setPassword,
    addRole,
    removeRole,
    addToGroup,
    removeFromGroup,
  };
}