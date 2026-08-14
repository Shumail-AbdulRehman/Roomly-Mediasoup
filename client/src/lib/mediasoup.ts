import { getWebsocket } from "./websocket";

import type {
  Producer,
  Consumer,
  TransportOptions,
} from "mediasoup-client/types";
import type { Msg } from "../types/Msg.type";
import send from "../utils/send";
import { mediaService } from "../services/mediaService";

import type { RemoteParticipant } from "../types/RemoteParticipant.type";

import { store } from "../store/store";
import { signalingEvents } from "../services/signalingEvents";


let connectCallBacks = new Map<string, any>();
let produceCallBacks = new Map<string, any>();


export const onLeave=()=> {

  producers.forEach((producer)=> {
    producer.close();
  })

  consumers.forEach((consumer)=> {
    consumer.close();
  })
  producers.clear();
  consumers.clear();
  remoteParticipants.clear();
  connectCallBacks.clear();
  produceCallBacks.clear();
}


const producers = new Map<string, Producer>();
const consumers = new Map<string, Consumer>();

const remoteParticipants = new Map<string, RemoteParticipant>();




export function getProducers() {
  return producers;
}

export function getConsumers() {
  return consumers;
}

export const onRoomCreated = () => {
  const ws = getWebsocket();

  if (!ws) return;

  const message = {
    type: "getRouterRtpCapabilities",
  };

  console.log("getRouterRtpCapabilities");
  send(ws, message);
  return;
};

export const onRoomJoined = () => {
  const ws = getWebsocket();

  if (!ws) return;

  console.log("Successfully joined room");

  send(ws, {
    type: "getRouterRtpCapabilities",
  });
};

export const onRouterCapabilities = async (msg: Msg) => {
  const ws = getWebsocket();

  if (!ws) return;

  const routerRtpCapabilities = msg.data.routerRtpCapabilities;
  const roomId = msg.data.roomId;

  const device=mediaService.createDevice();
  try {
    await device.load({
      routerRtpCapabilities,
    });

    console.log("Device loaded successfully");
    if (!roomId) return;
    signalingEvents.emit("enter-conference", roomId);
    const messageProducer = {
      type: "createProducerTransport",
    };
    send(ws, messageProducer);

    const messageConsumer = {
      type: "createConsumerTransport",
    };

    send(ws, messageConsumer);
  } catch (error) {
    console.log("error while loading device:: ", error);
    return;
  }
};

export const onProducerTransportCreated = async (msg: Msg) => {
  const ws = getWebsocket();

  if (!ws) return;

  const params: TransportOptions = msg.data;

  if (!params) {
    console.log("params required");
    return;
  }

  const device=mediaService.getDevice();
  if (!device) {
    console.log("device is null");
    return;
  }

  

  const sendTransport = mediaService.createNewSendTransport(params);

  if(!sendTransport){
    console.log("send transport not created");
    return;
  }

  sendTransport.on(
    "connect",
    async ({ dtlsParameters }, callback, _errback) => {
      const requestId = crypto.randomUUID();

      const message = {
        type: "connectProducerTransport",
        data: {
          transportId: sendTransport?.id,
          dtlsParameters,
          requestId,
        },
      };

      connectCallBacks.set(requestId, callback);
      send(ws, message);
    },
  );

  sendTransport.on(
    "produce",
    async ({ kind, rtpParameters, appData }, callback, _errback) => {
      const requestId = crypto.randomUUID();

      const message = {
        type: "produce",
        data: {
          requestId,
          transportId: sendTransport?.id,
          rtpParameters: rtpParameters,
          kind: kind,
          appData: appData,
        },
      };

      produceCallBacks.set(requestId, callback);
      send(ws, message);
    },
  );

  const { audioEnabled, videoEnabled } = store.getState().media;
  console.log("send transport cretaed");
  await mediaService.produce(sendTransport, {
    audioEnabled,
    videoEnabled,
  });
};

export const onProducerTransportConnected = (msg: Msg) => {
  const requestId = msg.data.requestId;
  const callback = connectCallBacks.get(requestId);

  if (!callback) {
    console.log("no connect callback found");
    return;
  }

  callback();

  connectCallBacks.delete(requestId);
};

