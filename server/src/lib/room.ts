import WebSocket from "ws";
import { Peer } from "../types/peer.types.js";
import { Room } from "../types/room.types.js";
import { createRouterForWorker, getNextWorker } from "./worker.js";
import send from "../utils/send.js";
import { rooms } from "../const/const.js";


export const createRoom = async (peerId: string, peer: Peer) => {
  const worker = getNextWorker();
  const mediasoupRouter = await createRouterForWorker(worker);
  const roomId = crypto.randomUUID();

  rooms.set(roomId, {
    roomId,
    worker,
    router: mediasoupRouter,
    peers: new Map(),
    producers: new Map(),
    consumers:new Map()
  });

   joinRoom(peerId, roomId, peer);

  const message={
            type:"roomCreated",
            data:roomId
          }
    send(peer.ws,message);
  return;
};

export const leaveRoom = async (peerId: string, roomId: string) => {
  const room = rooms.get(roomId);
  room?.peers.delete(peerId);

  if (room && room.peers.size === 0) {
    try {
      room.router.close();
      rooms.delete(roomId);
    } catch (error) {
      console.log("error while deleting the room: ", error);
    }
  }
};

export const joinRoom = (peerId: string, roomId: string, peer: Peer) => {
  const room = rooms.get(roomId);

  if (!room) {
    console.error("room not found");
    const message={
      type:"error",
      data:{},
      error:`room not found with roomId ${roomId}`
    }
    send(peer.ws,message);
    return;
  }

  room.peers.set(peerId, peer);
  peer.roomId=roomId;
  
          const message= {
            type:"roomJoined",
            data:true,
          }

          send(peer.ws,message);
          return;
};

export const getRoom = (roomId: string): Room | undefined => {
  return rooms.get(roomId);
};


export function broadcast(producerId:string,peer:Peer) {

  if(!peer?.roomId) {

    const message={
      type:"error",
      data:{},
      error:"roomId not found when broadcasting to other peers"
    }
    send(peer.ws,message);
    return;
  }

  const room=getRoom(peer.roomId);

  if(!room) {

    const message= {
      type:"error",
      data:{},
      error:"room not found when broacasting to other peers"
    }
    send(peer.ws,message);
    return;
  }

  const peers=room.peers;

  peers.forEach((roomPeer)=> {
    if(roomPeer.peerId !== peer.peerId){

      const message={
        type:"newProducer",
        data:producerId
      }
      send(roomPeer.ws,message);
    }
  });


}