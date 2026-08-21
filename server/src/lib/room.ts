import WebSocket from "ws";
import { Peer } from "../types/peer.types.js";
import { Room } from "../types/room.types.js";
import { createRouterForWorker, getNextWorker } from "./worker.js";
import send from "../utils/send.js";
import { rooms } from "../const/const.js";

export const createRoom = async (peerId: string, peer: Peer,userName:string) => {
  const worker = getNextWorker();
  const mediasoupRouter = await createRouterForWorker(worker);
const roomId = Math.floor(100000 + Math.random() * 900000).toString();
  console.log("room id is::", roomId);

  peer.userName=userName;
  rooms.set(roomId, {
    roomId,
    worker,
    router: mediasoupRouter,
    peers: new Map(),
    producers: new Map(),
    consumers: new Map(),
  });

  peer.roomId = roomId;

  const room = rooms.get(roomId);

  if (!room) return;
  room.peers.set(peerId, peer);

  const message = {
    type: "roomCreated",
    data: { roomId: roomId },
  };
  send(peer.ws, message);
  return;
};


export const joinRoom = (peerId: string, roomId: string, peer: Peer,userName:string) => {
  const room = rooms.get(roomId);

  if(!userName) {
    peer.userName = `Guest-${Math.floor(1000 + Math.random() * 9000)}`; 
   } else {
    peer.userName=userName;
  }



  
  if (!room) {
    console.error("room not found");
    const message = {
      type: "error",
      data: {},
      error: `room not found with roomId ${roomId}`,
    };
    send(peer.ws, message);
    return;
  }

  room.peers.set(peerId, peer);
  peer.roomId = roomId;

  const message = {
    type: "roomJoined",
    data: {
      roomId: roomId,
    },
  };

  send(peer.ws, message);
  return;
};

export const getRoom = (roomId: string): Room | undefined => {
  return rooms.get(roomId);
};

export function broadcast(producerId: string, peer: Peer) {
  if (!peer?.roomId) {
    const message = {
      type: "error",
      data: {},
      error: "roomId not found when broadcasting to other peers",
    };
    send(peer.ws, message);
    return;
  }

  const room = getRoom(peer.roomId);

  if (!room) {
    const message = {
      type: "error",
      data: {},
      error: "room not found when broacasting to other peers",
    };
    send(peer.ws, message);
    return;
  }

  const peers = room.peers;

  peers.forEach((roomPeer) => {
    if (roomPeer.peerId !== peer.peerId) {
      const message = {
        type: "newProducer",
        data: producerId,
      };

      console.log("RoomPeer is::",roomPeer.peerId);
      send(roomPeer.ws, message);
    }
  });
}
