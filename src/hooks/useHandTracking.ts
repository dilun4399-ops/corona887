import { useEffect, useRef, useState } from 'react';
import {
  FilesetResolver,
  HandLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';

export interface HandTrackingState {
  active: boolean;
  handDetected: boolean;
  isHandOpen: boolean;
  handX: number; // -1 (left) to +1 (right) in mirrored view
  handY: number; // -1 (bottom) to +1 (top)
}

export interface HandTrackingUiState {
  status: 'idle' | 'starting' | 'active' | 'error';
  handDetected: boolean;
  isHandOpen: boolean;
  errorMessage: string | null;
}

function landmarkDist(a: NormalizedLandmark, b: NormalizedLandmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.hypot(dx, dy, dz);
}

function countExtendedFingers(landmarks: NormalizedLandmark[]): number {
  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  const palmLen = Math.max(landmarkDist(wrist, middleMcp), 0.02);

  let extended = 0;

  // Index (8 vs 6), Middle (12 vs 10), Ring (16 vs 14), Pinky (20 vs 18)
  const fingerPairs: Array<[number, number]> = [
    [8, 6],
    [12, 10],
    [16, 14],
    [20, 18],
  ];

  for (const [tipIdx, pipIdx] of fingerPairs) {
    const tipDist = landmarkDist(landmarks[tipIdx], wrist);
    const pipDist = landmarkDist(landmarks[pipIdx], wrist);
    if (tipDist > pipDist * 1.1 && tipDist > palmLen * 1.12) {
      extended++;
    }
  }

  // Thumb: tip (4) vs IP (3) distance from pinky MCP (17)
  const thumbTipSpread = landmarkDist(landmarks[4], landmarks[17]);
  const thumbIpSpread = landmarkDist(landmarks[3], landmarks[17]);
  if (thumbTipSpread > thumbIpSpread * 1.08 && thumbTipSpread > palmLen * 0.95) {
    extended++;
  }

  return extended;
}

export function useHandTracking(enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const handStateRef = useRef<HandTrackingState>({
    active: false,
    handDetected: false,
    isHandOpen: false,
    handX: 0,
    handY: 0,
  });

  const [uiState, setUiState] = useState<HandTrackingUiState>({
    status: 'idle',
    handDetected: false,
    isHandOpen: false,
    errorMessage: null,
  });

  useEffect(() => {
    if (!enabled) {
      handStateRef.current = {
        active: false,
        handDetected: false,
        isHandOpen: false,
        handX: 0,
        handY: 0,
      };
      setUiState({
        status: 'idle',
        handDetected: false,
        isHandOpen: false,
        errorMessage: null,
      });
      return;
    }

    let cancelled = false;
    let stream: MediaStream | null = null;
    let handLandmarker: HandLandmarker | null = null;
    let rafId = 0;
    let lastVideoTime = -1;
    let lastTimestamp = -1;
    let pendingGestureStreak = 0;
    let lastCandidateOpen = false;
    let committedOpen = false;
    let lastCommittedUiOpen = false;
    let committedDetected = false;

    const cleanup = () => {
      cancelAnimationFrame(rafId);
      if (stream) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        stream = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (handLandmarker) {
        handLandmarker.close();
        handLandmarker = null;
      }
    };

    const startTracking = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setUiState({
          status: 'error',
          handDetected: false,
          isHandOpen: false,
          errorMessage: 'Camera API unavailable in this browser.',
        });
        return;
      }

      setUiState({
        status: 'starting',
        handDetected: false,
        isHandOpen: false,
        errorMessage: null,
      });

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });

        if (cancelled) {
          cleanup();
          return;
        }

        const video = videoRef.current;
        if (!video) {
          cleanup();
          return;
        }

        video.srcObject = stream;
        await video.play();

        const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
        if (cancelled) {
          cleanup();
          return;
        }

        try {
          handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: '/mediapipe/hand_landmarker.task',
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numHands: 2,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
        } catch {
          handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: '/mediapipe/hand_landmarker.task',
              delegate: 'CPU',
            },
            runningMode: 'VIDEO',
            numHands: 2,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
        }

        if (cancelled) {
          cleanup();
          return;
        }

        handStateRef.current.active = true;
        setUiState({
          status: 'active',
          handDetected: false,
          isHandOpen: false,
          errorMessage: null,
        });

        const detectFrame = () => {
          if (cancelled) return;

          const vid = videoRef.current;
          if (vid && handLandmarker && vid.readyState >= 2 && vid.videoWidth > 0) {
            if (vid.currentTime !== lastVideoTime) {
              lastVideoTime = vid.currentTime;
              const now = performance.now();
              const ts = now > lastTimestamp ? now : lastTimestamp + 1;
              lastTimestamp = ts;

              const result = handLandmarker.detectForVideo(vid, ts);
              const hands = result.landmarks;

              if (hands && hands.length > 0) {
                let anyOpen = false;
                let sumX = 0;
                let sumY = 0;

                for (const hand of hands) {
                  const ext = countExtendedFingers(hand);
                  if (ext >= 3) {
                    anyOpen = true;
                  }
                  const palmCenterX = (hand[0].x + hand[9].x) * 0.5;
                  const palmCenterY = (hand[0].y + hand[9].y) * 0.5;
                  sumX += palmCenterX;
                  sumY += palmCenterY;
                }

                // Debounce rapid open/closed flicker by 2 frames
                if (anyOpen === lastCandidateOpen) {
                  pendingGestureStreak++;
                } else {
                  lastCandidateOpen = anyOpen;
                  pendingGestureStreak = 1;
                }

                if (pendingGestureStreak >= 2) {
                  committedOpen = anyOpen;
                }

                const avgX = sumX / hands.length;
                const avgY = sumY / hands.length;
                // Mirror horizontal axis so moving hand right corresponds to +1
                const normX = Math.max(-1, Math.min(1, (1 - avgX) * 2 - 1));
                const normY = Math.max(-1, Math.min(1, (1 - avgY) * 2 - 1));

                handStateRef.current.handDetected = true;
                handStateRef.current.isHandOpen = committedOpen;
                handStateRef.current.handX += (normX - handStateRef.current.handX) * 0.22;
                handStateRef.current.handY += (normY - handStateRef.current.handY) * 0.22;

                if (!committedDetected || committedOpen !== lastCommittedUiOpen) {
                  committedDetected = true;
                  lastCommittedUiOpen = committedOpen;
                  setUiState((prev) => ({
                    ...prev,
                    status: 'active',
                    handDetected: true,
                    isHandOpen: committedOpen,
                  }));
                }
              } else {
                handStateRef.current.handDetected = false;
                handStateRef.current.isHandOpen = false;
                committedOpen = false;
                pendingGestureStreak = 0;

                if (committedDetected || lastCommittedUiOpen) {
                  committedDetected = false;
                  lastCommittedUiOpen = false;
                  setUiState((prev) => ({
                    ...prev,
                    handDetected: false,
                    isHandOpen: false,
                  }));
                }
              }
            }
          }

          rafId = requestAnimationFrame(detectFrame);
        };

        rafId = requestAnimationFrame(detectFrame);
      } catch (err) {
        if (cancelled) return;
        cleanup();
        const message =
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Camera permission denied.'
            : 'Unable to access camera.';
        setUiState({
          status: 'error',
          handDetected: false,
          isHandOpen: false,
          errorMessage: message,
        });
      }
    };

    void startTracking();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [enabled]);

  return { videoRef, handStateRef, uiState };
}
