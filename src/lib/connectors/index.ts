import type { Platform } from "../types";
import { sallaConnector } from "./salla";
import type { Connector } from "./types";
import { wooConnector } from "./woocommerce";
import { zidConnector } from "./zid";

const connectors: Record<Platform, Connector> = {
  salla: sallaConnector,
  zid: zidConnector,
  woocommerce: wooConnector,
};

export function connectorFor(platform: Platform): Connector {
  return connectors[platform];
}

export type { Connector, WebhookEvent, OrderEvent, CartTarget, FetchLike } from "./types";