export const onConsumerTransportCreated = (msg: Msg) => {
  const ws = getWebsocket();

  if (!ws) return;

  const params: TransportOptions = msg.data;

  if (!params) {
    console.log("params required");
    return;
  }

  const device=mediaService.getDevice();

  if (!device) {
    console.log("device isnt created");
    return;
  }
  const recvTransport = mediaService.createNewRecvTransport(params);

  if(!recvTransport){
    console.log("recv transport not created");
    return;
  }
  const message = {
    type: "requestExistingProducers",
  };

  recvTransport.on("connect", ({ dtlsParameters }, callback, _errback) => {
    const requestId = crypto.randomUUID();

    connectCallBacks.set(requestId, callback);

    const message = {
      type: "connectConsumerTransport",
      data: {
        dtlsParameters,
        requestId,
        transportId: recvTransport?.id,
      },
    };

    send(ws, message);
  });

  send(ws, message);
  console.log("created cnsumer transport client");
};

export const onConsumerTransportConnected = (msg: Msg) => {
  const requestId = msg.data.requestId;

  const callback = connectCallBacks.get(requestId);

  if (!callback) {
    console.log("callback not found");
    return;
  }

  callback();

  connectCallBacks.delete(requestId);
};

export const onNewProducer = (msg: Msg) => {
  const ws = getWebsocket();

  const device=mediaService.getDevice();

  const recvTransport=mediaService.getRecvTransport();

  if (!(ws && device && recvTransport)) return;

  const producerId = msg.data;

  if (!producerId) {
    console.log("produder Id not found");
    return;
  }

  const message = {
    type: "createConsumer",
    data: {
      producerId,
      transportId: recvTransport.id,
      rtpCapabilities: device.rtpCapabilities,
    },
  };

  send(ws, message);
};

export const onConsumerCreated = async (msg: Msg) => {
  const ws = getWebsocket();


  const device=mediaService.getDevice();

  const recvTransport=mediaService.getRecvTransport();

  if (!(ws && recvTransport && device)) return;

  const consumerId = msg.data.consumerId;
  const producerId = msg.data.producerId;
  const kind = msg.data.kind;
  const rtpParameters = msg.data.rtpParameters;
  const peerId = msg.data.peerId;
  const appData = msg.data.appData;

  if (!consumerId || !producerId || !kind || !rtpParameters || !peerId) {
    console.log("Consumer data is incomplete");
    return;
  }

  try {
    const consumer = await recvTransport.consume({
      id: consumerId,
      producerId: producerId,
      kind: kind,
      rtpParameters: rtpParameters,
      appData,
    });

    const producerType = consumer.appData?.type;

    let participant = remoteParticipants.get(peerId);
    if (!participant) {
      participant = { peerId };
      remoteParticipants.set(peerId, participant);
    }

    if (producerType === "audio") {
      participant.audioConsumer = consumer;
    } else if (producerType === "camera") {
      participant.cameraConsumer = consumer;
    } else if (producerType === "screen") {
      participant.screenConsumer = consumer;
    }

    signalingEvents.emit("remote-stream", participant);

    consumers.set(consumer.id, consumer);
    console.log("Consumer created:", consumer);

    // remoteStream.addTrack(consumer.track);
    // onRemoteStream?.(remoteStream);

    const message = {
      type: "resumeConsumer",
      data: {
        consumerId: consumer.id,
      },
    };

    send(ws, message);
  } catch (error) {
    console.error("Error while creating consumer:", error);
  }
};

export const onProduced = (msg: Msg) => {
  const requestId = msg.data.requestId;
  const producerId = msg.data.producerId;

  const callback = produceCallBacks.get(requestId);

  if (!callback) {
    console.log("producer callback not found");
    return;
  }

  callback({ id: producerId });

  produceCallBacks.delete(requestId);
};


export const onProducerClosed= (msg:Msg)=> {

    const producerId=msg.data.producerId;

    if(!producerId) return;

    let closedConsumer: Consumer| undefined;

    consumers.forEach((consumer)=> {
        if(consumer.producerId === producerId) {
            closedConsumer=consumer;
        }
    });

    if(closedConsumer) {
        closedConsumer.close();
                    console.log("producer Closed ran",producerId);

        consumers.delete(closedConsumer.id);
    }


    remoteParticipants.forEach((participant)=> {
        if(
            participant.audioConsumer?.id === closedConsumer?.id ||
            participant.cameraConsumer?.id === closedConsumer?.id ||
            participant.screenConsumer?.id === closedConsumer?.id
        ) {
            signalingEvents.emit("producer-closed",{
                peerId:participant.peerId,
                producerId
            });
        }
    })

}