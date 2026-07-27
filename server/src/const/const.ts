import { Room } from "../types/room.types.js";
import { Peer } from "../types/peer.types.js";

export const rooms = new Map<string, Room>();

export const peers = new Map<string, Peer>();
