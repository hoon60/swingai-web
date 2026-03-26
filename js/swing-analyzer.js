/**
 * SwingAI Swing Analyzer v2.0 (Browser)
 * Python pose_engine.py의 classify_phases, compute_tempo, to_relative,
 * check_injury_risks, aggregate_phase_metrics를 JS로 이식
 *
 * 프로 기준값(BASELINES)은 v4.0 MediaPipe 2D 실측값 기반
 */

// ─────────────────────────────────────────────
// Pro Baselines DB (v4.1 — 2026-03-26 MediaPipe 2D 실측값)
// ─────────────────────────────────────────────
export const BASELINES = {
  down_the_line: {
    driver: {
      address: {
        spine_angle_deg:        { mean: 19.4,  std: 3.0 },
        left_knee_flex_deg:     { mean: 167.3, std: 2.0 },
        left_arm_deg:           { mean: 171.0, std: 4.0 },
        x_factor_deg:           { mean: 0.0,   std: 5.0 },
        shoulder_turn_deg:      { mean: 0.0,   std: 5.0 },
        shoulder_line_tilt_deg: { mean: 0.0,   std: 30.0 },
        hip_line_tilt_deg:      { mean: 0.0,   std: 26.0 },
        lateral_bend_deg:       { mean: 19.4,  std: 12.0 },
        wrist_height_rel:       { mean: 0.44,  std: 0.05 },
      },
      backswing_top: {
        spine_angle_deg:        { mean: 18.7,  std: 4.0 },
        left_knee_flex_deg:     { mean: 173.3, std: 3.0 },
        left_arm_deg:           { mean: 177.6, std: 2.0 },
        shoulder_turn_deg:      { mean: 4.0,   std: 6.0 },
        x_factor_deg:           { mean: 10.0,  std: 27.0 },
        wrist_height_rel:       { mean: 0.47,  std: 0.03 },
        shoulder_line_tilt_deg: { mean: 13.0,  std: 31.0 },
        hip_line_tilt_deg:      { mean: 16.0,  std: 20.0 },
        lateral_bend_deg:       { mean: 18.7,  std: 8.0 },
      },
      impact: {
        spine_angle_deg:        { mean: 18.5,  std: 3.0 },
        left_arm_deg:           { mean: 173.0, std: 5.0 },
        left_knee_flex_deg:     { mean: 165.0, std: 7.0 },
        shoulder_line_tilt_deg: { mean: -5.0,  std: 43.0 },
        hip_line_tilt_deg:      { mean: 11.0,  std: 34.0 },
        lateral_bend_deg:       { mean: 18.5,  std: 11.0 },
        x_factor_deg:           { mean: 19.0,  std: 14.0 },
        shoulder_turn_deg:      { mean: 17.0,  std: 24.0 },
        wrist_height_rel:       { mean: 0.39,  std: 0.06 },
      },
    },
    iron: {
      address: {
        spine_angle_deg:        { mean: 21.0,  std: 3.0 },
        left_knee_flex_deg:     { mean: 176.0, std: 3.0 },
        left_arm_deg:           { mean: 177.0, std: 2.0 },
        x_factor_deg:           { mean: 0.0,   std: 2.0 },
        shoulder_turn_deg:      { mean: 0.0,   std: 2.0 },
        shoulder_line_tilt_deg: { mean: 0.0,   std: 3.0 },
        hip_line_tilt_deg:      { mean: 0.0,   std: 2.0 },
        lateral_bend_deg:       { mean: 3.0,   std: 3.0 },
        wrist_height_rel:       { mean: 0.42,  std: 0.08 },
      },
      backswing_top: {
        spine_angle_deg:        { mean: 20.0,  std: 4.0 },
        left_knee_flex_deg:     { mean: 173.3, std: 3.0 },
        left_arm_deg:           { mean: 177.6, std: 2.0 },
        shoulder_turn_deg:      { mean: 4.0,   std: 6.0 },
        x_factor_deg:           { mean: 10.0,  std: 27.0 },
        wrist_height_rel:       { mean: 0.45,  std: 0.04 },
        shoulder_line_tilt_deg: { mean: 13.0,  std: 31.0 },
        hip_line_tilt_deg:      { mean: 16.0,  std: 20.0 },
        lateral_bend_deg:       { mean: 20.0,  std: 8.0 },
      },
      impact: {
        spine_angle_deg:        { mean: 20.0,  std: 3.0 },
        left_arm_deg:           { mean: 173.0, std: 5.0 },
        left_knee_flex_deg:     { mean: 165.0, std: 7.0 },
        shoulder_line_tilt_deg: { mean: -5.0,  std: 43.0 },
        hip_line_tilt_deg:      { mean: 11.0,  std: 34.0 },
        lateral_bend_deg:       { mean: 20.0,  std: 11.0 },
        x_factor_deg:           { mean: 19.0,  std: 14.0 },
        shoulder_turn_deg:      { mean: 17.0,  std: 24.0 },
        wrist_height_rel:       { mean: 0.38,  std: 0.06 },
      },
    },
    wedge: {
      address: {
        spine_angle_deg: { mean: 24.0, std: 6.0 }, left_knee_flex_deg: { mean: 176.0, std: 3.0 },
        left_arm_deg: { mean: 177.0, std: 2.0 }, x_factor_deg: { mean: 0.0, std: 2.0 },
        shoulder_turn_deg: { mean: 0.0, std: 2.0 }, shoulder_line_tilt_deg: { mean: 0.0, std: 3.0 },
        hip_line_tilt_deg: { mean: 0.0, std: 2.0 }, lateral_bend_deg: { mean: 3.0, std: 3.0 },
        wrist_height_rel: { mean: 0.40, std: 0.08 },
      },
      backswing_top: {
        spine_angle_deg: { mean: 15.0, std: 6.0 }, left_knee_flex_deg: { mean: 177.0, std: 3.0 },
        left_arm_deg: { mean: 176.0, std: 5.0 }, shoulder_turn_deg: { mean: 75.0, std: 8.0 },
        x_factor_deg: { mean: 35.0, std: 5.0 }, wrist_height_rel: { mean: 0.42, std: 0.10 },
        shoulder_line_tilt_deg: { mean: -8.0, std: 6.0 }, hip_line_tilt_deg: { mean: -2.0, std: 2.0 },
        lateral_bend_deg: { mean: 4.0, std: 3.0 },
      },
      impact: {
        spine_angle_deg: { mean: 24.0, std: 6.0 }, left_knee_flex_deg: { mean: 176.0, std: 3.0 },
        left_arm_deg: { mean: 176.0, std: 4.0 }, shoulder_line_tilt_deg: { mean: -3.0, std: 4.0 },
        hip_line_tilt_deg: { mean: -2.0, std: 2.0 }, lateral_bend_deg: { mean: 5.0, std: 3.0 },
        x_factor_deg: { mean: 18.0, std: 5.0 }, shoulder_turn_deg: { mean: 28.0, std: 6.0 },
        wrist_height_rel: { mean: 0.38, std: 0.08 },
      },
    },
    putter: {
      address: {
        spine_angle_deg: { mean: 28.0, std: 6.0 }, left_knee_flex_deg: { mean: 178.0, std: 2.0 },
        left_arm_deg: { mean: 178.0, std: 2.0 }, x_factor_deg: { mean: 0.0, std: 1.0 },
        shoulder_turn_deg: { mean: 0.0, std: 1.0 }, shoulder_line_tilt_deg: { mean: 0.0, std: 2.0 },
        hip_line_tilt_deg: { mean: 0.0, std: 1.0 }, lateral_bend_deg: { mean: 1.0, std: 2.0 },
        wrist_height_rel: { mean: 0.40, std: 0.05 },
      },
      backswing_top: {
        spine_angle_deg: { mean: 28.0, std: 6.0 }, left_knee_flex_deg: { mean: 178.0, std: 2.0 },
        left_arm_deg: { mean: 178.0, std: 2.0 }, shoulder_turn_deg: { mean: 10.0, std: 5.0 },
        x_factor_deg: { mean: 5.0, std: 3.0 }, wrist_height_rel: { mean: 0.38, std: 0.05 },
        shoulder_line_tilt_deg: { mean: -3.0, std: 3.0 }, hip_line_tilt_deg: { mean: 0.0, std: 1.0 },
        lateral_bend_deg: { mean: 2.0, std: 2.0 },
      },
      impact: {
        spine_angle_deg: { mean: 28.0, std: 6.0 }, left_knee_flex_deg: { mean: 178.0, std: 2.0 },
        left_arm_deg: { mean: 178.0, std: 2.0 }, shoulder_line_tilt_deg: { mean: 0.0, std: 2.0 },
        hip_line_tilt_deg: { mean: 0.0, std: 1.0 }, lateral_bend_deg: { mean: 1.0, std: 2.0 },
        x_factor_deg: { mean: 3.0, std: 2.0 }, shoulder_turn_deg: { mean: 5.0, std: 3.0 },
        wrist_height_rel: { mean: 0.38, std: 0.05 },
      },
    },
  },
  face_on: {
    driver: {
      address: {
        spine_angle_deg: { mean: 2.8, std: 2.0 }, left_knee_flex_deg: { mean: 178.4, std: 2.0 },
        left_arm_deg: { mean: 176.9, std: 3.0 }, weight_dist: { mean: 0.50, std: 0.03 },
        x_factor_deg: { mean: 0.0, std: 2.0 }, shoulder_turn_deg: { mean: 0.0, std: 2.0 },
        shoulder_line_tilt_deg: { mean: 0.0, std: 15.0 }, hip_line_tilt_deg: { mean: 0.0, std: 8.0 },
        lateral_bend_deg: { mean: 2.0, std: 3.0 }, wrist_height_rel: { mean: 0.42, std: 0.08 },
      },
      backswing_top: {
        spine_angle_deg: { mean: 6.2, std: 3.0 }, left_knee_flex_deg: { mean: 175.0, std: 7.0 },
        left_arm_deg: { mean: 173.3, std: 6.0 }, shoulder_turn_deg: { mean: 89.0, std: 8.0 },
        x_factor_deg: { mean: 46.0, std: 5.0 }, weight_dist: { mean: 0.50, std: 0.05 },
        wrist_height_rel: { mean: 0.43, std: 0.08 }, shoulder_line_tilt_deg: { mean: -10.0, std: 15.0 },
        hip_line_tilt_deg: { mean: -2.0, std: 8.0 }, lateral_bend_deg: { mean: 5.0, std: 4.0 },
      },
      impact: {
        spine_angle_deg: { mean: 6.4, std: 4.0 }, left_arm_deg: { mean: 174.0, std: 8.0 },
        left_knee_flex_deg: { mean: 178.0, std: 2.0 }, shoulder_line_tilt_deg: { mean: -5.0, std: 12.0 },
        hip_line_tilt_deg: { mean: -3.0, std: 8.0 }, lateral_bend_deg: { mean: 4.0, std: 4.0 },
        weight_dist: { mean: 0.50, std: 0.05 }, x_factor_deg: { mean: 25.0, std: 6.0 },
        shoulder_turn_deg: { mean: 35.0, std: 6.0 }, wrist_height_rel: { mean: 0.42, std: 0.08 },
      },
    },
    iron: {
      address: {
        spine_angle_deg: { mean: 5.0, std: 1.5 }, left_knee_flex_deg: { mean: 178.5, std: 2.0 },
        left_arm_deg: { mean: 177.0, std: 2.0 }, weight_dist: { mean: 0.52, std: 0.03 },
        x_factor_deg: { mean: 0.0, std: 2.0 }, shoulder_turn_deg: { mean: 0.0, std: 2.0 },
        shoulder_line_tilt_deg: { mean: 0.0, std: 15.0 }, hip_line_tilt_deg: { mean: 0.0, std: 8.0 },
        lateral_bend_deg: { mean: 2.0, std: 3.0 }, wrist_height_rel: { mean: 0.40, std: 0.08 },
      },
      backswing_top: {
        spine_angle_deg: { mean: 5.0, std: 1.5 }, left_knee_flex_deg: { mean: 178.0, std: 2.5 },
        left_arm_deg: { mean: 176.0, std: 3.0 }, shoulder_turn_deg: { mean: 90.0, std: 7.0 },
        x_factor_deg: { mean: 45.0, std: 5.0 }, weight_dist: { mean: 0.52, std: 0.05 },
        wrist_height_rel: { mean: 0.42, std: 0.08 }, shoulder_line_tilt_deg: { mean: -10.0, std: 15.0 },
        hip_line_tilt_deg: { mean: -2.0, std: 8.0 }, lateral_bend_deg: { mean: 5.0, std: 4.0 },
      },
      impact: {
        spine_angle_deg: { mean: 5.0, std: 1.5 }, left_arm_deg: { mean: 177.5, std: 2.0 },
        left_knee_flex_deg: { mean: 178.0, std: 2.0 }, shoulder_line_tilt_deg: { mean: -5.0, std: 12.0 },
        hip_line_tilt_deg: { mean: -3.0, std: 8.0 }, lateral_bend_deg: { mean: 4.0, std: 4.0 },
        weight_dist: { mean: 0.78, std: 0.05 }, x_factor_deg: { mean: 22.0, std: 6.0 },
        shoulder_turn_deg: { mean: 33.0, std: 6.0 }, wrist_height_rel: { mean: 0.38, std: 0.08 },
      },
    },
    wedge: {
      address: {
        spine_angle_deg: { mean: 5.5, std: 1.5 }, left_knee_flex_deg: { mean: 178.5, std: 2.0 },
        left_arm_deg: { mean: 177.0, std: 2.0 }, weight_dist: { mean: 0.55, std: 0.03 },
        x_factor_deg: { mean: 0.0, std: 2.0 }, shoulder_turn_deg: { mean: 0.0, std: 2.0 },
        shoulder_line_tilt_deg: { mean: 0.0, std: 15.0 }, hip_line_tilt_deg: { mean: 0.0, std: 8.0 },
        lateral_bend_deg: { mean: 2.0, std: 3.0 }, wrist_height_rel: { mean: 0.40, std: 0.08 },
      },
      backswing_top: {
        spine_angle_deg: { mean: 5.5, std: 1.5 }, left_knee_flex_deg: { mean: 178.5, std: 2.0 },
        left_arm_deg: { mean: 176.0, std: 4.0 }, shoulder_turn_deg: { mean: 75.0, std: 8.0 },
        x_factor_deg: { mean: 35.0, std: 5.0 }, weight_dist: { mean: 0.55, std: 0.05 },
        wrist_height_rel: { mean: 0.40, std: 0.10 }, shoulder_line_tilt_deg: { mean: -8.0, std: 12.0 },
        hip_line_tilt_deg: { mean: -2.0, std: 6.0 }, lateral_bend_deg: { mean: 4.0, std: 3.0 },
      },
      impact: {
        spine_angle_deg: { mean: 5.5, std: 1.5 }, left_knee_flex_deg: { mean: 178.5, std: 2.0 },
        left_arm_deg: { mean: 177.0, std: 3.0 }, shoulder_line_tilt_deg: { mean: -3.0, std: 10.0 },
        hip_line_tilt_deg: { mean: -2.0, std: 6.0 }, lateral_bend_deg: { mean: 3.0, std: 3.0 },
        weight_dist: { mean: 0.80, std: 0.05 }, x_factor_deg: { mean: 18.0, std: 5.0 },
        shoulder_turn_deg: { mean: 28.0, std: 6.0 }, wrist_height_rel: { mean: 0.38, std: 0.08 },
      },
    },
    putter: {
      address: {
        spine_angle_deg: { mean: 6.0, std: 2.0 }, left_knee_flex_deg: { mean: 179.0, std: 1.5 },
        left_arm_deg: { mean: 178.0, std: 2.0 }, weight_dist: { mean: 0.50, std: 0.02 },
        x_factor_deg: { mean: 0.0, std: 1.0 }, shoulder_turn_deg: { mean: 0.0, std: 1.0 },
        shoulder_line_tilt_deg: { mean: 0.0, std: 10.0 }, hip_line_tilt_deg: { mean: 0.0, std: 5.0 },
        lateral_bend_deg: { mean: 1.0, std: 2.0 }, wrist_height_rel: { mean: 0.38, std: 0.05 },
      },
      backswing_top: {
        spine_angle_deg: { mean: 6.0, std: 2.0 }, left_knee_flex_deg: { mean: 179.0, std: 1.5 },
        left_arm_deg: { mean: 178.0, std: 2.0 }, shoulder_turn_deg: { mean: 10.0, std: 5.0 },
        x_factor_deg: { mean: 5.0, std: 3.0 }, weight_dist: { mean: 0.50, std: 0.02 },
        wrist_height_rel: { mean: 0.36, std: 0.05 }, shoulder_line_tilt_deg: { mean: -3.0, std: 8.0 },
        hip_line_tilt_deg: { mean: 0.0, std: 5.0 }, lateral_bend_deg: { mean: 2.0, std: 2.0 },
      },
      impact: {
        spine_angle_deg: { mean: 6.0, std: 2.0 }, left_knee_flex_deg: { mean: 179.0, std: 1.5 },
        left_arm_deg: { mean: 178.0, std: 2.0 }, shoulder_line_tilt_deg: { mean: 0.0, std: 8.0 },
        hip_line_tilt_deg: { mean: 0.0, std: 5.0 }, lateral_bend_deg: { mean: 1.0, std: 2.0 },
        weight_dist: { mean: 0.50, std: 0.02 }, x_factor_deg: { mean: 3.0, std: 2.0 },
        shoulder_turn_deg: { mean: 5.0, std: 3.0 }, wrist_height_rel: { mean: 0.36, std: 0.05 },
      },
    },
  },
};

