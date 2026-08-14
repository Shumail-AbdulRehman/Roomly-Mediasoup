import { getRoom } from "../lib/room.js";
import { Msg } from "../types/msg.types.js";
import { Peer } from "../types/peer.types.js";
import send from "../utils/send.js";
import { broadcast } from "../lib/room.js";

function onRequestExistingProducers(msg: Msg, peer: Peer) {
  const roomId = peer.roomId;

  if (!roomId) {
    const message = {
      type: "error",
      data: {},
      error: "room id not found on request existing producers",
    };
    send(peer.ws, message);
    return;
  }

  const room = getRoom(roomId);

  if (!room) {
    const message = {
      type: "error",
      data: {},
      error: "room not found",
    };

    send(peer.ws, message);
    return;
  }

  const roomProducers = room.producers;

  roomProducers.forEach((roomProducer) => {
    if (!(roomProducer.peerId === peer.peerId)) {
      const message = {
        type: "newProducer",
        data: roomProducer.producer.id,
      };
      send(peer.ws, message);
    }
  });
}

export default onRequestExistingProducers;
