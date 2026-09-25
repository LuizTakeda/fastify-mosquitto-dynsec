import test from "node:test";
import assert from "node:assert";
import Fastify from "fastify";
import dynsecPlugin from "../src/index.js";

const BROKER_URL = process.env.MQTT_URL || "mqtt://localhost:1883";
const ADMIN_USER = process.env.MOSQUITTO_DYNSEC_USER || "admin";
const ADMIN_PASSWORD = process.env.MOSQUITTO_DYNSEC_PASSWORD || "admin123456789";

test("plugin-broker", { concurrency: 1 }, async (t) => {
  await t.test("should fail registration when failFast is true and credentials are wrong", async () => {
    const app = Fastify();

    await assert.rejects(
      async () => {
        await app.register(dynsecPlugin, {
          url: BROKER_URL,
          adminName: "wrong-user",
          adminPassword: "wrong-password",
          failFast: true,
          reconnectPeriod: 0, // don't keep reconnecting on failure
        });
        await app.ready();
      },
      (err: any) => {
        assert.ok(err, "should throw an error on bad credentials");
        return true;
      }
    );

    await app.close();
  });

  await t.test("should connect to real broker and execute DynSec commands", async () => {
    const app = Fastify();

    await app.register(dynsecPlugin, {
      url: BROKER_URL,
      adminName: ADMIN_USER,
      adminPassword: ADMIN_PASSWORD,
      failFast: true,
    });

    try {
      await app.ready();

      assert.ok(app.hasDecorator("mqtt"), "should have fastify.mqtt");
      assert.ok(app.hasDecorator("dynsec"), "should have fastify.dynsec");
      assert.strictEqual(app.mqtt.connected, true, "mqtt client should be connected");

      // 1. List existing roles (admin role should exist)
      const listRes = await app.dynsec.sendCommands<{
        responses: Array<{
          command: string;
          data?: { totalCount: number; roles: string[] };
        }>;
      }>({
        commands: [{ command: "listRoles" }],
      });

      assert.ok(listRes.responses, "should have responses array");
      assert.strictEqual(listRes.responses[0].command, "listRoles");
      assert.ok(Array.isArray(listRes.responses[0].data?.roles));
      assert.ok(listRes.responses[0].data!.roles.includes("admin"), "admin role should exist in dynsec broker");

      // 2. Create a test role
      const testRoleName = `test-role-${Date.now()}`;
      const createRes = await app.dynsec.sendCommands<{
        responses: Array<{ command: string; error?: string }>;
      }>({
        commands: [{ command: "createRole", rolename: testRoleName }],
      });

      assert.strictEqual(createRes.responses[0].command, "createRole");
      assert.strictEqual(createRes.responses[0].error, undefined, "should not have error creating role");

      // 3. Get the created role
      const getRes = await app.dynsec.sendCommands<{
        responses: Array<{
          command: string;
          data?: { role: { rolename: string } };
          error?: string;
        }>;
      }>({
        commands: [{ command: "getRole", rolename: testRoleName }],
      });

      assert.strictEqual(getRes.responses[0].command, "getRole");
      assert.strictEqual(getRes.responses[0].data?.role.rolename, testRoleName);

      // 4. Delete the test role (cleanup)
      const deleteRes = await app.dynsec.sendCommands<{
        responses: Array<{ command: string; error?: string }>;
      }>({
        commands: [{ command: "deleteRole", rolename: testRoleName }],
      });

      assert.strictEqual(deleteRes.responses[0].command, "deleteRole");
      assert.strictEqual(deleteRes.responses[0].error, undefined);
    } finally {
      await app.close();
    }
  });

  await t.test("should process concurrent commands sequentially without response collision", async () => {
    const app = Fastify();

    await app.register(dynsecPlugin, {
      url: BROKER_URL,
      adminName: ADMIN_USER,
      adminPassword: ADMIN_PASSWORD,
      failFast: true,
    });

    try {
      await app.ready();

      const timestamp = Date.now();
      const role1 = `concurrent-role-1-${timestamp}`;
      const role2 = `concurrent-role-2-${timestamp}`;
      const role3 = `concurrent-role-3-${timestamp}`;

      // Dispatch 3 commands concurrently through the plugin queue
      const [res1, res2, res3] = await Promise.all([
        app.dynsec.sendCommands<{ responses: Array<{ command: string }> }>({
          commands: [{ command: "createRole", rolename: role1 }],
        }),
        app.dynsec.sendCommands<{ responses: Array<{ command: string }> }>({
          commands: [{ command: "createRole", rolename: role2 }],
        }),
        app.dynsec.sendCommands<{ responses: Array<{ command: string }> }>({
          commands: [{ command: "createRole", rolename: role3 }],
        }),
      ]);

      assert.strictEqual(res1.responses[0].command, "createRole");
      assert.strictEqual(res2.responses[0].command, "createRole");
      assert.strictEqual(res3.responses[0].command, "createRole");

      // Cleanup created roles concurrently
      await Promise.all([
        app.dynsec.sendCommands({ commands: [{ command: "deleteRole", rolename: role1 }] }),
        app.dynsec.sendCommands({ commands: [{ command: "deleteRole", rolename: role2 }] }),
        app.dynsec.sendCommands({ commands: [{ command: "deleteRole", rolename: role3 }] }),
      ]);
    } finally {
      await app.close();
    }
  });
});