// ─────────────────────────────────────────────
// 지표별 맞춤 z-score 임계점 (v4.0)
// ─────────────────────────────────────────────
const METRIC_THRESHOLDS = {
  spine_angle_deg:        [1.5, 3.0],
  left_arm_deg:           [1.5, 3.0],
  left_knee_flex_deg:     [1.5, 3.0],
  wrist_height_rel:       [2.0, 4.0],
  weight_dist:            [1.5, 3.0],
  x_factor_deg:           [1.5, 3.0],
  shoulder_turn_deg:      [1.5, 3.0],
  lateral_bend_deg:       [2.0, 4.0],
  shoulder_line_tilt_deg: [2.0, 4.0],
  hip_line_tilt_deg:      [2.0, 4.0],
};
const DEFAULT_THRESHOLDS = [1.5, 3.0];

// 카메라 뷰별 신뢰도 높은 지표
const RELIABLE_METRICS = {
  face_on: {
    address:        ['spine_angle_deg', 'left_arm_deg', 'left_knee_flex_deg', 'weight_dist', 'wrist_height_rel'],
    backswing_top:  ['spine_angle_deg', 'left_arm_deg', 'left_knee_flex_deg', 'wrist_height_rel', 'weight_dist'],
    impact:         ['spine_angle_deg', 'left_arm_deg', 'left_knee_flex_deg', 'weight_dist', 'wrist_height_rel'],
  },
  down_the_line: {
    address:        ['left_arm_deg', 'left_knee_flex_deg', 'wrist_height_rel'],
    backswing_top:  ['left_arm_deg', 'left_knee_flex_deg', 'wrist_height_rel'],
    impact:         ['left_arm_deg', 'left_knee_flex_deg', 'wrist_height_rel'],
  },
};

