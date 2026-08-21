import { Consumer, Producer, Transport } from "mediasoup/types";
import WebSocket from "ws";

export interface Peer {
  peerId: string;
  userName?:string;
  roomId?: string;
  ws: WebSocket;
  transports: Map<string, TransportData>;
  producers: Map<string, Producer>;
  consumers: Map<string, Consumer>;
}

type TransportData = {
  transport: Transport;
  type: "send" | "recv";
};
