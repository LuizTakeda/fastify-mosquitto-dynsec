import test from "node:test";
import assert from "node:assert";
import Fastify from "fastify";
import dynsecPlugin, { DynsecError } from "../src/index.js";

const BROKER_URL = process.env.MQTT_URL || "mqtt://localhost:1883";
const ADMIN_USER = process.env.MOSQUITTO_DYNSEC_USER || "admin";
const ADMIN_PASSWORD = process.env.MOSQUITTO_DYNSEC_PASSWORD || "admin123456789";

test("client-broker", { concurrency: 1 }, async (t) => {
  const app = Fastify();

  await app.register(dynsecPlugin, {
    url: BROKER_URL,
    adminName: ADMIN_USER,
    adminPassword: ADMIN_PASSWORD,
    failFast: true,
  });

  try {
    await app.ready();

    await t.test("list() should query clients from real broker", async () => {
      const data = await app.dynsec.client.list();
      assert.ok(data.totalCount >= 1);
      assert.ok(Array.isArray(data.clients));
      assert.ok(
        (data.clients as string[]).includes("admin"),
        "admin client must exist in dynsec broker"
      );
    });

    await t.test("should execute full client lifecycle (create, addRole, addToGroup, modify, setId, setPassword, disable, enable, removeRole, removeFromGroup, remove)", async (subtest) => {
      const timestamp = Date.now();
      const username = `client-${timestamp}`;
      const roleName = `cli-role-${timestamp}`;
      const groupName = `cli-group-${timestamp}`;

      subtest.after(async () => {
        try {
          await app.dynsec.client.remove({ username });
        } catch {
          // ignore if already deleted
        }
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

      // 1. Create helper role and group
      await app.dynsec.role.create({ rolename: roleName });
      await app.dynsec.group.create({ groupname: groupName });

      // 2. Create client
      await app.dynsec.client.create({
        username,
        password: "initPassword123",
        textname: "Initial Name",
        textdescription: "Integration test client",
      });

      // 3. Get client details
      let client = await app.dynsec.client.get({ username });
      assert.strictEqual(client.username, username);
      assert.strictEqual(client.textname, "Initial Name");
      assert.strictEqual(client.textdescription, "Integration test client");

      // 4. Add role to client
      await app.dynsec.client.addRole({
        username,
        rolename: roleName,
        priority: 1,
      });

      client = await app.dynsec.client.get({ username });
      assert.ok(client.roles.some((r) => r.rolename === roleName));

      // 5. Add client to group
      await app.dynsec.client.addToGroup({
        username,
        groupname: groupName,
        priority: 1,
      });

      client = await app.dynsec.client.get({ username });
      assert.ok(client.groups.some((g) => g.groupname === groupName));

      // 6. Modify client metadata
      await app.dynsec.client.modify({
        username,
        textname: "Updated Name",
      });

      client = await app.dynsec.client.get({ username });
      assert.strictEqual(client.textname, "Updated Name");

      // 7. Set client ID
      await app.dynsec.client.setId({
        username,
        clientid: "custom-device-id",
      });

      client = await app.dynsec.client.get({ username });
      assert.strictEqual(client.clientid, "custom-device-id");

      // 8. Set password
      await app.dynsec.client.setPassword({
        username,
        password: "newSecurePassword456",
      });

      // 9. Disable and Enable client
      await app.dynsec.client.disable({ username });
      client = await app.dynsec.client.get({ username });
      assert.strictEqual(client.disabled, true);

      await app.dynsec.client.enable({ username });
      client = await app.dynsec.client.get({ username });
      assert.ok(!client.disabled);

      // 10. Remove role from client
      await app.dynsec.client.removeRole({
        username,
        rolename: roleName,
      });

      client = await app.dynsec.client.get({ username });
      assert.ok(!client.roles.some((r) => r.rolename === roleName));

      // 11. Remove client from group
      await app.dynsec.client.removeFromGroup({
        username,
        groupname: groupName,
      });

      client = await app.dynsec.client.get({ username });
      assert.ok(!client.groups.some((g) => g.groupname === groupName));

      // 12. Delete client, helper group, and helper role
      await app.dynsec.client.remove({ username });
      await app.dynsec.group.remove({ groupname: groupName });
      await app.dynsec.role.remove({ rolename: roleName });

      // 13. Verify client no longer exists
      await assert.rejects(
        async () => {
          await app.dynsec.client.get({ username });
        },
        (err: any) => {
          assert.ok(err instanceof DynsecError);
          assert.strictEqual(err.command, "getClient");
          return true;
        }
      );
    });

    await t.test("create() should throw DynsecError when attempting to create a duplicate client", async () => {
      await assert.rejects(
        async () => {
          await app.dynsec.client.create({ username: "admin" });
        },
        (err: any) => {
          assert.ok(err instanceof DynsecError);
          assert.strictEqual(err.command, "createClient");
          return true;
        }
      );
    });
  } finally {
    await app.close();
  }
});