// 고민별 우선 지표
export const CONCERN_PRIORITY = {
  distance:     ['x_factor_deg', 'shoulder_turn_deg', 'wrist_height_rel', 'left_knee_flex_deg', 'weight_dist'],
  slice:        ['shoulder_line_tilt_deg', 'hip_line_tilt_deg', 'lateral_bend_deg', 'weight_dist', 'x_factor_deg'],
  hook:         ['lateral_bend_deg', 'shoulder_line_tilt_deg', 'hip_line_tilt_deg', 'weight_dist', 'left_arm_deg'],
  accuracy:     ['shoulder_line_tilt_deg', 'spine_angle_deg', 'hip_line_tilt_deg', 'left_arm_deg', 'weight_dist'],
  iron_contact: ['spine_angle_deg', 'left_arm_deg', 'weight_dist', 'left_knee_flex_deg', 'lateral_bend_deg'],
  short_game:   ['left_arm_deg', 'wrist_height_rel', 'spine_angle_deg', 'weight_dist', 'shoulder_turn_deg'],
  putting:      ['spine_angle_deg', 'shoulder_line_tilt_deg', 'left_arm_deg', 'weight_dist', 'shoulder_turn_deg'],
  consistency:  ['spine_angle_deg', 'x_factor_deg', 'left_arm_deg', 'left_knee_flex_deg'],
};

