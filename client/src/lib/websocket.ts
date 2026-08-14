import { signalingEvents } from "../services/signalingEvents";
import send from "../utils/send";
import { handleMessage } from "./handleMessage";

let ws: WebSocket | null = null;

let intentionalClose: boolean = false;
let reconnectAttempts: number = 0;
let currentRoomId: string | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export function setIntentionalClose(value: boolean) {
  intentionalClose = value;
}

export function setCurrentRoomId(roomId: string | null) {
  currentRoomId = roomId;
}

export function connectWebSocket(): Promise<WebSocket> {
  if (ws?.readyState === WebSocket.OPEN) return Promise.resolve(ws);

  return new Promise((resolve, reject) => {
    ws = new WebSocket("ws://localhost:3016");

    ws.onopen = () => {
      if (!ws) return;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      reconnectAttempts = 0;
      intentionalClose = false;

      console.log("connected to ws server at localHost:3016");
      resolve(ws);
    };

    ws.onerror = (error: any) => {
      const message =
        error instanceof ErrorEvent
          ? error.message
          : typeof error === "string"
            ? error
            : "WebSocket connection failed";
      signalingEvents.emit("error", message);
      reject(error);
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
      ws = null;

      if (intentionalClose || !currentRoomId) return;

      if (reconnectAttempts >= 2) {
        signalingEvents.emit("error", "Connection lost. Please rejoin.");
        return;
      }

      reconnectAttempts++;
      const delay = Math.min(1000 * 2 ** reconnectAttempts, 30000);

      reconnectTimer = setTimeout(() => {
        connectWebSocket().then((socket) => {
          signalingEvents.emit("reconnecting");
          send(socket, {
            type: "joinRoom",
            data: { roomId: currentRoomId },
          });
        });
      }, delay);
    };

    ws.onmessage = async (event: any) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch (error) {
        console.log("error while parsing JSON::", error);
        return;
      }
      handleMessage(msg);
    };
  });
}

export const getWebsocket = () => {
  return ws;
};
