import type { Msg } from "../types/Msg.type";

export default function send(ws: WebSocket, msg: Msg) {
  ws.send(JSON.stringify(msg));
}