// 고민별 한국어 이름
export const CONCERN_KR = {
  distance: '비거리 향상', slice: '슬라이스 교정', hook: '훅 교정',
  accuracy: '방향성 개선', iron_contact: '아이언 미스샷', short_game: '쇼트게임',
  putting: '퍼팅', consistency: '일관성',
};

// 부상 위험 임계값
const INJURY_THRESHOLDS = {
  lateral_bend_deg: {
    threshold: 20.0, direction: 'above', severity: 'high',
    message: '허리 측면 굽힘이 과도합니다. 추간판 부상 위험이 있습니다.',
  },
  left_knee_flex_deg: {
    threshold: 178.0, direction: 'above', severity: 'high',
    message: '왼쪽 무릎이 과도하게 펴져 있습니다. 인대 부상 위험이 있습니다.',
  },
  spine_angle_deg: {
    threshold: 50.0, direction: 'above', severity: 'medium',
    message: '허리 굽힘이 과도합니다. 하부 요통 위험이 있습니다.',
  },
};

// PGA 평균 템포 기준값
const TEMPO_BASELINES = {
  backswing_sec: 0.847,
  downswing_sec: 0.250,
  ratio_target: 3.0,
};

// 지표 한국어 이름
export const METRIC_NAMES_KR = {
  spine_angle_deg: '척추 각도',
  left_arm_deg: '왼팔 직선도',
  left_knee_flex_deg: '무릎 각도',
  x_factor_deg: 'X-Factor',
  shoulder_turn_deg: '어깨 회전',
  wrist_height_rel: '손목 높이',
  weight_dist: '체중 분배',
  shoulder_line_tilt_deg: '어깨 기울기',
  hip_line_tilt_deg: '힙 기울기',
  lateral_bend_deg: '측면 굽힘',
};

