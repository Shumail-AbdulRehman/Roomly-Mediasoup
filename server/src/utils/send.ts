import WebSocket from "ws";
import { Msg } from "../types/msg.types.js";

export default function send(ws: WebSocket, msg: Msg) {
  ws.send(JSON.stringify(msg));
}
