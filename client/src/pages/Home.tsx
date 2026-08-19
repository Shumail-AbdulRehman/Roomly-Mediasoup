import { useCallback, useEffect, useRef, useState } from "react";
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
  const [error, setError] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const isJoiningRef = useRef(false);
  const mountedRef = useRef(true);
  const audioEnabledRef = useRef(audioEnabled);
  const videoEnabledRef = useRef(videoEnabled);

  const setLocalVideoNode = useCallback(
    (node: HTMLVideoElement | null) => {
      if (!node) return;
      localVideoRef.current = node;
      if (localStream) {
        node.srcObject = localStream;
      }
    },
    [localStream],
  );

  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
    videoEnabledRef.current = videoEnabled;
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const startCamera = async () => {
      try {
        const stream = await mediaService.init();
        if (!mounted || !stream) return;

        const hasVideo = stream.getVideoTracks().length > 0;
        const hasAudio = stream.getAudioTracks().length > 0;

        if (hasVideo) {
          setVideoEnabled(true);
          dispatch(setVideo(true));
        }
        if (hasAudio) {
          setAudioEnabled(true);
          dispatch(setAudio(true));
        }

        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error starting camera:", err);
        setError("Could not access camera or microphone.");
      }
    };

    startCamera();

    return () => {
      mounted = false;
    };
  }, [dispatch]);

  useEffect(() => {
    const handleRoomJoin = (data: string) => {
      setLoading(false);
      isJoiningRef.current = false;
      navigate("/conference", {
        state: {
          videoEnabled: videoEnabledRef.current,
          audioEnabled: audioEnabledRef.current,
          roomId: data,
        },
      });
    };

    const handleError = (errorMessage: string) => {
      setError(errorMessage);
      setLoading(false);
      isJoiningRef.current = false;
    };

    signalingEvents.on("enter-conference", handleRoomJoin);
    signalingEvents.on("error", handleError);

    return () => {
      signalingEvents.off("enter-conference", handleRoomJoin);
      signalingEvents.off("error", handleError);
    };
  }, [navigate]);

  const toggleAudio = () => {
    if (!localStream) return;
    const track = localStream.getAudioTracks()[0];
    if (!track) return;

    track.enabled = !track.enabled;
    setAudioEnabled(track.enabled);
    dispatch(setAudio(track.enabled));
    mediaService.toggleAudio(track.enabled);
  };

  const toggleVideo = () => {
    if (!localStream) return;
    const track = localStream.getVideoTracks()[0];
    if (!track) return;

    track.enabled = !track.enabled;
    setVideoEnabled(track.enabled);
    dispatch(setVideo(track.enabled));
    mediaService.toggleVideo(track.enabled);
  };

  const handleJoinRoom = async () => {
    if (isJoiningRef.current || loading) return;

    const trimmed = roomId.trim();
    if (!trimmed) {
      setError("Please enter a room ID");
      return;
    }

    setError(null);
    setLoading(true);
    isJoiningRef.current = true;

    try {
      const ws = await connectWebSocket();
      if (!mountedRef.current) return;
      send(ws, {
        type: "joinRoom",
        data: { roomId: trimmed },
      });
    } catch {
      if (!mountedRef.current) return;
      setLoading(false);
      isJoiningRef.current = false;
      setError("Could not connect to server.");
    }
  };

  const handleCreateRoom = async () => {
    if (isJoiningRef.current || loading) return;

    setError(null);
    setLoading(true);
    isJoiningRef.current = true;

    try {
      const ws = await connectWebSocket();
      if (!mountedRef.current) return;
      send(ws, { type: "createRoom" });
    } catch {
      if (!mountedRef.current) return;
      setLoading(false);
      isJoiningRef.current = false;
      setError("Could not connect to server.");
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink font-sans flex flex-col lg:flex-row">
      {/* Left pane */}
      <div className="relative w-full lg:w-[45%] flex flex-col p-8 lg:p-12">
        {/* Header */}
        <div className="mb-6 lg:mb-12">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
            Roomly
          </h1>
          <p className="text-sm text-muted mt-1">
            Multi-party video calls, simplified
          </p>
        </div>

        {/* Mobile camera preview */}
        <div className="lg:hidden w-full mb-6">
          <div className="relative w-full max-w-sm mx-auto aspect-video rounded-2xl overflow-hidden bg-surface border border-border">
            <video
              ref={setLocalVideoNode}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${videoEnabled ? "scale-x-[-1]" : "hidden"}`}
            />
            {!videoEnabled && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-muted text-sm">Camera off</span>
              </div>
            )}
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto lg:mx-0 w-full">
          {error && (
            <div role="alert" className="mb-4 px-4 py-3 rounded-xl bg-tally-red/10 border border-tally-red/20 text-tally-red text-sm">
              {error}
            </div>
          )}

          <label htmlFor="roomId" className="sr-only">
            Room ID
          </label>
          <input
            id="roomId"
            type="text"
            placeholder="Enter room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            disabled={loading}
            className="w-full px-4 py-3 rounded-xl bg-surface border border-border text-ink placeholder-muted outline-none focus:border-waveform-green/40 focus:bg-surface-highlight transition-all text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          />

          <button
            onClick={handleJoinRoom}
            disabled={loading}
            className="w-full mt-4 py-3 rounded-xl bg-surface-highlight border border-border text-ink font-medium transition-all duration-200 hover:bg-white/[0.06] hover:border-waveform-green/30 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 relative overflow-hidden group"
          >
            <span className="absolute inset-x-0 top-0 h-px bg-waveform-green/0 group-hover:bg-waveform-green/60 transition-colors" />
            Join room
          </button>

          <div className="relative flex items-center gap-4 py-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-muted text-xs font-medium uppercase tracking-wider">
              or
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <button
            onClick={handleCreateRoom}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-transparent border border-border text-ink font-medium transition-all duration-200 hover:bg-white/[0.04] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Create new room
          </button>
        </div>

        {/* Toggles */}
        <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto lg:mx-0 w-full mt-8 lg:mt-0">
          <button
            onClick={toggleVideo}
            disabled={!localStream || loading}
            aria-pressed={videoEnabled}
            aria-label={videoEnabled ? "Turn camera off" : "Turn camera on"}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all duration-200 active:scale-[0.98] disabled:opacity-50 ${
              videoEnabled
                ? "bg-surface border-border text-ink"
                : "bg-tally-red/10 border-tally-red/25 text-tally-red"
            }`}
          >
            {videoEnabled && (
              <span className="w-1.5 h-1.5 rounded-full bg-waveform-green" />
            )}
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
              {videoEnabled ? "Camera on" : "Camera off"}
            </span>
          </button>

          <button
            onClick={toggleAudio}
            disabled={!localStream || loading}
            aria-pressed={audioEnabled}
            aria-label={audioEnabled ? "Mute microphone" : "Unmute microphone"}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all duration-200 active:scale-[0.98] disabled:opacity-50 ${
              audioEnabled
                ? "bg-surface border-border text-ink"
                : "bg-tally-red/10 border-tally-red/25 text-tally-red"
            }`}
          >
            {audioEnabled && (
              <span className="w-1.5 h-1.5 rounded-full bg-waveform-green" />
            )}
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
              {audioEnabled ? "Mic on" : "Mic off"}
            </span>
          </button>
        </div>
      </div>

      {/* Right pane */}
      <div className="hidden lg:flex w-full lg:w-[55%] items-center justify-center p-12 border-l border-border bg-canvas">
        <div className="relative w-full max-w-3xl aspect-video rounded-2xl overflow-hidden bg-surface border border-border">
          <video
            ref={setLocalVideoNode}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${videoEnabled ? "scale-x-[-1]" : "hidden"}`}
          />
          {!videoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-muted text-sm">Camera off</span>
            </div>
          )}
        </div>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div role="status" aria-live="polite" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-canvas/80 backdrop-blur-sm">
          <svg
            className="animate-spin h-8 w-8 text-waveform-green"
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
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-muted text-sm font-medium">Joining...</span>
        </div>
      )}
    </div>
  );
}

export default Home;