// ─────────────────────────────────────────────
// Main Analyzer Class
// ─────────────────────────────────────────────
export class SwingAnalyzer {

  /**
   * 스윙 6단계 자동 분류
   */
  classifyPhases(allMetrics, fps = 30) {
    const n = allMetrics.length;
    if (n === 0) return [];

    const xFactors = allMetrics.map(m => (m && m.x_factor_deg) || 0);
    const wristHeights = allMetrics.map(m => (m && m.wrist_height_rel) || 0);

    // 임팩트 프레임: wrist_height 차분 최대 지점
    let impactIdx = null;
    const whDiff = [];
    for (let i = 1; i < n; i++) {
      whDiff.push(Math.abs(wristHeights[i] - wristHeights[i - 1]));
    }
    if (whDiff.length > 0 && Math.max(...whDiff) > 1e-6) {
      impactIdx = whDiff.indexOf(Math.max(...whDiff)) + 1;
    }
    if (impactIdx === null) {
      impactIdx = Math.floor(n * 0.6);
    }
    impactIdx = Math.max(Math.floor(n * 0.3), Math.min(impactIdx, Math.floor(n * 0.85)));

    // backswing_top: 임팩트 전 wrist_height 최대 지점
    let topIdx;
    if (impactIdx > 2) {
      const preImpact = wristHeights.slice(0, impactIdx);
      topIdx = preImpact.indexOf(Math.max(...preImpact));
    } else {
      topIdx = Math.floor(n * 0.4);
    }
    if (topIdx >= impactIdx) {
      topIdx = Math.max(1, impactIdx - Math.max(2, Math.floor(n * 0.05)));
    }

    // 단계 할당
    const phases = [];
    for (let i = 0; i < n; i++) {
      if (i <= Math.max(1, Math.floor(n * 0.08))) {
        phases.push('address');
      } else if (i < topIdx * 0.4) {
        phases.push('takeaway');
      } else if (i < topIdx * 0.85) {
        phases.push('backswing');
      } else if (i <= topIdx + 1) {
        phases.push('backswing_top');
      } else if (i < impactIdx) {
        phases.push('downswing');
      } else if (i <= impactIdx + Math.max(1, Math.floor(n * 0.03))) {
        phases.push('impact');
      } else {
        phases.push('follow_through');
      }
    }
    return phases;
  }

