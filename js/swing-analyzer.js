/**
 * SwingAI Swing Analyzer v2.0 (Browser)
 * Python pose_engine.py의 classify_phases, compute_tempo, to_relative,
 * check_injury_risks, aggregate_phase_metrics를 JS로 이식
 *
 * 프로 기준값(BASELINES)은 v5.0 ML 파이프라인 기반
 * - face_on x_factor/shoulder_turn/left_arm: 8명 PGA 프로 MediaPipe 분석 (n=8, IQR 이상치 제거)
 * - DTL/기타: v4.0 MediaPipe 2D 실측값 유지
 */

// ─────────────────────────────────────────────
// Pro Baselines DB (v5.0 — 2026-03-28 ML 파이프라인 + 2D 실측 혼합)
// ─────────────────────────────────────────────
export const BASELINES = {
  down_the_line: {
    driver: {
      address: {
        spine_angle_deg:        { mean: 19.4,  std: 6.0 },
        left_knee_flex_deg:     { mean: 167.3, std: 8.0 },
        left_arm_deg:           { mean: 171.0, std: 8.0 },
        x_factor_deg:           { mean: 0.0,   std: 5.0 },
        shoulder_turn_deg:      { mean: 0.0,   std: 5.0 },
        shoulder_line_tilt_deg: { mean: 0.0,   std: 30.0 },
        hip_line_tilt_deg:      { mean: 0.0,   std: 26.0 },
        lateral_bend_deg:       { mean: 19.4,  std: 12.0 },
        wrist_height_rel:       { mean: 0.44,  std: 0.08 },
      },
      backswing_top: {
        spine_angle_deg:        { mean: 18.7,  std: 6.0 },
        left_knee_flex_deg:     { mean: 173.3, std: 8.0 },
        left_arm_deg:           { mean: 177.6, std: 8.0 },
        shoulder_turn_deg:      { mean: 4.0,   std: 6.0 },
        x_factor_deg:           { mean: 10.0,  std: 27.0 },
        wrist_height_rel:       { mean: 0.47,  std: 0.08 },
        shoulder_line_tilt_deg: { mean: 13.0,  std: 31.0 },
        hip_line_tilt_deg:      { mean: 16.0,  std: 20.0 },
        lateral_bend_deg:       { mean: 18.7,  std: 8.0 },
      },
      impact: {
        spine_angle_deg:        { mean: 18.5,  std: 6.0 },
        left_arm_deg:           { mean: 173.0, std: 8.0 },
        left_knee_flex_deg:     { mean: 165.0, std: 8.0 },
        shoulder_line_tilt_deg: { mean: -5.0,  std: 43.0 },
        hip_line_tilt_deg:      { mean: 11.0,  std: 34.0 },
        lateral_bend_deg:       { mean: 18.5,  std: 11.0 },
        x_factor_deg:           { mean: 19.0,  std: 14.0 },
        shoulder_turn_deg:      { mean: 17.0,  std: 24.0 },
        wrist_height_rel:       { mean: 0.39,  std: 0.08 },
      },
    },
    iron: {
      address: {
        spine_angle_deg:        { mean: 21.0,  std: 6.0 },
        left_knee_flex_deg:     { mean: 176.0, std: 8.0 },
        left_arm_deg:           { mean: 177.0, std: 8.0 },
        x_factor_deg:           { mean: 0.0,   std: 5.0 },
        shoulder_turn_deg:      { mean: 0.0,   std: 5.0 },
        shoulder_line_tilt_deg: { mean: 0.0,   std: 3.0 },
        hip_line_tilt_deg:      { mean: 0.0,   std: 2.0 },
        lateral_bend_deg:       { mean: 3.0,   std: 3.0 },
        wrist_height_rel:       { mean: 0.42,  std: 0.08 },
      },
      backswing_top: {
        spine_angle_deg:        { mean: 20.0,  std: 6.0 },
        left_knee_flex_deg:     { mean: 173.3, std: 8.0 },
        left_arm_deg:           { mean: 177.6, std: 8.0 },
        shoulder_turn_deg:      { mean: 4.0,   std: 6.0 },
        x_factor_deg:           { mean: 10.0,  std: 27.0 },
        wrist_height_rel:       { mean: 0.45,  std: 0.08 },
        shoulder_line_tilt_deg: { mean: 13.0,  std: 31.0 },
        hip_line_tilt_deg:      { mean: 16.0,  std: 20.0 },
        lateral_bend_deg:       { mean: 20.0,  std: 8.0 },
      },
      impact: {
        spine_angle_deg:        { mean: 20.0,  std: 6.0 },
        left_arm_deg:           { mean: 173.0, std: 8.0 },
        left_knee_flex_deg:     { mean: 165.0, std: 8.0 },
        shoulder_line_tilt_deg: { mean: -5.0,  std: 43.0 },
        hip_line_tilt_deg:      { mean: 11.0,  std: 34.0 },
        lateral_bend_deg:       { mean: 20.0,  std: 11.0 },
        x_factor_deg:           { mean: 19.0,  std: 14.0 },
        shoulder_turn_deg:      { mean: 17.0,  std: 24.0 },
        wrist_height_rel:       { mean: 0.38,  std: 0.08 },
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
        left_arm_deg: { mean: 173.3, std: 6.0 }, shoulder_turn_deg: { mean: 88.0, std: 5.0 },
        x_factor_deg: { mean: 46.0, std: 4.0 }, weight_dist: { mean: 0.50, std: 0.05 },
        wrist_height_rel: { mean: 0.43, std: 0.08 }, shoulder_line_tilt_deg: { mean: -10.0, std: 15.0 },
        hip_line_tilt_deg: { mean: -2.0, std: 8.0 }, lateral_bend_deg: { mean: 5.0, std: 4.0 },
      },
      impact: {
        spine_angle_deg: { mean: 6.4, std: 4.0 }, left_arm_deg: { mean: 172.0, std: 10.0 },
        left_knee_flex_deg: { mean: 178.0, std: 2.0 }, shoulder_line_tilt_deg: { mean: -5.0, std: 12.0 },
        hip_line_tilt_deg: { mean: -3.0, std: 8.0 }, lateral_bend_deg: { mean: 4.0, std: 4.0 },
        weight_dist: { mean: 0.50, std: 0.05 }, x_factor_deg: { mean: 28.0, std: 4.0 },
        shoulder_turn_deg: { mean: 38.0, std: 4.0 }, wrist_height_rel: { mean: 0.42, std: 0.08 },
      },
    },
    iron: {
      address: {
        spine_angle_deg: { mean: 5.0, std: 1.5 }, left_knee_flex_deg: { mean: 178.5, std: 2.0 },
        left_arm_deg: { mean: 172.0, std: 6.0 }, weight_dist: { mean: 0.52, std: 0.03 },
        x_factor_deg: { mean: 0.0, std: 2.0 }, shoulder_turn_deg: { mean: 0.0, std: 2.0 },
        shoulder_line_tilt_deg: { mean: 0.0, std: 15.0 }, hip_line_tilt_deg: { mean: 0.0, std: 8.0 },
        lateral_bend_deg: { mean: 2.0, std: 3.0 }, wrist_height_rel: { mean: 0.40, std: 0.08 },
      },
      backswing_top: {
        spine_angle_deg: { mean: 5.0, std: 1.5 }, left_knee_flex_deg: { mean: 178.0, std: 2.5 },
        left_arm_deg: { mean: 175.0, std: 6.0 }, shoulder_turn_deg: { mean: 90.0, std: 7.0 },
        x_factor_deg: { mean: 45.0, std: 5.0 }, weight_dist: { mean: 0.52, std: 0.05 },
        wrist_height_rel: { mean: 0.42, std: 0.08 }, shoulder_line_tilt_deg: { mean: -10.0, std: 15.0 },
        hip_line_tilt_deg: { mean: -2.0, std: 8.0 }, lateral_bend_deg: { mean: 5.0, std: 4.0 },
      },
      impact: {
        spine_angle_deg: { mean: 5.0, std: 1.5 }, left_arm_deg: { mean: 172.0, std: 5.0 },
        left_knee_flex_deg: { mean: 178.0, std: 2.0 }, shoulder_line_tilt_deg: { mean: -5.0, std: 12.0 },
        hip_line_tilt_deg: { mean: -3.0, std: 8.0 }, lateral_bend_deg: { mean: 4.0, std: 4.0 },
        weight_dist: { mean: 0.78, std: 0.05 }, x_factor_deg: { mean: 30.0, std: 4.0 },
        shoulder_turn_deg: { mean: 40.0, std: 4.0 }, wrist_height_rel: { mean: 0.38, std: 0.08 },
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
// face_on: 2D 정면 투영에서 신뢰도 높은 지표
//   - spine_angle: 측면 기울기 (face_on에서 측정 가능)
//   - x_factor_deg, shoulder_turn_deg: 백스윙탑/임팩트에서 신뢰도 충분 (mean/std 검증됨)
// down_the_line: 2D 측면 투영 한계로 3개 지표만 신뢰
//   - shoulder_turn/x_factor는 DTL 2D에서 계산 자체가 부정확
const RELIABLE_METRICS = {
  face_on: {
    address:        ['spine_angle_deg', 'left_arm_deg', 'left_knee_flex_deg', 'weight_dist', 'wrist_height_rel'],
    backswing_top:  ['spine_angle_deg', 'left_arm_deg', 'left_knee_flex_deg', 'wrist_height_rel', 'weight_dist', 'x_factor_deg', 'shoulder_turn_deg'],
    impact:         ['spine_angle_deg', 'left_arm_deg', 'left_knee_flex_deg', 'weight_dist', 'wrist_height_rel', 'x_factor_deg', 'shoulder_turn_deg'],
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
  /**
   * 스윙 6단계 자동 분류 v3.0 — 5-signal 가중 스코어 방식
   *
   * 핵심 원리:
   *   백스윙 탑 = 모든 움직임이 순간적으로 '멈추는' 지점 (변화율 → 0)
   *   임팩트    = 손목이 어드레스 높이로 복귀 + X-factor 소진 + 하강 속도 최대
   *   어드레스  = 스윙 시작 전 정지 구간 (움직임 최소)
   *
   * Signal weights:
   *   top:    wristHeight(0.20) + wristVelocity(0.30) + xFactorRate(0.25)
   *           + shoulderRate(0.15) + framePrior(0.10)
   *   impact: wristReturn(0.35) + xFactorDrop(0.35) + wristDropSpeed(0.30)
   */
  classifyPhases(allMetrics, fps = 30, cameraView = 'face_on') {
    const n = allMetrics.length;
    if (n === 0) return [];
    const isDTL = cameraView === 'down_the_line';

    // ── 시그널 추출 ──────────────────────────────
    const wh  = allMetrics.map(m => (m && m.wrist_height_rel  != null) ? m.wrist_height_rel  : null);
    const xf  = allMetrics.map(m => (m && m.x_factor_deg      != null) ? m.x_factor_deg      : null);
    const sht = allMetrics.map(m => (m && m.shoulder_turn_deg  != null) ? m.shoulder_turn_deg  : null);

    // ── 스무딩 유틸 (rolling mean, window=3) ─────
    const smooth = (arr, w = 3) => arr.map((v, i) => {
      const start = Math.max(0, i - Math.floor(w / 2));
      const end   = Math.min(arr.length, start + w);
      const vals  = arr.slice(start, end).filter(x => x !== null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    });

    // 결측값 선형 보간
    const interpolate = (arr) => {
      const out = [...arr];
      for (let i = 0; i < out.length; i++) {
        if (out[i] === null) {
          let left = i - 1;
          let right = i + 1;
          while (left >= 0 && out[left] === null) left--;
          while (right < out.length && out[right] === null) right++;
          if (left >= 0 && right < out.length) {
            out[i] = out[left] + (out[right] - out[left]) * ((i - left) / (right - left));
          } else if (left >= 0) {
            out[i] = out[left];
          } else if (right < out.length) {
            out[i] = out[right];
          } else {
            out[i] = 0;
          }
        }
      }
      return out;
    };

    const whS  = smooth(interpolate(wh),  3);
    const xfS  = smooth(interpolate(xf),  3);
    const shtS = smooth(interpolate(sht), 3);

    // ── 프레임별 변화율 계산 ──────────────────────
    const diff = (arr) => arr.map((v, i) => i === 0 ? 0 : Math.abs((v ?? 0) - (arr[i - 1] ?? 0)));
    const whDiff  = diff(whS);
    const xfDiff  = diff(xfS);
    const shtDiff = diff(shtS);

    // ── 어드레스 감지: 초반 정지 구간 ────────────
    // 처음 5%~15% 구간에서 움직임이 최소인 연속 프레임을 찾음
    const addrEnd = Math.min(
      Math.floor(n * 0.15),
      (() => {
        // X-factor가 처음으로 0.5deg/frame 이상 증가하는 시점
        for (let i = 2; i < Math.floor(n * 0.3); i++) {
          if ((xfDiff[i] || 0) > 0.5 && (whDiff[i] || 0) > 0.002) return i;
        }
        return Math.floor(n * 0.10);
      })()
    );

    // ── 어드레스 평균 wrist height (임팩트 복귀 기준) ─
    const addrWH = whS.slice(0, Math.max(1, addrEnd))
      .reduce((a, b) => a + (b || 0), 0) / Math.max(1, addrEnd);

    // ── 임팩트 탐색 범위: 전체의 40%~88% ─────────
    const impSearchStart = Math.floor(n * 0.40);
    const impSearchEnd   = Math.floor(n * 0.88);

    // 임팩트 스코어 계산
    const impactScores = new Array(n).fill(0);
    const normalize = (arr, searchS, searchE) => {
      const sub = arr.slice(searchS, searchE);
      const min = Math.min(...sub);
      const max = Math.max(...sub);
      const range = max - min || 1;
      return arr.map(v => (v - min) / range);
    };

    // Signal 1: wrist height가 address 높이와 가장 비슷한 지점 (높을수록 좋음)
    const whReturnRaw = whS.map(v => -Math.abs((v || 0) - addrWH));
    const whReturn = normalize(whReturnRaw, impSearchStart, impSearchEnd);

    // Signal 2: X-factor 변화율 최대 (downswing에서 급감) → 소진 직후
    const xfDropNorm = normalize(xfDiff, impSearchStart, impSearchEnd);

    // Signal 3: 손목 하강 속도 (wrist가 내려오는 속도가 클수록 임팩트 근처)
    const whDownRaw = whS.map((v, i) =>
      i === 0 ? 0 : Math.max(0, (whS[i - 1] || 0) - (v || 0))
    );
    const whDown = normalize(whDownRaw, impSearchStart, impSearchEnd);

    // DTL: x_factor 노이즈 → wrist 복귀/하강 가중치 증가
    const impW = isDTL
      ? { ret: 0.45, xf: 0.10, down: 0.45 }
      : { ret: 0.35, xf: 0.35, down: 0.30 };
    for (let i = impSearchStart; i < impSearchEnd; i++) {
      impactScores[i] =
        whReturn[i]  * impW.ret +
        xfDropNorm[i] * impW.xf +
        whDown[i]    * impW.down;
    }

    // 임팩트 = 스코어 최대 지점
    let impactIdx = impSearchStart;
    let bestImpact = -Infinity;
    for (let i = impSearchStart; i < impSearchEnd; i++) {
      if (impactScores[i] > bestImpact) {
        bestImpact = impactScores[i];
        impactIdx = i;
      }
    }

    // ── 백스윙 탑 탐색 범위: addrEnd ~ impactIdx * 0.85 ──
    const topSearchStart = addrEnd + 1;
    const topSearchEnd   = Math.max(topSearchStart + 2, Math.floor(impactIdx * 0.85));

    // 백스윙 탑 스코어 계산
    const topScores = new Array(n).fill(0);

    // Signal 1: smoothed wrist height 높을수록 (백스윙 탑에서 손목 올라감)
    const whTopNorm = normalize(whS, topSearchStart, topSearchEnd);

    // Signal 2: 손목 속도 최소 (방향 전환 직전, 0에 가까울수록)
    const whVelInv = whDiff.map(v => -v);
    const whVelNorm = normalize(whVelInv, topSearchStart, topSearchEnd);

    // Signal 3: X-factor 변화율 최소 (어깨-힙 분리가 최대가 되는 순간 정지)
    const xfRateInv = xfDiff.map(v => -v);
    const xfRateNorm = normalize(xfRateInv, topSearchStart, topSearchEnd);

    // Signal 4: 어깨 회전 변화율 최소 (어깨도 잠깐 멈춤)
    const shtRateInv = shtDiff.map(v => -v);
    const shtRateNorm = normalize(shtRateInv, topSearchStart, topSearchEnd);

    // Signal 5: 프레임 위치 prior (전체의 30~55% 구간 선호, 가우시안)
    const priorMean = 0.42;
    const priorSigma = 0.10;
    const framePrior = Array.from({ length: n }, (_, i) => {
      const ratio = i / n;
      return Math.exp(-0.5 * ((ratio - priorMean) / priorSigma) ** 2);
    });
    const framePriorNorm = normalize(framePrior, topSearchStart, topSearchEnd);

    // DTL: x_factor/shoulder_turn 노이즈 → wrist 신호 가중치 증가
    const topW = isDTL
      ? { wh: 0.35, vel: 0.40, xf: 0.05, sht: 0.05, prior: 0.15 }
      : { wh: 0.20, vel: 0.30, xf: 0.25, sht: 0.15, prior: 0.10 };
    for (let i = topSearchStart; i < topSearchEnd; i++) {
      topScores[i] =
        whTopNorm[i]       * topW.wh +
        whVelNorm[i]       * topW.vel +
        xfRateNorm[i]      * topW.xf +
        shtRateNorm[i]     * topW.sht +
        framePriorNorm[i]  * topW.prior;
    }

    // 백스윙 탑 = 스코어 최대 지점
    let topIdx = topSearchStart;
    let bestTop = -Infinity;
    for (let i = topSearchStart; i < topSearchEnd; i++) {
      if (topScores[i] > bestTop) {
        bestTop = topScores[i];
        topIdx = i;
      }
    }

    // 보정: topIdx < impactIdx 보장
    if (topIdx >= impactIdx) {
      topIdx = Math.max(addrEnd + 1, impactIdx - Math.max(2, Math.floor(n * 0.05)));
    }

    // ── 단계 할당 ─────────────────────────────────
    const phases = [];
    for (let i = 0; i < n; i++) {
      if (i <= addrEnd) {
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

    // 디버그 정보 저장 (학습 시스템에서 활용)
    this._lastPhaseIndices = { addrEnd, topIdx, impactIdx, n };
    this._lastTopScores   = topScores;
    this._lastImpactScores = impactScores;

    return phases;
  }

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
    // 유저가 직접 선택한 클럽을 우선 사용, 'auto'이거나 미지정 시 자동 감지
    const detectedClub = (club && club !== 'auto')
      ? club
      : (frames[0]?.metrics ? this._detectClubFromMetrics(allMetrics) : 'driver');

    // 단계 분류 (DTL 뷰에서는 wrist 기반 가중치 사용)
    const phases = this.classifyPhases(allMetrics, fps, cameraView);

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

    // 감지율
    const detectedCount = frames.filter(f => f.landmarks !== null).length;
    const detectionRate = +((detectedCount / frames.length) * 100).toFixed(1);

    // 키 프레임 랜드마크 (phase 포착 이미지용)
    const phIdx = this._lastPhaseIndices || {};
    const key_frame_landmarks = {};
    const phaseFrameMap = {
      address:       phIdx.addrEnd   != null ? Math.max(0, phIdx.addrEnd) : null,
      backswing_top: phIdx.topIdx    != null ? phIdx.topIdx               : null,
      impact:        phIdx.impactIdx != null ? phIdx.impactIdx             : null,
    };
    for (const [phaseName, idx] of Object.entries(phaseFrameMap)) {
      if (idx == null) continue;
      const f = frames[idx];
      if (!f) continue;
      key_frame_landmarks[phaseName] = {
        time:      f.time      ?? (idx / fps),
        landmarks: f.landmarks ?? null,
      };
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
      injuries,
      user_level: userLevel,
      overall_score: overallScore,
      key_frame_landmarks,
    };
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
