/**
 * SwingAI Pose Engine v2.0 (Browser)
 * MediaPipe Tasks Vision JS를 사용한 포즈 감지 + 골프 지표 계산
 * Python pose_engine.py v4.0을 JS로 이식
 */

const VISIBILITY_THRESHOLD = 0.4;

// MediaPipe Pose 랜드마크 인덱스
const LM = {
  nose: 0,
  left_shoulder: 11, right_shoulder: 12,
  left_elbow: 13, right_elbow: 14,
  left_wrist: 15, right_wrist: 16,
  left_hip: 23, right_hip: 24,
  left_knee: 25, right_knee: 26,
  left_ankle: 27, right_ankle: 28,
  left_ear: 7, right_ear: 8,
};

export class SwingPoseEngine {
  constructor() {
    this.landmarker = null;
    this.isReady = false;
    this._PoseLandmarker = null;
    this._DrawingUtils = null;
  }

  /**
   * MediaPipe Tasks Vision 초기화
   * CDN에서 WASM + 모델을 다운로드
   */
  async init(onProgress) {
    if (onProgress) onProgress('MediaPipe 모듈 로딩 중...');

    // Dynamic import from CDN
    const vision = await import(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs'
    );

    this._PoseLandmarker = vision.PoseLandmarker;
    this._DrawingUtils = vision.DrawingUtils;
    const FilesetResolver = vision.FilesetResolver;

    if (onProgress) onProgress('WASM 파일셋 로딩 중...');

    const filesetResolver = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
    );

    if (onProgress) onProgress('포즈 모델 다운로드 중... (약 30MB)');