  /**
   * 템포/리듬 분석
   */
  computeTempo(phases, fps = 30) {
    if (!phases || phases.length === 0) {
      return { backswing_sec: null, downswing_sec: null, tempo_ratio: null, tempo_rating: null };
    }

    const backswingPhases = new Set(['takeaway', 'backswing', 'backswing_top']);
    const downswingPhases = new Set(['downswing', 'impact']);

    let bsFrames = 0, dsFrames = 0;
    for (const p of phases) {
      if (backswingPhases.has(p)) bsFrames++;
      else if (downswingPhases.has(p)) dsFrames++;
    }

    const frameDur = 1.0 / (fps || 30);
    const bsSec = +(bsFrames * frameDur).toFixed(3);
    const dsSec = +(dsFrames * frameDur).toFixed(3);

    let ratio = dsSec > 0 ? +(bsSec / dsSec).toFixed(2) : null;

    // 비현실적 값 필터링
    if (ratio !== null && (ratio < 1.0 || ratio > 8.0)) ratio = null;
    if (bsSec < 0.2 || dsSec < 0.05) ratio = null;

    let rating = null;
    if (ratio !== null) {
      if (ratio >= 2.5 && ratio <= 3.5) rating = 'excellent';
      else if (ratio >= 2.0 && ratio <= 4.0) rating = 'good';
      else if (ratio >= 1.5 && ratio <= 5.0) rating = 'needs_work';
      else rating = 'unreliable';
    }

    return {
      backswing_sec: bsSec,
      downswing_sec: dsSec,
      tempo_ratio: ratio,
      total_swing_sec: +(bsSec + dsSec).toFixed(3),
      tempo_rating: rating,
      pga_avg_ratio: TEMPO_BASELINES.ratio_target,
    };
  }

  /**
   * 단계별 지표 집계 (평균, std, count)
   */
  aggregatePhaseMetrics(allMetrics, phases) {
    const phaseData = {};

    for (let i = 0; i < allMetrics.length; i++) {
      const phase = phases[i];
      const m = allMetrics[i];
      if (!m || !phase) continue;

      if (!phaseData[phase]) phaseData[phase] = {};

      for (const [key, val] of Object.entries(m)) {
        if (val === null || val === undefined || key === 'weight_dist_confidence') continue;
        if (!phaseData[phase][key]) phaseData[phase][key] = [];
        phaseData[phase][key].push(val);
      }
    }

    // 평균/std/count 계산
    const result = {};
    for (const [phase, metrics] of Object.entries(phaseData)) {
      result[phase] = {};
      for (const [key, values] of Object.entries(metrics)) {
        if (values.length === 0) continue;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
        result[phase][key] = {
          mean: +mean.toFixed(3),
          std: +Math.sqrt(variance).toFixed(3),
          count: values.length,
        };
      }
    }
    return result;
  }

  /**
   * 절대값 → 프로 대비 상대값 변환
   */
  toRelative(metrics, cameraView, club, phase) {
    const baseline = (BASELINES[cameraView] || {})[club]?.[phase] || {};
    const reliable = (RELIABLE_METRICS[cameraView] || {})[phase] || [];
    const relative = {};

    for (const [key, rawVal] of Object.entries(metrics)) {
      if (rawVal === null || rawVal === undefined || key === 'weight_dist_confidence') continue;
      const value = (typeof rawVal === 'object' && rawVal.mean !== undefined) ? rawVal.mean : rawVal;
      if (value === null || value === undefined) continue;

      // 신뢰도 낮은 지표 건너뜀
      if (reliable.length > 0 && !reliable.includes(key)) {
        relative[key] = {
          value, diff_pct: null, status: '2D_limited', z_score: null,
          note: '이 카메라 각도에서는 정확한 측정이 어렵습니다',
        };
        continue;
      }

      const bl = baseline[key];
      if (!bl) {
        relative[key] = { value, diff_pct: null, status: 'no_baseline', z_score: null };
        continue;
      }

      const { mean, std } = bl;
      let diffPct;
      if (Math.abs(mean) < 3.0) {
        diffPct = +(value - mean).toFixed(1);
      } else {
        diffPct = +(((value - mean) / Math.abs(mean)) * 100).toFixed(1);
      }

      const zScore = std > 0 ? +((value - mean) / std).toFixed(2) : null;

      let status = 'unknown';
      let direction = null;
      if (zScore !== null) {
        const [normalZ, warningZ] = METRIC_THRESHOLDS[key] || DEFAULT_THRESHOLDS;
        const absZ = Math.abs(zScore);
        if (absZ <= normalZ) status = 'normal';
        else if (absZ <= warningZ) status = 'caution';
        else status = 'warning';
        direction = zScore < 0 ? 'below' : 'above';
      }

      // 비현실적 수치 필터링
      if (Math.abs(diffPct) > 80 || (zScore !== null && Math.abs(zScore) > 8)) {
        relative[key] = {
          value, pro_mean: mean, pro_std: std, diff_pct: null,
          status: 'unreliable', z_score: zScore, direction,
          note: '2D 영상에서 정확한 분석이 어렵습니다',
        };
      } else {
        relative[key] = {
          value, pro_mean: mean, pro_std: std, diff_pct: diffPct,
          status, z_score: zScore, direction,
        };
      }
    }
    return relative;
  }

