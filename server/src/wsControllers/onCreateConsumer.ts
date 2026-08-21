import { Consumer } from "mediasoup/types";
import { getRoom } from "../lib/room.js";
import { Msg } from "../types/msg.types.js";
import { Peer } from "../types/peer.types.js";
import send from "../utils/send.js";

async function onCreateConsumer(msg: Msg, peer: Peer) {
  const producerId = msg.data.producerId;
  const recvTransportId = msg.data.transportId;
  const rtpCapabilities = msg.data.rtpCapabilities;

  if (!(producerId && recvTransportId && rtpCapabilities)) {
    const message = {
      type: "error",
      data: {},
      error:
        "producerId, recvTransportId and rtpCapabilities are required when consuming",
    };
    send(peer.ws, message);
    return;
  }
  const roomId = peer.roomId;

  if (!roomId) {
    const message = {
      type: "error",
      data: {},
      error: "roomId not found during onConsume",
    };

    send(peer.ws, message);
    return;
  }
  const room = getRoom(roomId);

  if (!room) {
    const message = {
      type: "error",
      data: {},
      error: "room not found during on Consume",
    };
    send(peer.ws, message);
    return;
  }

  const roomProducer = room.producers.get(producerId);

  if (!roomProducer?.producer) {
    const message = {
      type: "error",
      data: {},
      error: "producer not found with the provided producerId during onConsume",
    };
    send(peer.ws, message);
    return;
  }

  const consumerTransportData = peer.transports.get(recvTransportId);

  if (!(
    consumerTransportData?.transport && consumerTransportData?.type === "recv"
  )) {
    const message = {
      type: "error",
      data: {},
      error: "recv transport not found during onConsume",
    };

    send(peer.ws, message);
    return;
  }

  const canConsume = room.router.canConsume({
    producerId,
    rtpCapabilities,
  });

  if (!canConsume) {
    const message = {
      type: "error",
      data: {},
      error: `cannot consume this producer ${producerId} media `,
    };
    send(peer.ws, message);
    return;
  }

  let consumer: Consumer | null = null;

  try {
    consumer = await consumerTransportData.transport.consume({
      producerId,
      rtpCapabilities,
      paused: true,
    });

    
  } catch (error) {
    const message = {
      type: "error",
      data: {},
      error: "error while consuming",
    };

    

    send(peer.ws, message);
    return;
  }

  consumer.on("layerschange", (layers) => {
  console.log(`[server] consumer ${consumer.id} switched to`, layers);
});
  peer.consumers.set(consumer.id, consumer);

  room.consumers.set(consumer.id, {
    peerId: peer.peerId,
    consumer,
  });

  const message = {
    type: "consumerCreated",
    data: {
      consumerId: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      peerId: roomProducer.peerId,
      appData: roomProducer.producer.appData,
      userName:peer.userName
    },
  };

  send(peer.ws, message);
  return;
}

export default onCreateConsumer;
