import { Msg } from "../types/msg.types.js";
import { Peer } from "../types/peer.types.js";
import send from "../utils/send.js";
import { getRoom } from "../lib/room.js";

function onGetRouterRtpCapabilities(msg: Msg, peer: Peer) {
  if (!peer.roomId) {
    console.log("peer room id misisng in onGetRouterRtpCapabilities ");
    return;
  }
  const room = getRoom(peer.roomId);

  if (!room) {
    send(peer.ws, {
      type: "error",
      data: {},
      error: "room not found",
    });
    return;
  }

  const routerRtpCapabilities = room.router.rtpCapabilities;

  if (!routerRtpCapabilities) {
    send(peer.ws, {
      type: "error",
      data: {},
      error: "failed to get router Rtp capabilities",
    });
    return;
  }

  console.log("check rtp ");
  send(peer.ws, {
    type: "routerCapabilities",
    data: { routerRtpCapabilities, roomId: peer.roomId },
  });
  return;
}

export default onGetRouterRtpCapabilities;
