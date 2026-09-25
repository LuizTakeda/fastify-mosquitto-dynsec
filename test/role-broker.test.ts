import test from "node:test";
import assert from "node:assert";
import Fastify from "fastify";
import dynsecPlugin, { DynsecError } from "../src/index.js";

const BROKER_URL = process.env.MQTT_URL || "mqtt://localhost:1883";
const ADMIN_USER = process.env.MOSQUITTO_DYNSEC_USER || "admin";
const ADMIN_PASSWORD = process.env.MOSQUITTO_DYNSEC_PASSWORD || "admin123456789";

test("role-broker", { concurrency: 1 }, async (t) => {
  const app = Fastify();

  await app.register(dynsecPlugin, {
    url: BROKER_URL,
    adminName: ADMIN_USER,
    adminPassword: ADMIN_PASSWORD,
    failFast: true,
  });

  try {
    await app.ready();

    await t.test("list() should return existing roles from real broker", async () => {
      const data = await app.dynsec.role.list();
      assert.ok(data.totalCount >= 1);
      assert.ok(Array.isArray(data.roles));
      assert.ok(
        (data.roles as string[]).includes("admin"),
        "admin role must exist in dynsec broker"
      );
    });

    await t.test("should execute full role lifecycle (create, addACL, get, modify, removeACL, remove)", async () => {
      const roleName = `role-${Date.now()}`;

      // 1. Create role
      await app.dynsec.role.create({
        rolename: roleName,
        textname: "Initial Role Name",
        textdescription: "Integration test role",
      });

      // 2. Get role and verify metadata
      let role = await app.dynsec.role.get({ rolename: roleName });
      assert.strictEqual(role.rolename, roleName);
      assert.strictEqual(role.textname, "Initial Role Name");
      assert.strictEqual(role.textdescription, "Integration test role");

      // 3. Add ACL rule
      await app.dynsec.role.addACL({
        rolename: roleName,
        acltype: "publishClientSend",
        topic: "devices/temperature/#",
        priority: 1,
        allow: true,
      });

      // 4. Verify ACL was applied
      role = await app.dynsec.role.get({ rolename: roleName });
      assert.ok(role.acls.some((acl) => acl.topic === "devices/temperature/#"));

      // 5. Modify role metadata
      await app.dynsec.role.modify({
        rolename: roleName,
        textname: "Updated Role Name",
      });

      role = await app.dynsec.role.get({ rolename: roleName });
      assert.strictEqual(role.textname, "Updated Role Name");

      // 6. Remove ACL rule
      await app.dynsec.role.removeACL({
        rolename: roleName,
        acltype: "publishClientSend",
        topic: "devices/temperature/#",
      });

      role = await app.dynsec.role.get({ rolename: roleName });
      assert.ok(!role.acls.some((acl) => acl.topic === "devices/temperature/#"));

      // 7. Delete role
      await app.dynsec.role.remove({ rolename: roleName });

      // 8. Verify role no longer exists
      await assert.rejects(
        async () => {
          await app.dynsec.role.get({ rolename: roleName });
        },
        (err: any) => {
          assert.ok(err instanceof DynsecError);
          return true;
        }
      );
    });

    await t.test("create() should throw DynsecError when attempting to create a duplicate role", async () => {
      await assert.rejects(
        async () => {
          await app.dynsec.role.create({ rolename: "admin" });
        },
        (err: any) => {
          assert.ok(err instanceof DynsecError);
          assert.strictEqual(err.command, "createRole");
          return true;
        }
      );
    });
  } finally {
    await app.close();
  }
});
