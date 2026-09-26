import test from "node:test";
import assert from "node:assert";
import { EventEmitter } from "node:events";
import Fastify from "fastify";
import dynsecPlugin from "../src/index.js";
import type { MqttClient } from "mqtt";

function createMockMqttClient(overrides: Record<string, unknown> = {}): MqttClient {
  const emitter = new EventEmitter() as any;
  emitter.connected = true;
  emitter.subscribe = (_topic: string, cb?: (err?: Error) => void) => {
    if (cb) cb();
    return emitter;
  };
  emitter.publish = (_topic: string, _payload: string, cb?: (err?: Error) => void) => {
    if (cb) cb();
    return emitter;
  };
  emitter.removeListener = emitter.removeListener.bind(emitter);
  emitter.endAsync = async () => { };

  Object.assign(emitter, overrides);
  return emitter as MqttClient;
}

test("plugin-mock", { concurrency: 1 }, async (t) => {
  await t.test("should register plugin and decorate fastify instance", async () => {
    const app = Fastify();
    const mockClient = createMockMqttClient();

    await app.register(dynsecPlugin, {
      url: "mqtt://localhost:1883",
      mqttClient: mockClient,
    });

    await app.ready();

    assert.ok(app.hasDecorator("mqtt"), "should have fastify.mqtt decorator");
    assert.ok(app.hasDecorator("dynsec"), "should have fastify.dynsec decorator");
    assert.strictEqual(typeof app.dynsec.sendCommands, "function");

    await app.close();
  });

  await t.test("should successfully send command and receive response", async () => {
    const app = Fastify();
    const mockClient = createMockMqttClient();

    mockClient.publish = ((_topic: string, _payload: string, cb?: (err?: Error) => void) => {
      setImmediate(() => {
        const fakeDynSecResponse = {
          responses: [{ command: "listRoles", data: { roles: [] } }],
        };
        mockClient.emit(
          "message",
          "$CONTROL/dynamic-security/v1/response",
          Buffer.from(JSON.stringify(fakeDynSecResponse)),
          {} as any
        );
      });
      if (cb) cb();
      return mockClient;
    }) as any;

    await app.register(dynsecPlugin, {
      url: "mqtt://localhost:1883",
      mqttClient: mockClient,
    });
    await app.ready();

    const response = await app.dynsec.sendCommands<{ responses: Array<{ command: string; data: unknown }> }>({
      commands: [{ command: "listRoles" }],
    });

    assert.deepStrictEqual(response, {
      responses: [{ command: "listRoles", data: { roles: [] } }],
    });

    await app.close();
  });

  await t.test("should throw if mqttClient is disconnected when sending command", async () => {
    const app = Fastify();
    const mockClient = createMockMqttClient({ connected: false });

    await app.register(dynsecPlugin, {
      url: "mqtt://localhost:1883",
      mqttClient: mockClient,
    });
    await app.ready();

    await assert.rejects(
      async () => {
        await app.dynsec.sendCommands({ commands: [] });
      },
      {
        name: "Error",
        message: "MQTT client is not connected",
      }
    );

    await app.close();
  });

  await t.test("should reject with timeout if broker does not respond in time", async () => {
    const app = Fastify();
    const mockClient = createMockMqttClient();

    await app.register(dynsecPlugin, {
      url: "mqtt://localhost:1883",
      mqttClient: mockClient,
      commandResponseTimeout: 50,
    });
    await app.ready();

    await assert.rejects(
      async () => {
        await app.dynsec.sendCommands({ commands: [] });
      },
      {
        name: "Error",
        message: "DynSec command timed out waiting for response",
      }
    );

    await app.close();
  });

  await t.test("should reject if publishing command fails", async () => {
    const app = Fastify();
    const mockClient = createMockMqttClient({
      publish: (_t: string, _p: string, cb?: (err?: Error) => void) => {
        if (cb) cb(new Error("Network write error"));
      },
    });

    await app.register(dynsecPlugin, {
      url: "mqtt://localhost:1883",
      mqttClient: mockClient,
    });
    await app.ready();

    await assert.rejects(
      async () => {
        await app.dynsec.sendCommands({ commands: [] });
      },
      {
        name: "Error",
        message: "Failed to publish command",
      }
    );

    await app.close();
  });

  await t.test("should reject if response payload is invalid JSON", async () => {
    const app = Fastify();
    const mockClient = createMockMqttClient();

    mockClient.publish = ((_t: string, _p: string, cb?: (err?: Error) => void) => {
      setImmediate(() => {
        mockClient.emit(
          "message",
          "$CONTROL/dynamic-security/v1/response",
          Buffer.from("invalid-json{"),
          {} as any
        );
      });
      if (cb) cb();
      return mockClient;
    }) as any;

    await app.register(dynsecPlugin, {
      url: "mqtt://localhost:1883",
      mqttClient: mockClient,
    });
    await app.ready();

    await assert.rejects(
      async () => {
        await app.dynsec.sendCommands({ commands: [] });
      },
      /Failed to parse response/
    );

    await app.close();
  });

  await t.test("should not close external mqttClient on fastify close", async () => {
    const app = Fastify();
    let endCalled = false;
    const mockClient = createMockMqttClient({
      endAsync: async () => {
        endCalled = true;
      },
    });

    await app.register(dynsecPlugin, {
      url: "mqtt://localhost:1883",
      mqttClient: mockClient,
    });
    await app.ready();
    await app.close();

    assert.strictEqual(endCalled, false, "External client should not be closed by the plugin");
  });

  await t.test("should wait for connect event when failFast is true and client is not yet connected", async () => {
    const app = Fastify();
    const mockClient = createMockMqttClient({ connected: false });

    const originalOnce = mockClient.once.bind(mockClient);
    mockClient.once = ((event: any, listener: any) => {
      if (event === "connect") {
        setImmediate(() => {
          mockClient.connected = true;
          listener();
        });
      }
      return (originalOnce as any)(event, listener);
    }) as any;

    await app.register(dynsecPlugin, {
      url: "mqtt://localhost:1883",
      mqttClient: mockClient,
      failFast: true,
    });

    await app.ready();
    assert.strictEqual(mockClient.connected, true);
    await app.close();
  });

  await t.test("should reject app.ready() when failFast is true and client emits error", async () => {
    const app = Fastify();
    const mockClient = createMockMqttClient({ connected: false });

    const originalOnce = mockClient.once.bind(mockClient);
    mockClient.once = ((event: any, listener: any) => {
      if (event === "error") {
        setImmediate(() => {
          listener(new Error("Connection failed"));
        });
      }
      return (originalOnce as any)(event, listener);
    }) as any;

    await assert.rejects(
      async () => {
        await app.register(dynsecPlugin, {
          url: "mqtt://localhost:1883",
          mqttClient: mockClient,
          failFast: true,
        });
        await app.ready();
      },
      {
        name: "Error",
        message: "Connection failed",
      }
    );

    await app.close();
  });

  await t.test("should ignore messages received on unrelated topics", async () => {
    const app = Fastify();
    const mockClient = createMockMqttClient();

    mockClient.publish = ((_topic: string, _payload: string, cb?: (err?: Error) => void) => {
      setImmediate(() => {
        // Emit unrelated message first (should be ignored)
        mockClient.emit("message", "some/other/topic", Buffer.from(JSON.stringify({ ignored: true })), {} as any);

        // Then emit actual dynsec response
        const fakeDynSecResponse = {
          responses: [{ command: "listRoles", data: { roles: ["admin"] } }],
        };
        mockClient.emit(
          "message",
          "$CONTROL/dynamic-security/v1/response",
          Buffer.from(JSON.stringify(fakeDynSecResponse)),
          {} as any
        );
      });
      if (cb) cb();
      return mockClient;
    }) as any;

    await app.register(dynsecPlugin, {
      url: "mqtt://localhost:1883",
      mqttClient: mockClient,
    });
    await app.ready();

    const response = await app.dynsec.sendCommands<{ responses: Array<{ command: string; data: unknown }> }>({
      commands: [{ command: "listRoles" }],
    });

    assert.deepStrictEqual(response, {
      responses: [{ command: "listRoles", data: { roles: ["admin"] } }],
    });

    await app.close();
  });
});
