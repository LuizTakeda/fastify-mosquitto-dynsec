import Fastify from "fastify";
import { fileURLToPath } from "node:url";
import dynsecPlugin from "../src/index.js";

export function buildServer(opts: any = {}) {
  const { logger = false, ...pluginOpts } = opts;
  const app = Fastify({ logger });

  app.register(dynsecPlugin, {
    url: process.env.MQTT_URL || "mqtt://localhost:1883",
    adminName: process.env.MOSQUITTO_DYNSEC_USER || "admin",
    adminPassword: process.env.MOSQUITTO_DYNSEC_PASSWORD || "admin123456789",
    failFast: process.env.NODE_ENV !== "test",
    ...pluginOpts,
  });

  // 1. POST /client: Create roles (if provided) and provision the client
  app.post("/client", async (req, reply) => {
    const { username, password, roles } = req.body as any;

    if (roles) {
      for (const role of roles) {
        try {
          await app.dynsec.role.create(role);
        } catch (err: any) {
          // Reuse role if it already exists on the broker
          if (!err.message?.includes("already exists")) throw err;
        }
      }
    }

    await app.dynsec.client.create({
      username,
      password,
      roles: roles?.map((r: any) => ({ rolename: r.rolename })),
    });

    return reply.status(201).send({ success: true, username });
  });

  // 2. GET /clients: List registered clients
  app.get("/clients", async (req) => {
    const { count = -1, offset = 0, verbose = false } = req.query as any;
    return app.dynsec.client.list({
      count: Number(count),
      offset: Number(offset),
      verbose: Boolean(verbose),
    });
  });

  // 3. DELETE /client/:username: Remove a client
  app.delete("/client/:username", async (req) => {
    const { username } = req.params as any;
    await app.dynsec.client.remove({ username });
    return { success: true };
  });

  return app;
}

// Start server if executed directly from terminal
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const app = buildServer({ logger: true });
  await app.listen({ port: 3000, host: "0.0.0.0" });
}