  /**
   * 부상 위험 체크
   */
  checkInjuryRisks(phaseAverages) {
    const warnings = [];
    for (const [phaseName, metrics] of Object.entries(phaseAverages)) {
      for (const [metricName, threshInfo] of Object.entries(INJURY_THRESHOLDS)) {
        const rawVal = metrics[metricName];
        if (!rawVal) continue;
        const value = (typeof rawVal === 'object') ? rawVal.mean : rawVal;
        if (value === null || value === undefined) continue;

        let exceeded = false;
        if (threshInfo.direction === 'above' && value > threshInfo.threshold) exceeded = true;
        if (threshInfo.direction === 'below' && value < threshInfo.threshold) exceeded = true;

        if (exceeded) {
          warnings.push({
            phase: phaseName,
            metric: metricName,
            value,
            threshold: threshInfo.threshold,
            severity: threshInfo.severity,
            message: threshInfo.message,
          });
        }
      }
    }
    // 심각도순 정렬
    const severityOrder = { high: 0, medium: 1, low: 2 };
    warnings.sort((a, b) => (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99));
    return warnings;
  }

  /**
   * 유저 레벨 자동 판별
   */
  detectUserLevel(relativeMetrics) {
    const allDiffs = [];
    const allStatuses = [];

    for (const [phase, metrics] of Object.entries(relativeMetrics)) {
      for (const [key, info] of Object.entries(metrics)) {
        const st = info.status;
        if (['unreliable', '2D_limited', 'no_baseline', 'unknown'].includes(st)) continue;
        if (info.diff_pct !== null) allDiffs.push(Math.abs(info.diff_pct));
        if (st) allStatuses.push(st);
      }
    }

    if (allDiffs.length === 0) {
      return { level: 'intermediate', level_kr: '중급', avg_diff_pct: null, reason: '데이터 부족' };
    }

    const avgDiff = allDiffs.reduce((a, b) => a + b, 0) / allDiffs.length;
    const normalCount = allStatuses.filter(s => s === 'normal').length;
    const warningCount = allStatuses.filter(s => s === 'warning' || s === 'caution').length;
    const total = allStatuses.length;

    let level, levelKr;
    if (avgDiff >= 50 || (warningCount / Math.max(total, 1)) > 0.6) {
      level = 'beginner'; levelKr = '입문';
    } else if (avgDiff >= 20 || (warningCount / Math.max(total, 1)) > 0.3) {
      level = 'intermediate'; levelKr = '중급';
    } else {
      level = 'advanced'; levelKr = '상급';
    }

    return {
      level, level_kr: levelKr,
      avg_diff_pct: +avgDiff.toFixed(1),
      normal_count: normalCount,
      total_metrics: total,
    };
  }

