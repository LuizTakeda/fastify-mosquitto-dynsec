import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin"
import { MqttClient } from "mqtt"

type MosquittoDynsecPluginOptions = {
  url: string,
  adminName: string,
  adminPassword: string
}

const plugin: FastifyPluginAsync<MosquittoDynsecPluginOptions> = async (fastify, options) => {
  
}

export default fp(plugin, {
  fastify: "5.x",
  name: "fastify-mosquitto-dynsec"
});

declare module "fastify" {
  export interface FastifyInsatance {
    dynsec: {
      mqtt: MqttClient
    };
  }
}