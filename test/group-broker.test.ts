import test from "node:test";
import assert from "node:assert";
import Fastify from "fastify";
import dynsecPlugin, { DynsecError } from "../src/index.js";

const BROKER_URL = process.env.MQTT_URL || "mqtt://localhost:1883";
const ADMIN_USER = process.env.MOSQUITTO_DYNSEC_USER || "admin";
const ADMIN_PASSWORD = process.env.MOSQUITTO_DYNSEC_PASSWORD || "admin123456789";

test("group-broker", { concurrency: 1 }, async (t) => {
  const app = Fastify();

  await app.register(dynsecPlugin, {
    url: BROKER_URL,
    adminName: ADMIN_USER,
    adminPassword: ADMIN_PASSWORD,
    failFast: true,
  });

  try {
    await app.ready();

    await t.test("list() should query groups from real broker", async () => {
      const data = await app.dynsec.group.list();
      assert.ok(typeof data.totalCount === "number");
      assert.ok(Array.isArray(data.groups));
    });

    await t.test("getForAnonymousClients() should query anonymous group setting", async () => {
      const result = await app.dynsec.group.getForAnonymousClients();
      assert.ok(result);
      assert.ok(typeof result.groupname === "string");
    });

    await t.test("should execute full group lifecycle (create, addRole, get, modify, removeRole, remove)", async (subtest) => {
      const timestamp = Date.now();
      const groupName = `group-${timestamp}`;
      const roleName = `grp-role-${timestamp}`;

      subtest.after(async () => {
        try {
          await app.dynsec.group.remove({ groupname: groupName });
        } catch {
          // ignore if already deleted
        }
        try {
          await app.dynsec.role.remove({ rolename: roleName });
        } catch {
          // ignore if already deleted
        }
      });

      // 1. Create a helper role to associate with the group
      await app.dynsec.role.create({ rolename: roleName });

      // 2. Create the group
      await app.dynsec.group.create({
        groupname: groupName,
        textname: "Initial Group Name",
        textdescription: "Integration test group",
      });

      // 3. Get group details
      let group = await app.dynsec.group.get({ groupname: groupName });
      assert.strictEqual(group.groupname, groupName);
      assert.strictEqual(group.textname, "Initial Group Name");
      assert.strictEqual(group.textdescription, "Integration test group");
      assert.ok(Array.isArray(group.roles));
      assert.ok(Array.isArray(group.clients));

      // 4. Add role to group
      await app.dynsec.group.addRole({
        groupname: groupName,
        rolename: roleName,
        priority: 1,
      });

      // 5. Verify role was added
      group = await app.dynsec.group.get({ groupname: groupName });
      assert.ok(group.roles.some((r) => r.rolename === roleName));

      // 6. Modify group metadata
      await app.dynsec.group.modify({
        groupname: groupName,
        textname: "Updated Group Name",
      });

      group = await app.dynsec.group.get({ groupname: groupName });
      assert.strictEqual(group.textname, "Updated Group Name");

      // 7. Remove role from group
      await app.dynsec.group.removeRole({
        groupname: groupName,
        rolename: roleName,
      });

      group = await app.dynsec.group.get({ groupname: groupName });
      assert.ok(!group.roles.some((r) => r.rolename === roleName));

      // 8. Delete group and helper role
      await app.dynsec.group.remove({ groupname: groupName });
      await app.dynsec.role.remove({ rolename: roleName });

      // 9. Verify group was deleted
      await assert.rejects(
        async () => {
          await app.dynsec.group.get({ groupname: groupName });
        },
        (err: any) => {
          assert.ok(err instanceof DynsecError);
          assert.strictEqual(err.command, "getGroup");
          return true;
        }
      );
    });

    await t.test("create() should throw DynsecError when attempting to create a duplicate group", async (subtest) => {
      const groupName = `dup-group-${Date.now()}`;

      subtest.after(async () => {
        try {
          await app.dynsec.group.remove({ groupname: groupName });
        } catch {
          // ignore if already deleted
        }
      });

      await app.dynsec.group.create({ groupname: groupName });

      await assert.rejects(
        async () => {
          await app.dynsec.group.create({ groupname: groupName });
        },
        (err: any) => {
          assert.ok(err instanceof DynsecError);
          assert.strictEqual(err.command, "createGroup");
          return true;
        }
      );
    });
  } finally {
    await app.close();
  }
});
