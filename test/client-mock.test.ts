import test from "node:test";
import assert from "node:assert";
import { createClientAPI } from "../src/client.js";
import { DynsecError } from "../src/errors.js";
import type { SendCommandsFunction } from "../src/index.js";

function createMockSender(provider: (commands: any) => any): SendCommandsFunction {
  return async <T = unknown>(commands: object): Promise<T> => {
    return provider(commands) as T;
  };
}

test("client-mock", { concurrency: 1 }, async (t) => {
  await t.test("create() should dispatch createClient command and succeed", async () => {
    let capturedCommands: any = null;

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [{ command: "createClient" }],
      };
    });

    const clientAPI = createClientAPI(mockSendCommands);
    await clientAPI.create({
      username: "sensor-node",
      password: "secretPassword",
      clientid: "device-01",
      textname: "Sensor Node",
      textdescription: "Telemetry node",
      roles: [{ rolename: "sensor-role", priority: 1 }],
      groups: [{ groupname: "sensors", priority: 1 }],
    });

    assert.deepStrictEqual(capturedCommands, {
      commands: [
        {
          command: "createClient",
          username: "sensor-node",
          password: "secretPassword",
          clientid: "device-01",
          textname: "Sensor Node",
          textdescription: "Telemetry node",
          roles: [{ rolename: "sensor-role", priority: 1 }],
          groups: [{ groupname: "sensors", priority: 1 }],
        },
      ],
    });
  });

  await t.test("create() should throw DynsecError when broker returns an error", async () => {
    const mockSendCommands = createMockSender(() => ({
      responses: [{ command: "createClient", error: "Client already exists" }],
    }));

    const clientAPI = createClientAPI(mockSendCommands);

    await assert.rejects(
      async () => {
        await clientAPI.create({ username: "sensor-node" });
      },
      (err: any) => {
        assert.ok(err instanceof DynsecError);
        assert.strictEqual(err.message, "Client already exists");
        assert.strictEqual(err.command, "createClient");
        return true;
      }
    );
  });

  await t.test("remove() should dispatch deleteClient command", async () => {
    let capturedCommands: any = null;

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [{ command: "deleteClient" }],
      };
    });

    const clientAPI = createClientAPI(mockSendCommands);
    await clientAPI.remove({ username: "sensor-node" });

    assert.deepStrictEqual(capturedCommands, {
      commands: [{ command: "deleteClient", username: "sensor-node" }],
    });
  });

  await t.test("enable() should dispatch enableClient command", async () => {
    let capturedCommands: any = null;

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [{ command: "enableClient" }],
      };
    });

    const clientAPI = createClientAPI(mockSendCommands);
    await clientAPI.enable({ username: "sensor-node" });

    assert.deepStrictEqual(capturedCommands, {
      commands: [{ command: "enableClient", username: "sensor-node" }],
    });
  });

  await t.test("disable() should dispatch disableClient command", async () => {
    let capturedCommands: any = null;

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [{ command: "disableClient" }],
      };
    });

    const clientAPI = createClientAPI(mockSendCommands);
    await clientAPI.disable({ username: "sensor-node" });

    assert.deepStrictEqual(capturedCommands, {
      commands: [{ command: "disableClient", username: "sensor-node" }],
    });
  });

  await t.test("get() should dispatch getClient and return client details", async () => {
    let capturedCommands: any = null;

    const mockClientDetails = {
      username: "sensor-node",
      clientid: "device-01",
      textname: "Sensor Node",
      textdescription: "Telemetry node",
      disabled: false,
      roles: [{ rolename: "sensor-role", priority: 1 }],
      groups: [{ groupname: "sensors", priority: 1 }],
    };

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [
          {
            command: "getClient",
            data: { client: mockClientDetails },
          },
        ],
      };
    });

    const clientAPI = createClientAPI(mockSendCommands);
    const result = await clientAPI.get({ username: "sensor-node" });

    assert.deepStrictEqual(capturedCommands, {
      commands: [{ command: "getClient", username: "sensor-node" }],
    });
    assert.deepStrictEqual(result, mockClientDetails);
  });

  await t.test("get() should throw DynsecError when client is not found", async () => {
    const mockSendCommands = createMockSender(() => ({
      responses: [{ command: "getClient", error: "Client not found" }],
    }));

    const clientAPI = createClientAPI(mockSendCommands);

    await assert.rejects(
      async () => {
        await clientAPI.get({ username: "non-existent" });
      },
      (err: any) => {
        assert.ok(err instanceof DynsecError);
        assert.strictEqual(err.message, "Client not found");
        assert.strictEqual(err.command, "getClient");
        return true;
      }
    );
  });

  await t.test("list() should dispatch listClients with defaults and return data", async () => {
    let capturedCommands: any = null;

    const mockListData = {
      totalCount: 1,
      clients: ["sensor-node"],
    };

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [
          {
            command: "listClients",
            data: mockListData,
          },
        ],
      };
    });

    const clientAPI = createClientAPI(mockSendCommands);
    const result = await clientAPI.list();

    assert.deepStrictEqual(capturedCommands, {
      commands: [{ command: "listClients", count: -1, offset: 0, verbose: false }],
    });
    assert.deepStrictEqual(result, mockListData);
  });

  await t.test("list() should pass custom pagination options", async () => {
    let capturedCommands: any = null;

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [{ command: "listClients", data: { totalCount: 0, clients: [] } }],
      };
    });

    const clientAPI = createClientAPI(mockSendCommands);
    await clientAPI.list({ count: 10, offset: 2, verbose: true });

    assert.deepStrictEqual(capturedCommands, {
      commands: [{ command: "listClients", count: 10, offset: 2, verbose: true }],
    });
  });

  await t.test("modify() should dispatch modifyClient command", async () => {
    let capturedCommands: any = null;

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [{ command: "modifyClient" }],
      };
    });

    const clientAPI = createClientAPI(mockSendCommands);
    await clientAPI.modify({
      username: "sensor-node",
      textname: "Updated Sensor Node",
      password: "newSecretPassword",
    });

    assert.deepStrictEqual(capturedCommands, {
      commands: [
        {
          command: "modifyClient",
          username: "sensor-node",
          textname: "Updated Sensor Node",
          password: "newSecretPassword",
        },
      ],
    });
  });

  await t.test("setId() should dispatch setClientId command", async () => {
    let capturedCommands: any = null;

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [{ command: "setClientId" }],
      };
    });

    const clientAPI = createClientAPI(mockSendCommands);
    await clientAPI.setId({
      username: "sensor-node",
      clientid: "new-client-id",
    });

    assert.deepStrictEqual(capturedCommands, {
      commands: [
        {
          command: "setClientId",
          username: "sensor-node",
          clientid: "new-client-id",
        },
      ],
    });
  });

  await t.test("setId() should default clientid to empty string when not provided", async () => {
    let capturedCommands: any = null;

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [{ command: "setClientId" }],
      };
    });

    const clientAPI = createClientAPI(mockSendCommands);
    await clientAPI.setId({
      username: "sensor-node",
    });

    assert.deepStrictEqual(capturedCommands, {
      commands: [
        {
          command: "setClientId",
          username: "sensor-node",
          clientid: "",
        },
      ],
    });
  });

  await t.test("setPassword() should dispatch setClientPassword command", async () => {
    let capturedCommands: any = null;

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [{ command: "setClientPassword" }],
      };
    });

    const clientAPI = createClientAPI(mockSendCommands);
    await clientAPI.setPassword({
      username: "sensor-node",
      password: "securePassword123",
    });

    assert.deepStrictEqual(capturedCommands, {
      commands: [
        {
          command: "setClientPassword",
          username: "sensor-node",
          password: "securePassword123",
        },
      ],
    });
  });

  await t.test("addRole() should dispatch addClientRole command", async () => {
    let capturedCommands: any = null;

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [{ command: "addClientRole" }],
      };
    });

    const clientAPI = createClientAPI(mockSendCommands);
    await clientAPI.addRole({
      username: "sensor-node",
      rolename: "telemetry-role",
      priority: 2,
    });

    assert.deepStrictEqual(capturedCommands, {
      commands: [
        {
          command: "addClientRole",
          username: "sensor-node",
          rolename: "telemetry-role",
          priority: 2,
        },
      ],
    });
  });

  await t.test("removeRole() should dispatch removeClientRole command", async () => {
    let capturedCommands: any = null;

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [{ command: "removeClientRole" }],
      };
    });

    const clientAPI = createClientAPI(mockSendCommands);
    await clientAPI.removeRole({
      username: "sensor-node",
      rolename: "telemetry-role",
    });

    assert.deepStrictEqual(capturedCommands, {
      commands: [
        {
          command: "removeClientRole",
          username: "sensor-node",
          rolename: "telemetry-role",
        },
      ],
    });
  });

  await t.test("addToGroup() should dispatch addGroupClient command", async () => {
    let capturedCommands: any = null;

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [{ command: "addGroupClient" }],
      };
    });

    const clientAPI = createClientAPI(mockSendCommands);
    await clientAPI.addToGroup({
      username: "sensor-node",
      groupname: "sensors",
      priority: 1,
    });

    assert.deepStrictEqual(capturedCommands, {
      commands: [
        {
          command: "addGroupClient",
          groupname: "sensors",
          username: "sensor-node",
          priority: 1,
        },
      ],
    });
  });

  await t.test("removeFromGroup() should dispatch removeGroupClient command", async () => {
    let capturedCommands: any = null;

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [{ command: "removeGroupClient" }],
      };
    });

    const clientAPI = createClientAPI(mockSendCommands);
    await clientAPI.removeFromGroup({
      username: "sensor-node",
      groupname: "sensors",
    });

    assert.deepStrictEqual(capturedCommands, {
      commands: [
        {
          command: "removeGroupClient",
          groupname: "sensors",
          username: "sensor-node",
        },
      ],
    });
  });

  await t.test("should throw DynsecError when response is empty", async () => {
    const mockSendCommands = createMockSender(() => ({
      responses: [],
    }));

    const clientAPI = createClientAPI(mockSendCommands);

    await assert.rejects(
      async () => {
        await clientAPI.remove({ username: "any-user" });
      },
      (err: any) => {
        assert.ok(err instanceof DynsecError);
        assert.strictEqual(err.message, "Empty response received from DynSec broker");
        assert.strictEqual(err.command, "deleteClient");
        return true;
      }
    );
  });
});
