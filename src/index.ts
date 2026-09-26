import fastify, { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin"
import mqtt, { MqttClient } from "mqtt"
import { TaskQueue } from "./task-queue.js";
import { createRoleAPI } from "./role.js";
import { createGroupAPI } from "./group.js";
import { createClientAPI } from "./client.js";
import { createAclAPI } from "./acl.js";

export { DynsecError } from "./errors.js";

const CMD_TOPIC = "$CONTROL/dynamic-security/v1";
const RESP_TOPIC = "$CONTROL/dynamic-security/v1/response";

export type SendCommandsFunction = <T = unknown>(commands: object) => Promise<T>;

type DynsecAPI = {
  sendCommands: SendCommandsFunction;
  role: ReturnType<typeof createRoleAPI>;
  group: ReturnType<typeof createGroupAPI>;
  client: ReturnType<typeof createClientAPI>;
  acl: ReturnType<typeof createAclAPI>;
};

type MosquittoDynsecPluginOptions = {
  url: string,
  adminName?: string,
  adminPassword?: string,
  clientId?: string,
  reconnectPeriod?: number,
  failFast?: boolean,
  mqttClient?: MqttClient,
  commandResponseTimeout?: number,
}

const plugin: FastifyPluginAsync<MosquittoDynsecPluginOptions> = async (fastify, options) => {
  const taskQueue = new TaskQueue();

  const logger = fastify.log.child({ name: "dynsec" });

  const mqttClient = options.mqttClient ?
    options.mqttClient :
    mqtt.connect(options.url, {
      username: options.adminName,
      password: options.adminPassword,
      clientId: options.clientId,
      reconnectPeriod: options.reconnectPeriod,
      resubscribe: true
    });

  fastify.addHook('onClose', async () => {
    if (!options.mqttClient) {
      await mqttClient.endAsync();
    }
  });

  mqttClient.on("connect", () => {
    logger.info("connected to MQTT broker");

    mqttClient.subscribe(RESP_TOPIC, (err) => {
      if (err) {
        logger.error({ err }, "Failed to subscribe to response topic");
      }
    });
  })

  mqttClient.on("error", (err) => {
    logger.error({ err }, "MQTT client encountered an error");
  });

  if (options.failFast && !mqttClient.connected) {
    await new Promise<void>((resolve, reject) => {
      mqttClient.once('connect', () => resolve());
      mqttClient.once('error', (err) => reject(err));
    });
  }

  const sendCommands = async <T = unknown>(commands: object): Promise<T> => {
    return await taskQueue.enqueue(async () => {
      if (!mqttClient.connected) {
        throw new Error("MQTT client is not connected");
      }

      return new Promise<T>((resolve, reject) => {
        const timeoutMs = options.commandResponseTimeout ?? 3000;
        let timer: NodeJS.Timeout | null = null;

        const cleanup = () => {
          if (timer) {
            clearTimeout(timer);
          }
          mqttClient.removeListener("message", onResponseMessage);
        };

        const onResponseMessage = (topic: string, payload: Buffer<ArrayBufferLike>) => {
          if (topic !== RESP_TOPIC) {
            return;
          }

          cleanup();

          try {
            const response = JSON.parse(payload.toString());
            resolve(response as T);
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error}`));
          }
        };

        mqttClient.on("message", onResponseMessage);

        mqttClient.publish(CMD_TOPIC, JSON.stringify(commands), (err) => {
          if (err) {
            cleanup();
            reject(new Error("Failed to publish command"));
          }
        });

        timer = setTimeout(() => {
          cleanup();
          reject(new Error("DynSec command timed out waiting for response"));
        }, timeoutMs);
      });
    });
  };

  fastify.decorate("mqtt", mqttClient);

  const dynsec: DynsecAPI = {
    sendCommands,
    role: createRoleAPI(sendCommands),
    group: createGroupAPI(sendCommands),
    client: createClientAPI(sendCommands),
    acl: createAclAPI(sendCommands),
  };

  fastify.decorate("dynsec", dynsec)
}

export default fp(plugin, {
  fastify: "5.x",
  name: "fastify-mosquitto-dynsec"
});

declare module "fastify" {
  export interface FastifyInstance {
    mqtt: MqttClient,
    dynsec: DynsecAPI;
  }
}
