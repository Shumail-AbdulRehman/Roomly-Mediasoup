import { useEffect, useRef, useState } from "react";
import send from "../utils/send";
import { connectWebSocket } from "../lib/websocket";
import { useNavigate } from "react-router-dom";
import { mediaService } from "../services/mediaService";
import { useDispatch } from "react-redux";
import { setAudio, setVideo } from "../store/mediaSlice";
import type { AppDispatch } from "../store/store";
import { signalingEvents } from "../services/signalingEvents";

function Home() {
  const navigate = useNavigate();

  const dispatch = useDispatch<AppDispatch>();
  const [roomId, setRoomId] = useState("");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const [loading, setLoading] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);

  useEffect(() => {
    startCamera();
  }, []);

  useEffect(() => {
    const handleRoomJoin = (data: string) => {
      navigate("/conference", {
        state: {
          videoEnabled,
          audioEnabled,
          roomId: data,
        },
      });
    };

    setLoading(false);

    signalingEvents.on("enter-conference", handleRoomJoin);

    return () => {
      signalingEvents.off("enter-conference", handleRoomJoin);
    };
  }, [navigate, audioEnabled, videoEnabled]);

  useEffect(() => {
    const handleError = (error: string) => {
      setError(error);
    };

    signalingEvents.on("error", handleError);

    return () => {
      signalingEvents.off("error", handleError);
    };
  }, []);

  const startCamera = async () => {
    const stream = await mediaService.init();

    if (!stream) return;

    if (stream.getVideoTracks()[0]) {
      setVideoEnabled(true);
      dispatch(setVideo(true));
    }

    if (stream.getAudioTracks()[0]) {
      setAudioEnabled(true);
      dispatch(setAudio(true));
    }

    setLocalStream(stream);

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
  };

  const toggleAudio = () => {
    if (!localStream) return;

    const track = localStream.getAudioTracks()[0];
    if (!track) return;

    track.enabled = !track.enabled;
    setAudioEnabled(track.enabled);
    dispatch(setAudio(track.enabled));
  };

  const toggleCamera = () => {
    if (!localStream) return;

    const track = localStream.getVideoTracks()[0];
    if (!track) return;

    track.enabled = !track.enabled;
    setVideoEnabled(track.enabled);
    dispatch(setVideo(track.enabled));
  };

  const createRoom = async() => {
        const ws=await connectWebSocket();


    send(ws, { type: "createRoom" });

    setLoading(true);
  };

  const joinRoom =async () => {
    const ws=await connectWebSocket();

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.log("WebSocket is not connected");
      return;
    }

    if (!roomId.trim()) {
      alert("Please enter a room ID");
      return;
    }

    console.log("Trying to join room:", roomId);

    send(ws, {
      type: "joinRoom",
      data: {
        roomId: roomId.trim(),
      },
    });

    setLoading(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c] font-['Manrope'] text-stone-100 p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/[0.03] rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-orange-500/[0.03] rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-[420px] bg-[#141416] border border-white/[0.06] rounded-3xl shadow-2xl shadow-black/50 overflow-hidden">
        <div className="p-8">
          <p className="text-center text-stone-500 text-sm mb-8">
            Join or create a room to start
          </p>

          <div className="space-y-4">
            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="relative">
              <input
                type="text"
                placeholder="Enter Room ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-stone-100 placeholder-stone-600 outline-none focus:border-amber-500/40 focus:bg-white/[0.05] transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <button
              onClick={joinRoom}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#0a0a0c] font-semibold transition-all duration-200 shadow-lg shadow-amber-500/10 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Join Room
            </button>

            <div className="relative flex items-center gap-4 py-2">
              <div className="flex-1 h-px bg-white/[0.06]"></div>
              <span className="text-stone-600 text-xs font-medium uppercase tracking-wider">
                or
              </span>
              <div className="flex-1 h-px bg-white/[0.06]"></div>
            </div>

            <button
              onClick={createRoom}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] text-stone-200 font-medium transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Create New Room
            </button>
          </div>
        </div>

        {loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[#0a0a0c]/80 backdrop-blur-sm">
            <svg
              className="animate-spin h-8 w-8 text-amber-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span className="text-stone-400 text-sm font-medium">
              Joining...
            </span>
          </div>
        )}

        <div className="border-t border-white/[0.06] bg-white/[0.02] p-6">
          <div className="relative rounded-2xl overflow-hidden bg-[#0a0a0c] border border-white/[0.06] aspect-video mb-4">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {!videoEnabled && (
              <div className="absolute inset-0 bg-[#0a0a0c] flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-xl text-stone-500">
                  You
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={toggleCamera}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all duration-200 ${
                videoEnabled
                  ? "bg-white/[0.06] text-stone-200 border border-white/[0.08] hover:bg-white/[0.10]"
                  : "bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/20"
              }`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {videoEnabled ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                  />
                )}
              </svg>
              <span className="text-sm font-medium">
                {videoEnabled ? "Camera Off" : "Camera On"}
              </span>
            </button>

            <button
              onClick={toggleAudio}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all duration-200 ${
                audioEnabled
                  ? "bg-white/[0.06] text-stone-200 border border-white/[0.08] hover:bg-white/[0.10]"
                  : "bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/20"
              }`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {audioEnabled ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z"
                  />
                ) : (
                  <>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                    />
                  </>
                )}
              </svg>
              <span className="text-sm font-medium">
                {audioEnabled ? "Mute" : "Unmute"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
