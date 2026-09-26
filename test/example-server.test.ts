import test from "node:test";
import assert from "node:assert";
import { EventEmitter } from "node:events";
import { buildServer } from "../example/server.js";
import type { MqttClient } from "mqtt";

function createMockMqttClient(
  responseHandler?: (commands: any[]) => any
): MqttClient {
  const emitter = new EventEmitter() as any;
  emitter.connected = true;
  emitter.subscribe = (_topic: string, cb?: (err?: Error) => void) => {
    if (cb) cb();
    return emitter;
  };
  emitter.publish = (
    _topic: string,
    payload: string,
    cb?: (err?: Error) => void
  ) => {
    if (cb) cb();
    if (responseHandler) {
      setImmediate(() => {
        try {
          const parsed = JSON.parse(payload);
          const response = responseHandler(parsed.commands);
          emitter.emit(
            "message",
            "$CONTROL/dynamic-security/v1/response",
            Buffer.from(JSON.stringify(response)),
            {} as any
          );
        } catch {
          // ignore
        }
      });
    }
    return emitter;
  };
  emitter.removeListener = emitter.removeListener.bind(emitter);
  emitter.endAsync = async () => {};

  return emitter as MqttClient;
}

test("example server", { concurrency: 1 }, async (t) => {
  await t.test("POST /client should create roles and client with those roles", async () => {
    const dispatchedCommands: any[] = [];
    const mockClient = createMockMqttClient((commands) => {
      dispatchedCommands.push(...commands);
      return {
        responses: commands.map((cmd) => ({ command: cmd.command })),
      };
    });

    const app = buildServer({ mqttClient: mockClient });
    await app.ready();

    const res = await app.inject({
      method: "POST",
      url: "/client",
      payload: {
        username: "sensor-node-01",
        password: "secretPassword123",
        roles: [
          {
            rolename: "telemetry-publisher",
            acls: [
              {
                acltype: "publishClientSend",
                topic: "telemetry/devices/+/data",
                allow: true,
                priority: 0,
              },
            ],
          },
        ],
      },
    });

    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.username, "sensor-node-01");

    // Verify commands sent to DynSec broker
    assert.strictEqual(dispatchedCommands.length, 2);
    assert.strictEqual(dispatchedCommands[0].command, "createRole");
    assert.strictEqual(dispatchedCommands[0].rolename, "telemetry-publisher");
    assert.strictEqual(dispatchedCommands[1].command, "createClient");
    assert.strictEqual(dispatchedCommands[1].username, "sensor-node-01");
    assert.deepStrictEqual(dispatchedCommands[1].roles, [
      { rolename: "telemetry-publisher" },
    ]);

    await app.close();
  });

  await t.test("POST /client should reuse existing role if broker returns already exists error", async () => {
    const mockClient = createMockMqttClient((commands) => {
      const responses = commands.map((cmd) => {
        if (cmd.command === "createRole") {
          return { command: "createRole", error: "Role already exists" };
        }
        return { command: cmd.command };
      });
      return { responses };
    });

    const app = buildServer({ mqttClient: mockClient });
    await app.ready();

    const res = await app.inject({
      method: "POST",
      url: "/client",
      payload: {
        username: "sensor-node-02",
        roles: [{ rolename: "existing-role" }],
      },
    });

    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.username, "sensor-node-02");

    await app.close();
  });

  await t.test("POST /client should create client without roles", async () => {
    let clientCreated = false;
    const mockClient = createMockMqttClient((commands) => {
      clientCreated = commands.some((c) => c.command === "createClient");
      return { responses: commands.map((c) => ({ command: c.command })) };
    });

    const app = buildServer({ mqttClient: mockClient });
    await app.ready();

    const res = await app.inject({
      method: "POST",
      url: "/client",
      payload: {
        username: "sensor-only",
        password: "secretPassword",
      },
    });

    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.username, "sensor-only");
    assert.strictEqual(clientCreated, true);

    await app.close();
  });

  await t.test("GET /clients should list registered clients", async () => {
    const mockClient = createMockMqttClient((commands) => {
      assert.strictEqual(commands[0].count, 10);
      assert.strictEqual(commands[0].offset, 0);
      assert.strictEqual(commands[0].verbose, true);
      return {
        responses: [
          {
            command: "listClients",
            data: {
              totalCount: 2,
              clients: ["admin", "sensor-node-01"],
            },
          },
        ],
      };
    });

    const app = buildServer({ mqttClient: mockClient });
    await app.ready();

    const res = await app.inject({
      method: "GET",
      url: "/clients?count=10&offset=0&verbose=true",
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.totalCount, 2);
    assert.deepStrictEqual(body.clients, ["admin", "sensor-node-01"]);

    await app.close();
  });

  await t.test("DELETE /client/:username should remove client", async () => {
    let deletedUsername = "";
    const mockClient = createMockMqttClient((commands) => {
      deletedUsername = commands[0].username;
      return {
        responses: [{ command: "deleteClient" }],
      };
    });

    const app = buildServer({ mqttClient: mockClient });
    await app.ready();

    const res = await app.inject({
      method: "DELETE",
      url: "/client/sensor-node-01",
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(deletedUsername, "sensor-node-01");

    await app.close();
  });
});
