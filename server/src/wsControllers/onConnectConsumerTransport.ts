import { Msg } from "../types/msg.types.js";
import { Peer } from "../types/peer.types.js";
import send from "../utils/send.js";

export async function onConnectConsumerTransport(msg: Msg, peer: Peer) {
  const transportId = msg.data.transportId;
  const dtlsParameters = msg.data.dtlsParameters;
  const requestId = msg.data.requestId;

  const transportData = peer.transports.get(transportId);

  if (!(transportData?.transport && dtlsParameters)) {
    const message = {
      type: "error",
      data: {},
      error: "transport and dtlsParameters required",
    };
    send(peer.ws, message);
    return;
  }

  try {
    await transportData.transport.connect({ dtlsParameters });
  } catch (error) {
    const message = {
      type: "error",
      data: {},
      error: "error while connecting to consumer transport",
    };
    send(peer.ws, message);
    console.log("error while conecting to consumer Transort: ", error);
    return;
  }

  const message = {
    type: "consumerTransportConnected",
    data: {
      transportId: transportData.transport.id,
      requestId,
    },
  };
  send(peer.ws, message);
  return;
}
