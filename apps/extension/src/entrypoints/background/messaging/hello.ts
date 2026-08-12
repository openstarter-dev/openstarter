import { defineExtensionMessaging } from "webext-bridge";

interface ProtocolMap {
  hello: { name: string };
}

export const { onMessage } = defineExtensionMessaging<ProtocolMap>();
