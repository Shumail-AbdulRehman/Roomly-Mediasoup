import { rooms } from "../const/const.js";
import { Msg } from "../types/msg.types.js";
import { Peer } from "../types/peer.types.js";
import { createWebrtcTransport } from "../lib/createWebRtcTransport.js";
import send from "../utils/send.js";
import { getRoom } from "../lib/room.js";

async function onCreateProducerTransport(msg:Msg, peer:Peer) {

    // const roomId=msg.data.roomId;

    const roomId=peer?.roomId;



    if (!roomId) {
    send(peer.ws, {
      type: "error",
      data: {},
      error: "room id is required",
    });
    return;
  }

  const room= getRoom(roomId);

   if (!room) {
    send(peer.ws, {
      type: "error",
      data: {},
      error: "room not found",
    });

    return;
  }


  const {transport, params} = await createWebrtcTransport(room.router);
  peer.transports.set(transport.id,{
    transport,
    type:"send"
  });

  

   send(peer.ws, {
    type: "producerTransportCreated",
    data: params,
  });
return;

}


export default onCreateProducerTransport;