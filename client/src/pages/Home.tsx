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

  const createRoom = async () => {
    const ws = await connectWebSocket();

    send(ws, { type: "createRoom" });

    setLoading(true);
  };

  const joinRoom = async () => {
    const ws = await connectWebSocket();

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
    <div className="min-h-screen bg-canvas text-ink font-sans flex">
      {/* Left pane: controls */}
      <div className="w-full lg:w-[45%] flex flex-col justify-between p-8 lg:p-12 border-r border-border">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Roomly</h1>
          <p className="text-muted text-sm mt-1">Multi-party video calls, simplified.</p>
        </div>

        <div className="max-w-sm w-full mx-auto lg:mx-0 space-y-5">
          {error && (
            <div className="px-4 py-3 rounded-xl bg-tally-red/10 border border-tally-red/20 text-tally-red text-sm">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <input
              type="text"
              placeholder="Enter room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl bg-surface border border-border text-ink placeholder-muted outline-none focus:border-waveform-green/50 focus:bg-surface-highlight transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            />

            <button
              onClick={joinRoom}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-surface-highlight border border-border text-ink font-medium transition-all duration-200 hover:border-t-waveform-green/40 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Join room
            </button>

            <div className="relative flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-border"></div>
              <span className="text-muted text-xs">or</span>
              <div className="flex-1 h-px bg-border"></div>
            </div>

            <button
              onClick={createRoom}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-transparent border border-border text-muted font-medium transition-all duration-200 hover:bg-surface-highlight hover:text-ink active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Create new room
            </button>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={toggleCamera}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all duration-200 active:scale-[0.98] ${
              videoEnabled
                ? "bg-surface-highlight border border-border text-ink"
                : "bg-transparent border border-border text-muted hover:bg-surface-highlight hover:text-ink"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {videoEnabled ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              )}
            </svg>
            <span className="text-sm font-medium">{videoEnabled ? "Camera on" : "Camera off"}</span>
          </button>

          <button
            onClick={toggleAudio}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all duration-200 active:scale-[0.98] ${
              audioEnabled
                ? "bg-surface-highlight border border-border text-ink"
                : "bg-transparent border border-border text-muted hover:bg-surface-highlight hover:text-ink"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {audioEnabled ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z" />
              ) : (
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </>
              )}
            </svg>
            <span className="text-sm font-medium">{audioEnabled ? "Mic on" : "Mic off"}</span>
          </button>
        </div>
      </div>

      {/* Right pane: monitor preview */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-12 bg-canvas">
        <div className="relative w-full max-w-2xl aspect-video rounded-2xl bg-surface border border-border overflow-hidden">
          <div
            className={`absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-500 ${
              videoEnabled ? "opacity-100" : "opacity-0"
            }`}
            style={{ boxShadow: "inset 0 0 60px -20px rgba(0, 255, 95, 0.12)" }}
          />
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {!videoEnabled && (
            <div className="absolute inset-0 bg-canvas flex items-center justify-center">
              <span className="text-muted text-sm">Camera off</span>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-canvas/80 backdrop-blur-sm">
          <svg className="animate-spin h-8 w-8 text-waveform-green" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-muted text-sm font-medium">Joining...</span>
        </div>
      )}
    </div>
  );
}

export default Home;
