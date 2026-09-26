import test from "node:test";
import assert from "node:assert";
import Fastify from "fastify";
import dynsecPlugin from "../src/index.js";

const BROKER_URL = process.env.MQTT_URL || "mqtt://localhost:1883";
const ADMIN_USER = process.env.MOSQUITTO_DYNSEC_USER || "admin";
const ADMIN_PASSWORD = process.env.MOSQUITTO_DYNSEC_PASSWORD || "admin123456789";

test("acl-broker", { concurrency: 1 }, async (t) => {
  const app = Fastify();

  await app.register(dynsecPlugin, {
    url: BROKER_URL,
    adminName: ADMIN_USER,
    adminPassword: ADMIN_PASSWORD,
    failFast: true,
  });

  try {
    await app.ready();

    await t.test("getDefaultAccess() should return existing default ACLs from broker", async () => {
      const acls = await app.dynsec.acl.getDefaultAccess();
      assert.ok(Array.isArray(acls), "acls should be an array");
      assert.ok(acls.length >= 4, "acls should contain all 4 default ACL types");

      const types = acls.map((rule) => rule.acltype);
      assert.ok(types.includes("publishClientSend"));
      assert.ok(types.includes("publishClientReceive"));
      assert.ok(types.includes("subscribe"));
      assert.ok(types.includes("unsubscribe"));

      for (const rule of acls) {
        assert.strictEqual(typeof rule.allow, "boolean");
      }
    });

    await t.test(
      "setDefaultAccess() should update default ACLs and restore them cleanly",
      async (subtest) => {
        // 1. Read current initial ACLs
        const initialAcls = await app.dynsec.acl.getDefaultAccess();

        // Ensure original ACLs are always restored even if an assertion fails
        subtest.after(async () => {
          try {
            await app.dynsec.acl.setDefaultAccess({
              acls: initialAcls.map((r) => ({ acltype: r.acltype, allow: r.allow })),
            });
          } catch {
            // ignore if already restored
          }
        });

        // 2. Flip subscribe permission
        const currentSubscribe = initialAcls.find(
          (rule) => rule.acltype === "subscribe"
        );
        const newAllow = !currentSubscribe?.allow;

        await app.dynsec.acl.setDefaultAccess({
          acls: [{ acltype: "subscribe", allow: newAllow }],
        });

        // 3. Verify it was updated
        const updatedAcls = await app.dynsec.acl.getDefaultAccess();
        const updatedSubscribe = updatedAcls.find(
          (rule) => rule.acltype === "subscribe"
        );
        assert.strictEqual(updatedSubscribe?.allow, newAllow);

        // 4. Restore original ACLs
        await app.dynsec.acl.setDefaultAccess({
          acls: initialAcls.map((r) => ({ acltype: r.acltype, allow: r.allow })),
        });

        // 5. Verify restored state
        const restoredAcls = await app.dynsec.acl.getDefaultAccess();
        const restoredSubscribe = restoredAcls.find(
          (rule) => rule.acltype === "subscribe"
        );
        assert.strictEqual(restoredSubscribe?.allow, currentSubscribe?.allow);
      }
    );
  } finally {
    await app.close();
  }
});
