import { FilesetResolver, HandLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';

export type DetectedGesture = 'none' | 'fist' | 'open_palm';

export interface HandTrackerSession {
  detect: (video: HTMLVideoElement, timestampMs: number) => DetectedGesture;
  dispose: () => void;
}

/**
 * 判断手部关键点是否为“握拳”或“张开手掌”：
 * 计算 4 个指尖（食指8、中指12、无名指16、小指20）到手腕(0)的距离，
 * 并用掌心基础尺度（手腕0到中指根部9的距离）进行归一化，屏蔽远近透视影响。
 */
function classifyHandLandmarks(landmarks: NormalizedLandmark[]): DetectedGesture {
  if (!landmarks || landmarks.length < 21) return 'none';

  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  const palmScale = Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y) || 0.08;

  const fingerTips = [8, 12, 16, 20];
  const fingerPips = [6, 10, 14, 18];

  let extendedCount = 0;
  let curledCount = 0;
  let totalNormalizedDist = 0;

  for (let i = 0; i < fingerTips.length; i++) {
    const tip = landmarks[fingerTips[i]];
    const pip = landmarks[fingerPips[i]];
    const tipDist = Math.hypot(tip.x - wrist.x, tip.y - wrist.y) / palmScale;
    const pipDist = Math.hypot(pip.x - wrist.x, pip.y - wrist.y) / palmScale;
    totalNormalizedDist += tipDist;

    if (tipDist > pipDist * 1.14 && tipDist > 1.45) {
      extendedCount++;
    } else if (tipDist < pipDist * 1.06 || tipDist < 1.18) {
      curledCount++;
    }
  }

  const avgTipDist = totalNormalizedDist / fingerTips.length;

  // 张开手掌：至少3根手指明显伸展且平均指距较大
  if (extendedCount >= 3 && avgTipDist > 1.55) {
    return 'open_palm';
  }
  // 握拳：至少3根手指明显弯曲收拢
  if (curledCount >= 3 && avgTipDist < 1.25) {
    return 'fist';
  }
  return 'none';
}

export async function createHandTracker(): Promise<HandTrackerSession> {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm'
  );

  const handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numHands: 1,
    minHandDetectionConfidence: 0.55,
    minHandPresenceConfidence: 0.55,
    minTrackingConfidence: 0.55,
  });

  let lastStable: DetectedGesture = 'none';
  let candidate: DetectedGesture = 'none';
  let streak = 0;

  return {
    detect: (video: HTMLVideoElement, timestampMs: number) => {
      if (video.readyState < 2) return lastStable;
      const result = handLandmarker.detectForVideo(video, timestampMs);
      const hand = result.landmarks?.[0];
      const raw: DetectedGesture = hand ? classifyHandLandmarks(hand) : 'none';

      // Temporal smoothing (2 frames for immediate responsiveness without flicker)
      if (raw === candidate) {
        streak++;
      } else {
        candidate = raw;
        streak = 1;
      }
      if (streak >= 2) {
        lastStable = candidate;
      }
      return lastStable;
    },
    dispose: () => {
      handLandmarker.close();
    },
  };
}