    this.landmarker = await this._PoseLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
    });

    this.isReady = true;
    if (onProgress) onProgress('엔진 준비 완료');
  }

  /**
   * 비디오에서 프레임별 포즈 감지
   * @param {HTMLVideoElement} videoElement
   * @param {Object} options
   * @returns {Array} 프레임별 결과 [{landmarks, metrics, frameIndex, time}, ...]
   */
  async analyzeVideo(videoElement, options = {}) {
    const { maxFrames = 90, onProgress, handedness = 'right' } = options;

    const duration = videoElement.duration;
    const totalFrames = Math.min(maxFrames, Math.max(30, Math.floor(duration * 30)));
    const step = duration / totalFrames;

    const results = [];
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');

    // 첫 프레임으로 카메라 뷰 사전 판별을 위한 데이터 수집
    for (let i = 0; i < totalFrames; i++) {
      const time = i * step;

      // Seek to frame
      videoElement.currentTime = time;
      await new Promise((resolve) => {
        const handler = () => {
          videoElement.removeEventListener('seeked', handler);
          resolve();
        };
        videoElement.addEventListener('seeked', handler);
      });

      // Draw frame to canvas
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

      // Detect pose
      const timestamp = Math.round(time * 1000);
      let result;
      try {
        result = this.landmarker.detectForVideo(canvas, timestamp);
      } catch (e) {
        results.push({ landmarks: null, metrics: null, frameIndex: i, time });
        if (onProgress) onProgress(i + 1, totalFrames);
        continue;
      }

      if (result.landmarks && result.landmarks.length > 0) {
        const lm = result.landmarks[0]; // 33 keypoints
        results.push({ landmarks: lm, metrics: null, frameIndex: i, time });
      } else {
        results.push({ landmarks: null, metrics: null, frameIndex: i, time });
      }

      if (onProgress) onProgress(i + 1, totalFrames);
    }

    // 카메라 뷰 감지
    const cameraView = this.detectCameraView(results, handedness);

    // 지표 계산 (카메라 뷰를 알아야 weight_dist 등 계산 가능)
    for (const r of results) {
      if (r.landmarks) {
        r.metrics = this.computeMetrics(r.landmarks, cameraView, handedness);
      }
    }

    return { frames: results, cameraView };
  }

  /**
   * 9개 골프 지표 계산 (Python pose_engine.py compute_golf_metrics 이식)
   */
  computeMetrics(landmarks, cameraView = 'face_on', handedness = 'right') {
    const lm = landmarks;

    // 왼손잡이 처리
    const sideMap = handedness === 'left' ? {
      left_shoulder: 'right_shoulder', right_shoulder: 'left_shoulder',
      left_elbow: 'right_elbow', right_elbow: 'left_elbow',
      left_wrist: 'right_wrist', right_wrist: 'left_wrist',
      left_hip: 'right_hip', right_hip: 'left_hip',
      left_knee: 'right_knee', right_knee: 'left_knee',
      left_ankle: 'right_ankle', right_ankle: 'left_ankle',
    } : null;

    const get = (name) => {
      const mapped = sideMap ? (sideMap[name] || name) : name;
      return lm[LM[mapped]];
    };

    const safe = (p) => p && (p.visibility || 0) > VISIBILITY_THRESHOLD;

    const ls = get('left_shoulder');
    const rs = get('right_shoulder');
    const le = get('left_elbow');
    const lw = get('left_wrist');
    const lh = get('left_hip');
    const rh = get('right_hip');
    const lk = get('left_knee');
    const la = get('left_ankle');

    const metrics = {};

    // Midpoints
    const shoulderMid = (safe(ls) && safe(rs)) ?
      { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 } : null;
    const hipMid = (safe(lh) && safe(rh)) ?
      { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 } : null;

    // 1. Spine Angle
    if (shoulderMid && hipMid) {
      const dx = shoulderMid.x - hipMid.x;
      const dy = shoulderMid.y - hipMid.y;
      metrics.spine_angle_deg = +Math.abs(Math.atan2(Math.abs(dx), Math.abs(dy)) * 180 / Math.PI).toFixed(1);
    } else {
      metrics.spine_angle_deg = null;
    }

    // 2. X-Factor
    const shoulderTiltRaw = (safe(ls) && safe(rs)) ?
      Math.atan2(rs.y - ls.y, rs.x - ls.x) * 180 / Math.PI : null;
    const hipTiltRaw = (safe(lh) && safe(rh)) ?
      Math.atan2(rh.y - lh.y, rh.x - lh.x) * 180 / Math.PI : null;

    if (shoulderTiltRaw !== null && hipTiltRaw !== null) {
      let xf = Math.abs(shoulderTiltRaw - hipTiltRaw);
      if (xf > 90) xf = 180 - xf;
      metrics.x_factor_deg = +xf.toFixed(1);
    } else {
      metrics.x_factor_deg = null;
    }

    // 3. Shoulder Turn
    if (safe(ls) && safe(rs)) {
      const sw = Math.abs(ls.x - rs.x);
      const hw = (safe(lh) && safe(rh)) ? Math.abs(lh.x - rh.x) : sw;
      if (hw > 0.01) {
        const ratio = Math.min(sw / hw, 1.5);
        const turn = Math.acos(Math.max(0, Math.min(1, ratio / 1.15))) * 180 / Math.PI;
        metrics.shoulder_turn_deg = +turn.toFixed(1);
      } else {
        metrics.shoulder_turn_deg = null;
      }
    } else {
      metrics.shoulder_turn_deg = null;
    }

    // 4. Left Arm Angle
    if (safe(ls) && safe(le) && safe(lw)) {
      metrics.left_arm_deg = +this._angle3pts(ls, le, lw).toFixed(1);
    } else {
      metrics.left_arm_deg = null;
    }

    // 5. Left Knee Flex
    if (safe(lh) && safe(lk) && safe(la)) {
      metrics.left_knee_flex_deg = +this._angle3pts(lh, lk, la).toFixed(1);
    } else {
      metrics.left_knee_flex_deg = null;
    }

    // 6. Shoulder Line Tilt
    if (safe(ls) && safe(rs)) {
      const dx = rs.x - ls.x;
      const dy = rs.y - ls.y;
      metrics.shoulder_line_tilt_deg = +(Math.atan2(dy, Math.abs(dx) + 1e-8) * 180 / Math.PI).toFixed(1);
    } else {
      metrics.shoulder_line_tilt_deg = null;
    }

    // 7. Hip Line Tilt
    if (safe(lh) && safe(rh)) {
      const dx = rh.x - lh.x;
      const dy = rh.y - lh.y;
      metrics.hip_line_tilt_deg = +(Math.atan2(dy, Math.abs(dx) + 1e-8) * 180 / Math.PI).toFixed(1);
    } else {
      metrics.hip_line_tilt_deg = null;
    }

    // 8. Lateral Bend
    if (shoulderMid && hipMid) {
      const latOffset = Math.abs(shoulderMid.x - hipMid.x);
      const vertDist = Math.abs(shoulderMid.y - hipMid.y) + 1e-8;
      metrics.lateral_bend_deg = +(Math.atan2(latOffset, vertDist) * 180 / Math.PI).toFixed(1);
    } else {
      metrics.lateral_bend_deg = null;
    }

    // 9. Wrist Height Relative
    if (safe(lw) && safe(la) && shoulderMid) {
      const bodyHeight = Math.abs(shoulderMid.y - la.y) + 1e-8;
      const wristH = Math.abs(shoulderMid.y - lw.y);
      metrics.wrist_height_rel = +(wristH / bodyHeight).toFixed(3);
    } else {
      metrics.wrist_height_rel = null;
    }

    // 10. Weight Distribution (face_on only)
    if (cameraView === 'face_on' && hipMid && safe(lh) && safe(rh)) {
      const totalW = Math.abs(lh.x - rh.x) + 1e-8;
      let wd = (hipMid.x - Math.min(lh.x, rh.x)) / totalW;
      if (handedness === 'left') wd = 1.0 - wd;
      metrics.weight_dist = +wd.toFixed(3);
    } else {
      metrics.weight_dist = null;
    }

    return metrics;
  }

  /**
   * 세 점 사이의 각도 계산
   */
  _angle3pts(a, b, c) {
    const ba = { x: a.x - b.x, y: a.y - b.y };
    const bc = { x: c.x - b.x, y: c.y - b.y };
    const dot = ba.x * bc.x + ba.y * bc.y;
    const magBA = Math.sqrt(ba.x * ba.x + ba.y * ba.y);
    const magBC = Math.sqrt(bc.x * bc.x + bc.y * bc.y);
    const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC + 1e-8)));
    return Math.acos(cosAngle) * 180 / Math.PI;
  }

  /**
   * 카메라 뷰 자동 감지 (어드레스 구간의 몸통 폭으로 판별)
   */
  detectCameraView(results, handedness = 'right') {
    const addressCount = Math.max(1, Math.floor(results.length / 5));
    const widths = [];

    for (let i = 0; i < addressCount; i++) {
      const r = results[i];
      if (!r.landmarks) continue;
      const ls = r.landmarks[LM.left_shoulder];
      const rs = r.landmarks[LM.right_shoulder];
      const lh = r.landmarks[LM.left_hip];
      const rh = r.landmarks[LM.right_hip];

      const safe = (p) => p && (p.visibility || 0) > VISIBILITY_THRESHOLD;
      if (safe(ls) && safe(rs) && safe(lh) && safe(rh)) {
        const sw = Math.abs(ls.x - rs.x);
        const hw = Math.abs(lh.x - rh.x);
        widths.push((sw + hw) / 2);
      }
    }

    if (widths.length === 0) return 'face_on';
    const avg = widths.reduce((a, b) => a + b, 0) / widths.length;
    return avg > 0.12 ? 'face_on' : 'down_the_line';
  }

  /**
   * 클럽 자동 감지
   */
  detectClubType(allMetrics) {
    const wristHeights = allMetrics
      .filter(m => m && m.wrist_height_rel != null)
      .map(m => m.wrist_height_rel);
    const spineAngles = allMetrics
      .filter(m => m && m.spine_angle_deg != null && m.spine_angle_deg > 0)
      .map(m => m.spine_angle_deg);

    const maxWrist = wristHeights.length > 0 ? Math.max(...wristHeights) : 0;
    const avgSpine = spineAngles.length > 0 ?
      spineAngles.reduce((a, b) => a + b, 0) / spineAngles.length : 0;

    console.log(`[클럽 감지] maxWrist: ${maxWrist.toFixed(3)}, avgSpine: ${avgSpine.toFixed(1)}`);

    // 드라이버: 높은 백스윙 + 상체 덜 숙임
    if (maxWrist > 0.7) return 'driver';
    // 퍼터: 매우 낮은 백스윙
    if (maxWrist < 0.15) return 'putter';
    // 나머지는 대부분 아이언 (웨지와 구분 어려움 → 기본 아이언)
    return 'iron';
  }
}
