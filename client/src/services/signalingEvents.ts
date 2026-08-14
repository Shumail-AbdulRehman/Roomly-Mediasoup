import mitt from "mitt";
import type { RemoteParticipant } from "../types/RemoteParticipant.type";

// type Events = {
//   "remote-stream": RemoteParticipant,

// };

// export const mediaEvents = mitt<Events>();

// type SignalingError={
//   "error": string
// }

// export const signalingError= mitt<SignalingError>();

type SignalingEvents = {
  // "roomJoined":{
  //   roomId:string
  // },

  // "createRoom":{
  //   roomId:string
  // },
  "remote-stream": RemoteParticipant;
  "error": string;
  "enter-conference": string;
  "producer-closed": {
    peerId: string;
    producerId: string;
  };
  reconnecting: void;
};

export const signalingEvents = mitt<SignalingEvents>();
