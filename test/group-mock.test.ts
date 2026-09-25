import test from "node:test";
import assert from "node:assert";
import { createGroupAPI } from "../src/group.js";
import { DynsecError } from "../src/errors.js";
import type { SendCommandsFunction } from "../src/index.js";

function createMockSender(provider: (commands: any) => any): SendCommandsFunction {
  return async <T = unknown>(commands: object): Promise<T> => {
    return provider(commands) as T;
  };
}

test("group-mock", { concurrency: 1 }, async (t) => {
  await t.test("create() should dispatch createGroup command and succeed", async () => {
    let capturedCommands: any = null;

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [{ command: "createGroup" }],
      };
    });

    const groupAPI = createGroupAPI(mockSendCommands);
    await groupAPI.create({
      groupname: "sensors",
      textname: "Sensors Group",
      textdescription: "Group for IoT sensor clients",
      roles: [{ rolename: "sensor-role", priority: 1 }],
    });

    assert.deepStrictEqual(capturedCommands, {
      commands: [
        {
          command: "createGroup",
          groupname: "sensors",
          textname: "Sensors Group",
          textdescription: "Group for IoT sensor clients",
          roles: [{ rolename: "sensor-role", priority: 1 }],
        },
      ],
    });
  });

  await t.test("create() should throw DynsecError when broker returns an error", async () => {
    const mockSendCommands = createMockSender(() => ({
      responses: [{ command: "createGroup", error: "Group already exists" }],
    }));

    const groupAPI = createGroupAPI(mockSendCommands);

    await assert.rejects(
      async () => {
        await groupAPI.create({ groupname: "sensors" });
      },
      (err: any) => {
        assert.ok(err instanceof DynsecError);
        assert.strictEqual(err.message, "Group already exists");
        assert.strictEqual(err.command, "createGroup");
        return true;
      }
    );
  });

  await t.test("get() should dispatch getGroup and return group details", async () => {
    let capturedCommands: any = null;

    const mockGroupDetails = {
      groupname: "sensors",
      textname: "Sensors Group",
      textdescription: "Group for IoT sensor clients",
      roles: [{ rolename: "sensor-role", priority: 1 }],
      clients: [{ username: "device-1", priority: 0 }],
    };

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [
          {
            command: "getGroup",
            data: { group: mockGroupDetails },
          },
        ],
      };
    });

    const groupAPI = createGroupAPI(mockSendCommands);
    const result = await groupAPI.get({ groupname: "sensors" });

    assert.deepStrictEqual(capturedCommands, {
      commands: [{ command: "getGroup", groupname: "sensors" }],
    });
    assert.deepStrictEqual(result, mockGroupDetails);
  });

  await t.test("get() should throw DynsecError when group is not found", async () => {
    const mockSendCommands = createMockSender(() => ({
      responses: [{ command: "getGroup", error: "Group not found" }],
    }));

    const groupAPI = createGroupAPI(mockSendCommands);

    await assert.rejects(
      async () => {
        await groupAPI.get({ groupname: "non-existent" });
      },
      (err: any) => {
        assert.ok(err instanceof DynsecError);
        assert.strictEqual(err.message, "Group not found");
        assert.strictEqual(err.command, "getGroup");
        return true;
      }
    );
  });

  await t.test("list() should dispatch listGroups with defaults and return data", async () => {
    let capturedCommands: any = null;

    const mockListData = {
      totalCount: 1,
      groups: ["sensors"],
    };

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [
          {
            command: "listGroups",
            data: mockListData,
          },
        ],
      };
    });

    const groupAPI = createGroupAPI(mockSendCommands);
    const result = await groupAPI.list();

    assert.deepStrictEqual(capturedCommands, {
      commands: [{ command: "listGroups", count: -1, offset: 0, verbose: false }],
    });
    assert.deepStrictEqual(result, mockListData);
  });

  await t.test("list() should pass custom pagination options", async () => {
    let capturedCommands: any = null;

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [{ command: "listGroups", data: { totalCount: 0, groups: [] } }],
      };
    });

    const groupAPI = createGroupAPI(mockSendCommands);
    await groupAPI.list({ count: 20, offset: 10, verbose: true });

    assert.deepStrictEqual(capturedCommands, {
      commands: [{ command: "listGroups", count: 20, offset: 10, verbose: true }],
    });
  });

  await t.test("modify() should dispatch modifyGroup command", async () => {
    let capturedCommands: any = null;

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [{ command: "modifyGroup" }],
      };
    });

    const groupAPI = createGroupAPI(mockSendCommands);
    await groupAPI.modify({
      groupname: "sensors",
      textname: "Updated Sensors Group",
    });

    assert.deepStrictEqual(capturedCommands, {
      commands: [
        {
          command: "modifyGroup",
          groupname: "sensors",
          textname: "Updated Sensors Group",
        },
      ],
    });
  });

  await t.test("remove() should dispatch deleteGroup command", async () => {
    let capturedCommands: any = null;

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [{ command: "deleteGroup" }],
      };
    });

    const groupAPI = createGroupAPI(mockSendCommands);
    await groupAPI.remove({ groupname: "old-group" });

    assert.deepStrictEqual(capturedCommands, {
      commands: [{ command: "deleteGroup", groupname: "old-group" }],
    });
  });

  await t.test("addClient() should dispatch addGroupClient command", async () => {
    let capturedCommands: any = null;

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [{ command: "addGroupClient" }],
      };
    });

    const groupAPI = createGroupAPI(mockSendCommands);
    await groupAPI.addClient({
      groupname: "sensors",
      username: "sensor-node-1",
      priority: 1,
    });

    assert.deepStrictEqual(capturedCommands, {
      commands: [
        {
          command: "addGroupClient",
          groupname: "sensors",
          username: "sensor-node-1",
          priority: 1,
        },
      ],
    });
  });

  await t.test("removeClient() should dispatch removeGroupClient command", async () => {
    let capturedCommands: any = null;

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [{ command: "removeGroupClient" }],
      };
    });

    const groupAPI = createGroupAPI(mockSendCommands);
    await groupAPI.removeClient({
      groupname: "sensors",
      username: "sensor-node-1",
    });

    assert.deepStrictEqual(capturedCommands, {
      commands: [
        {
          command: "removeGroupClient",
          groupname: "sensors",
          username: "sensor-node-1",
        },
      ],
    });
  });

  await t.test("addRole() should dispatch addGroupRole command", async () => {
    let capturedCommands: any = null;

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [{ command: "addGroupRole" }],
      };
    });

    const groupAPI = createGroupAPI(mockSendCommands);
    await groupAPI.addRole({
      groupname: "sensors",
      rolename: "telemetry-role",
      priority: 2,
    });

    assert.deepStrictEqual(capturedCommands, {
      commands: [
        {
          command: "addGroupRole",
          groupname: "sensors",
          rolename: "telemetry-role",
          priority: 2,
        },
      ],
    });
  });

  await t.test("removeRole() should dispatch removeGroupRole command", async () => {
    let capturedCommands: any = null;

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [{ command: "removeGroupRole" }],
      };
    });

    const groupAPI = createGroupAPI(mockSendCommands);
    await groupAPI.removeRole({
      groupname: "sensors",
      rolename: "telemetry-role",
    });

    assert.deepStrictEqual(capturedCommands, {
      commands: [
        {
          command: "removeGroupRole",
          groupname: "sensors",
          rolename: "telemetry-role",
        },
      ],
    });
  });

  await t.test("setForAnonymousClients() should dispatch setAnonymousGroup command", async () => {
    let capturedCommands: any = null;

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [{ command: "setAnonymousGroup" }],
      };
    });

    const groupAPI = createGroupAPI(mockSendCommands);
    await groupAPI.setForAnonymousClients({ groupname: "public-group" });

    assert.deepStrictEqual(capturedCommands, {
      commands: [
        {
          command: "setAnonymousGroup",
          groupname: "public-group",
        },
      ],
    });
  });

  await t.test("getForAnonymousClients() should dispatch getAnonymousGroup and return data", async () => {
    let capturedCommands: any = null;

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [
          {
            command: "getAnonymousGroup",
            data: { group: { groupname: "public-group" } },
          },
        ],
      };
    });

    const groupAPI = createGroupAPI(mockSendCommands);
    const result = await groupAPI.getForAnonymousClients();

    assert.deepStrictEqual(capturedCommands, {
      commands: [{ command: "getAnonymousGroup" }],
    });
    assert.deepStrictEqual(result, { groupname: "public-group" });
  });

  await t.test("should throw DynsecError when response is empty", async () => {
    const mockSendCommands = createMockSender(() => ({
      responses: [],
    }));

    const groupAPI = createGroupAPI(mockSendCommands);

    await assert.rejects(
      async () => {
        await groupAPI.remove({ groupname: "any-group" });
      },
      (err: any) => {
        assert.ok(err instanceof DynsecError);
        assert.strictEqual(err.message, "Empty response received from DynSec broker");
        assert.strictEqual(err.command, "deleteGroup");
        return true;
      }
    );
  });
});
