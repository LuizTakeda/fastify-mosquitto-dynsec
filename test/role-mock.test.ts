import test from "node:test";
import assert from "node:assert";
import { createRoleAPI } from "../src/role.js";
import { DynsecError } from "../src/errors.js";
import type { SendCommandsFunction } from "../src/index.js";

function createMockSender(provider: (commands: any) => any): SendCommandsFunction {
  return async <T = unknown>(commands: object): Promise<T> => {
    return provider(commands) as T;
  };
}

test("role-mock", { concurrency: 1 }, async (t) => {
  await t.test("create() should dispatch createRole command and succeed", async () => {
    let capturedCommands: any = null;

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [{ command: "createRole" }],
      };
    });

    const roleAPI = createRoleAPI(mockSendCommands);
    await roleAPI.create({
      rolename: "sensor-role",
      textname: "Sensor Role",
      textdescription: "Role for IoT sensors",
      acls: [
        {
          acltype: "publishClientSend",
          topic: "telemetry/#",
          allow: true,
          priority: 1,
        },
      ],
    });

    assert.deepStrictEqual(capturedCommands, {
      commands: [
        {
          command: "createRole",
          rolename: "sensor-role",
          textname: "Sensor Role",
          textdescription: "Role for IoT sensors",
          acls: [
            {
              acltype: "publishClientSend",
              topic: "telemetry/#",
              allow: true,
              priority: 1,
            },
          ],
        },
      ],
    });
  });

  await t.test("create() should throw DynsecError when broker returns an error", async () => {
    const mockSendCommands = createMockSender(() => ({
      responses: [{ command: "createRole", error: "Role already exists" }],
    }));

    const roleAPI = createRoleAPI(mockSendCommands);

    await assert.rejects(
      async () => {
        await roleAPI.create({ rolename: "sensor-role" });
      },
      (err: any) => {
        assert.ok(err instanceof DynsecError);
        assert.strictEqual(err.message, "Role already exists");
        assert.strictEqual(err.command, "createRole");
        return true;
      }
    );
  });

  await t.test("get() should dispatch getRole and return role details", async () => {
    let capturedCommands: any = null;

    const mockRoleDetails = {
      rolename: "admin",
      textname: "Administrator",
      textdescription: "Superuser role",
      acls: [
        {
          acltype: "publishClientSend" as const,
          topic: "$CONTROL/#",
          priority: 0,
          allow: true,
        },
      ],
    };

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [
          {
            command: "getRole",
            data: { role: mockRoleDetails },
          },
        ],
      };
    });

    const roleAPI = createRoleAPI(mockSendCommands);
    const result = await roleAPI.get({ rolename: "admin" });

    assert.deepStrictEqual(capturedCommands, {
      commands: [{ command: "getRole", rolename: "admin" }],
    });
    assert.deepStrictEqual(result, mockRoleDetails);
  });

  await t.test("get() should throw DynsecError when role is not found", async () => {
    const mockSendCommands = createMockSender(() => ({
      responses: [{ command: "getRole", error: "Role not found" }],
    }));

    const roleAPI = createRoleAPI(mockSendCommands);

    await assert.rejects(
      async () => {
        await roleAPI.get({ rolename: "non-existent" });
      },
      (err: any) => {
        assert.ok(err instanceof DynsecError);
        assert.strictEqual(err.message, "Role not found");
        assert.strictEqual(err.command, "getRole");
        return true;
      }
    );
  });

  await t.test("list() should dispatch listRoles with defaults and return data", async () => {
    let capturedCommands: any = null;

    const mockListData = {
      totalCount: 2,
      roles: ["admin", "sensor"],
    };

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [
          {
            command: "listRoles",
            data: mockListData,
          },
        ],
      };
    });

    const roleAPI = createRoleAPI(mockSendCommands);
    const result = await roleAPI.list();

    assert.deepStrictEqual(capturedCommands, {
      commands: [{ command: "listRoles", count: -1, offset: 0, verbose: false }],
    });
    assert.deepStrictEqual(result, mockListData);
  });

  await t.test("list() should pass custom pagination options", async () => {
    let capturedCommands: any = null;

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [{ command: "listRoles", data: { totalCount: 1, roles: [] } }],
      };
    });

    const roleAPI = createRoleAPI(mockSendCommands);
    await roleAPI.list({ count: 10, offset: 5, verbose: true });

    assert.deepStrictEqual(capturedCommands, {
      commands: [{ command: "listRoles", count: 10, offset: 5, verbose: true }],
    });
  });

  await t.test("modify() should dispatch modifyRole command", async () => {
    let capturedCommands: any = null;

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [{ command: "modifyRole" }],
      };
    });

    const roleAPI = createRoleAPI(mockSendCommands);
    await roleAPI.modify({
      rolename: "sensor-role",
      textname: "Updated Sensor Role",
    });

    assert.deepStrictEqual(capturedCommands, {
      commands: [
        {
          command: "modifyRole",
          rolename: "sensor-role",
          textname: "Updated Sensor Role",
        },
      ],
    });
  });

  await t.test("remove() should dispatch deleteRole command", async () => {
    let capturedCommands: any = null;

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [{ command: "deleteRole" }],
      };
    });

    const roleAPI = createRoleAPI(mockSendCommands);
    await roleAPI.remove({ rolename: "old-role" });

    assert.deepStrictEqual(capturedCommands, {
      commands: [{ command: "deleteRole", rolename: "old-role" }],
    });
  });

  await t.test("addACL() should dispatch addRoleACL command", async () => {
    let capturedCommands: any = null;

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [{ command: "addRoleACL" }],
      };
    });

    const roleAPI = createRoleAPI(mockSendCommands);
    await roleAPI.addACL({
      rolename: "sensor-role",
      acltype: "publishClientSend",
      topic: "sensors/data",
      priority: 2,
      allow: true,
    });

    assert.deepStrictEqual(capturedCommands, {
      commands: [
        {
          command: "addRoleACL",
          rolename: "sensor-role",
          acltype: "publishClientSend",
          topic: "sensors/data",
          priority: 2,
          allow: true,
        },
      ],
    });
  });

  await t.test("removeACL() should dispatch removeRoleACL command", async () => {
    let capturedCommands: any = null;

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [{ command: "removeRoleACL" }],
      };
    });

    const roleAPI = createRoleAPI(mockSendCommands);
    await roleAPI.removeACL({
      rolename: "sensor-role",
      acltype: "publishClientSend",
      topic: "sensors/data",
    });

    assert.deepStrictEqual(capturedCommands, {
      commands: [
        {
          command: "removeRoleACL",
          rolename: "sensor-role",
          acltype: "publishClientSend",
          topic: "sensors/data",
        },
      ],
    });
  });

  await t.test("should throw DynsecError when response is empty", async () => {
    const mockSendCommands = createMockSender(() => ({
      responses: [],
    }));

    const roleAPI = createRoleAPI(mockSendCommands);

    await assert.rejects(
      async () => {
        await roleAPI.remove({ rolename: "any-role" });
      },
      (err: any) => {
        assert.ok(err instanceof DynsecError);
        assert.strictEqual(err.message, "Empty response received from DynSec broker");
        assert.strictEqual(err.command, "deleteRole");
        return true;
      }
    );
  });
});