  /**
   * 종합 점수 계산 (0~100)
   */
  computeOverallScore(relativeMetrics) {
    let scores = [];
    for (const [phase, metrics] of Object.entries(relativeMetrics)) {
      for (const [key, info] of Object.entries(metrics)) {
        if (info.z_score === null || ['unreliable', '2D_limited', 'no_baseline'].includes(info.status)) continue;
        // z-score 0 = 100점, z-score 3+ = 0점
        const s = Math.max(0, Math.min(100, 100 - Math.abs(info.z_score) * 33));
        scores.push(s);
      }
    }
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  /**
   * 전체 분석 파이프라인 실행
   */
  analyze(frames, cameraView, options = {}) {
    const { club = 'driver', handedness = 'right', concern = 'distance' } = options;
    const fps = 30;

    const allMetrics = frames.map(f => f.metrics);
    const detectedClub = frames[0]?.metrics ?
      this._detectClubFromMetrics(allMetrics) : club;

    // 단계 분류
    const phases = this.classifyPhases(allMetrics, fps);

    // 템포 분석
    const tempo = this.computeTempo(phases, fps);

    // 단계별 집계
    const phaseAverages = this.aggregatePhaseMetrics(allMetrics, phases);

    // 상대값 변환 (주요 3단계만)
    const relativeMetrics = {};
    for (const phase of ['address', 'backswing_top', 'impact']) {
      if (phaseAverages[phase]) {
        relativeMetrics[phase] = this.toRelative(
          phaseAverages[phase], cameraView, detectedClub, phase
        );
      }
    }

    // 부상 위험
    const injuries = this.checkInjuryRisks(phaseAverages);

    // 유저 레벨
    const userLevel = this.detectUserLevel(relativeMetrics);

    // 종합 점수
    const overallScore = this.computeOverallScore(relativeMetrics);

    // 개인 베이스라인 비교
    const personalBaseline = this.computePersonalBaseline(relativeMetrics);

    // 감지율
    const detectedCount = frames.filter(f => f.landmarks !== null).length;
    const detectionRate = +((detectedCount / frames.length) * 100).toFixed(1);

    // 핵심 프레임의 landmarks 저장 (스켈레톤 오버레이용)
    const keyFrameLandmarks = {};
    const phaseFrameMap = {};
    for (let i = 0; i < phases.length; i++) {
      const p = phases[i];
      if (['address', 'backswing_top', 'impact'].includes(p) && !phaseFrameMap[p]) {
        if (frames[i] && frames[i].landmarks) {
          phaseFrameMap[p] = i;
          keyFrameLandmarks[p] = {
            landmarks: frames[i].landmarks,
            frameIndex: frames[i].frameIndex,
            time: frames[i].time,
          };
        }
      }
    }

    return {
      metadata: {
        club: detectedClub,
        concern,
        concern_kr: CONCERN_KR[concern],
        handedness,
        camera_view: cameraView,
        detection_rate_pct: detectionRate,
        total_frames: frames.length,
      },
      phases,
      tempo,
      phase_averages: phaseAverages,
      relative_metrics: relativeMetrics,
      personal_baseline: personalBaseline,
      injuries,
      user_level: userLevel,
      overall_score: overallScore,
      key_frame_landmarks: keyFrameLandmarks,
    };
  }

  /**
   * 개인 베이스라인 대비 비교 계산
   * localStorage에 저장된 이전 분석들의 지표 평균과 현재 결과를 비교
   * @returns {Object} phase -> metric -> { prevAvg, direction, diffPct }
   */
  computePersonalBaseline(relativeMetrics) {
    const comparison = {};
    try {
      const raw = localStorage.getItem('swingai_history');
      if (!raw) return comparison;
      const history = JSON.parse(raw);
      if (!Array.isArray(history) || history.length === 0) return comparison;

      // 이전 분석들의 keyMetrics를 수집해서 평균 계산
      const metricSums = {};
      const metricCounts = {};
      for (const entry of history) {
        if (!entry.keyMetrics) continue;
        for (const [key, val] of Object.entries(entry.keyMetrics)) {
          if (val == null) continue;
          if (!metricSums[key]) { metricSums[key] = 0; metricCounts[key] = 0; }
          metricSums[key] += val;
          metricCounts[key]++;
        }
      }

      const prevBaseline = {};
      for (const key of Object.keys(metricSums)) {
        prevBaseline[key] = metricSums[key] / metricCounts[key];
      }

      // 현재 결과와 비교
      for (const [phase, metrics] of Object.entries(relativeMetrics)) {
        comparison[phase] = {};
        for (const [key, info] of Object.entries(metrics)) {
          if (info.value == null || prevBaseline[key] == null) continue;
          if (['unreliable', '2D_limited', 'no_baseline'].includes(info.status)) continue;

          const prevAvg = prevBaseline[key];
          const currentVal = info.value;
          const proMean = info.pro_mean;

          // 프로 평균 대비 거리가 줄었으면 개선, 늘었으면 악화
          let direction = 'same'; // →유지
          if (proMean != null) {
            const prevDist = Math.abs(prevAvg - proMean);
            const currDist = Math.abs(currentVal - proMean);
            const diff = prevDist - currDist;
            if (diff > 0.5) direction = 'improved';     // ↑개선
            else if (diff < -0.5) direction = 'worsened'; // ↓악화
          }

          comparison[phase][key] = {
            prevAvg: +prevAvg.toFixed(1),
            direction,
          };
        }
      }
    } catch {
      // localStorage 접근 실패 등은 무시
    }
    return comparison;
  }

  _detectClubFromMetrics(allMetrics) {
    const wh = allMetrics.filter(m => m && m.wrist_height_rel != null).map(m => m.wrist_height_rel);
    const sa = allMetrics.filter(m => m && m.spine_angle_deg != null && m.spine_angle_deg > 0).map(m => m.spine_angle_deg);
    const maxWH = wh.length > 0 ? Math.max(...wh) : 0;
    const avgSA = sa.length > 0 ? sa.reduce((a, b) => a + b, 0) / sa.length : 0;
    if (maxWH > 0.85 && avgSA < 38) return 'driver';
    if (maxWH > 0.55 || avgSA < 40) return 'iron';
    return 'wedge';
  }
}
