/**
 * SwingAI Feedback Generator v2.0 (Browser)
 * Groq API를 직접 호출하여 AI 피드백 생성
 * Python feedback_generator.py를 JS로 이식
 */

import { CONCERN_KR, METRIC_NAMES_KR } from './swing-analyzer.js';

// ─────────────────────────────────────────────
// 고민별 시스템 프롬프트
// ─────────────────────────────────────────────
const CONCERN_CONFIG = {
  distance: {
    system_prompt: (
      "당신은 PGA 투어 코치 출신의 골프 스윙 분석 전문가입니다. " +
      "이 골퍼의 최대 고민은 '비거리 향상'입니다. " +
      "분석 데이터를 보고 비거리를 늘리기 위한 핵심 개선점을 제시하세요. " +
      "참조 선수: 로리 맥길로이 (X-Factor 68도, 어깨 118도), 타이거 우즈 (X-Factor 72도)."
    ),
    focus: ['x_factor_deg', 'shoulder_turn_deg', 'wrist_height_rel', 'left_knee_flex_deg', 'weight_dist'],
  },
  slice: {
    system_prompt: (
      "당신은 PGA 투어 코치 출신의 골프 스윙 분석 전문가입니다. " +
      "이 골퍼의 최대 고민은 '슬라이스 교정'입니다. " +
      "슬라이스의 원인(아웃-인 스윙 경로, 오픈 페이스 등)을 데이터로 진단하고 교정 방법을 제시하세요. " +
      "참조 선수: 존 람 (짧은 백스윙, 강한 그립, 드로어)."
    ),
    focus: ['shoulder_line_tilt_deg', 'hip_line_tilt_deg', 'lateral_bend_deg', 'weight_dist', 'x_factor_deg'],
  },
  hook: {
    system_prompt: (
      "당신은 PGA 투어 코치 출신의 골프 스윙 분석 전문가입니다. " +
      "이 골퍼의 최대 고민은 '훅 교정'입니다. " +
      "훅의 원인(인-아웃 과다, 닫힌 페이스 등)을 데이터로 진단하고 교정 방법을 제시하세요."
    ),
    focus: ['lateral_bend_deg', 'shoulder_line_tilt_deg', 'hip_line_tilt_deg', 'weight_dist', 'left_arm_deg'],
  },
  accuracy: {
    system_prompt: (
      "당신은 PGA 투어 코치 출신의 골프 스윙 분석 전문가입니다. " +
      "이 골퍼의 최대 고민은 '방향성 개선'입니다. " +
      "일관된 방향성을 위한 어드레스, 백스윙, 임팩트 포지션을 분석하고 개선점을 제시하세요."
    ),
    focus: ['shoulder_line_tilt_deg', 'spine_angle_deg', 'hip_line_tilt_deg', 'left_arm_deg', 'weight_dist'],
  },
  iron_contact: {
    system_prompt: (
      "당신은 PGA 투어 코치 출신의 골프 스윙 분석 전문가입니다. " +
      "이 골퍼의 최대 고민은 '아이언 미스샷(뒤땅, 탑핑)'입니다. " +
      "볼 컨택 품질을 높이기 위한 어드레스, 척추 각도, 체중 이동을 분석하세요."
    ),
    focus: ['spine_angle_deg', 'left_arm_deg', 'weight_dist', 'left_knee_flex_deg', 'lateral_bend_deg'],
  },
  short_game: {
    system_prompt: (
      "당신은 PGA 투어 코치 출신의 골프 스윙 분석 전문가입니다. " +
      "이 골퍼의 최대 고민은 '쇼트게임 (칩, 피치, 벙커)'입니다. " +
      "짧은 스윙에서의 팔 직선도, 손목 높이, 척추 각도를 분석하세요."
    ),
    focus: ['left_arm_deg', 'wrist_height_rel', 'spine_angle_deg', 'weight_dist', 'shoulder_turn_deg'],
  },
  putting: {
    system_prompt: (
      "당신은 PGA 투어 코치 출신의 골프 스윙 분석 전문가입니다. " +
      "이 골퍼의 최대 고민은 '퍼팅'입니다. " +
      "퍼팅 스트로크의 일관성, 어깨 라인, 척추 각도를 분석하세요."
    ),
    focus: ['spine_angle_deg', 'shoulder_line_tilt_deg', 'left_arm_deg', 'weight_dist', 'shoulder_turn_deg'],
  },
  consistency: {
    system_prompt: (
      "당신은 PGA 투어 코치 출신의 골프 스윙 분석 전문가입니다. " +
      "이 골퍼의 최대 고민은 '스윙 일관성'입니다. " +
      "프레임별 지표의 표준편차(std)를 분석하여 일관성이 부족한 부분을 찾고 조언하세요."
    ),
    focus: ['spine_angle_deg', 'x_factor_deg', 'left_arm_deg', 'left_knee_flex_deg'],
  },
};

// 레벨별 피드백 지시
const LEVEL_INSTRUCTION = {
  beginner: (
    "\n\n[유저 레벨: 입문자]\n" +
    "- 전문 용어를 사용하지 마세요. 쉬운 비유를 사용하세요.\n" +
    "- 숫자를 최소화하세요.\n" +
    "- 개선점은 딱 1가지만 제시하세요.\n" +
    "- 드릴은 집에서 할 수 있는 간단한 것 1개만.\n" +
    "- 긍정적이고 격려하는 톤으로 작성하세요.\n" +
    "- 300자 이내로 짧게."
  ),
  intermediate: (
    "\n\n[유저 레벨: 중급자]\n" +
    "- 수치를 포함하되, 쉽게 설명하세요.\n" +
    "- 개선점은 Top 2개를 우선순위로 제시하세요.\n" +
    "- 각 개선점에 원인과 해결책을 함께 설명하세요.\n" +
    "- 드릴은 2가지.\n" +
    "- 프로 선수와 비교하되, 현실적인 목표를 제시하세요.\n" +
    "- 500자 내외."
  ),
  advanced: (
    "\n\n[유저 레벨: 상급자]\n" +
    "- 정밀한 수치와 z-score를 적극 사용하세요.\n" +
    "- 프레임별 표준편차를 분석하여 일관성 변동을 짚어주세요.\n" +
    "- 특정 프로 선수와 직접 비교하세요.\n" +
    "- 개선점은 Top 3개.\n" +
    "- 전문적이고 코치다운 톤으로 작성.\n" +
    "- 700자 내외."
  ),
};

/**
 * 히스토리 기반 프롬프트 섹션 생성
 */
function buildHistorySection() {
  try {
    const raw = localStorage.getItem('swingai_history');
    if (!raw) return '';
    const history = JSON.parse(raw);
    if (!Array.isArray(history) || history.length === 0) return '';

    const lines = ['## 이전 분석 히스토리'];
    const today = new Date();
    for (const entry of history) {
      const entryDate = new Date(entry.date);
      const diffDays = Math.round((today - entryDate) / (1000 * 60 * 60 * 24));
      const clubKr = { driver: '드라이버', iron: '아이언', wedge: '웨지', putter: '퍼터' }[entry.club] || entry.club;
      const levelKr = { beginner: '입문', intermediate: '중급', advanced: '상급' }[entry.level] || entry.level;
      lines.push(`- ${diffDays}일 전: ${clubKr}, ${levelKr} (프로 대비 평균 차이 ${entry.avgDiffPct}%)`);
    }

    // 개선 추세 분석
    if (history.length >= 2) {
      const recent = history[0].avgDiffPct;
      const older = history[history.length - 1].avgDiffPct;
      if (recent < older) {
        lines.push('→ 최근 개선 추세입니다.');
      } else if (recent > older) {
        lines.push('→ 최근 수치가 벌어지고 있습니다. 원인을 짚어주세요.');
      } else {
        lines.push('→ 큰 변화 없이 유지 중입니다.');
      }
    }
    lines.push('');
    return lines.join('\n');
  } catch {
    return '';
  }
}

/**
 * 피드백 평가 기반 스타일 지시 생성
 */
function buildFeedbackStyleSection() {
  try {
    const raw = localStorage.getItem('swingai_feedback_ratings');
    if (!raw) return '';
    const ratings = JSON.parse(raw);
    if (!Array.isArray(ratings) || ratings.length === 0) return '';

    const recent = ratings.slice(-5);
    const upCount = recent.filter(r => r.rating === 'up').length;
    const downCount = recent.filter(r => r.rating === 'down').length;

    if (downCount > upCount) {
      return '\n[피드백 스타일 지시] 사용자가 이전 피드백에 불만족했습니다. 이전과 다른 관점에서 더 구체적이고 실용적인 피드백을 제공하세요.\n';
    } else if (upCount > 0) {
      return '\n[피드백 스타일 지시] 사용자가 이전 피드백에 만족했습니다. 비슷한 스타일로 피드백하되, 새로운 인사이트를 추가하세요.\n';
    }
    return '';
  } catch {
    return '';
  }
}

/**
 * 사용자 프롬프트 생성
 */
function buildUserPrompt(analysisResult, concern) {
  const config = CONCERN_CONFIG[concern] || CONCERN_CONFIG.distance;
  const focus = config.focus;
  const parts = [];

  // 히스토리 섹션 추가
  const historySection = buildHistorySection();
  if (historySection) {
    parts.push(historySection);
  }

  const meta = analysisResult.metadata || {};
  parts.push('## 분석 정보');
  parts.push(`- 클럽: ${meta.club || 'N/A'}`);
  parts.push(`- 카메라뷰: ${meta.camera_view || 'N/A'}`);
  parts.push(`- 감지율: ${meta.detection_rate_pct || 'N/A'}%`);
  parts.push(`- 핸드: ${meta.handedness || 'right'}`);
  parts.push('');

  // 템포 정보
  const tempo = analysisResult.tempo || {};
  if (tempo.tempo_ratio != null) {
    parts.push('## 템포 분석');
    parts.push(`- 백스윙: ${tempo.backswing_sec}초`);
    parts.push(`- 다운스윙: ${tempo.downswing_sec}초`);
    parts.push(`- 템포 비율: ${tempo.tempo_ratio}:1 (PGA 평균: 3.0:1)`);
    parts.push(`- 평가: ${tempo.tempo_rating || 'N/A'}`);
    parts.push('');
  }

  // 부상 위험
  const injuries = analysisResult.injuries || [];
  if (injuries.length > 0) {
    parts.push('## 부상 위험 감지');
    for (const w of injuries) {
      parts.push(`- [${w.phase}] ${w.message} (값: ${w.value.toFixed(1)}, 임계값: ${w.threshold})`);
    }
    parts.push('');
  }

  // 단계별 상대값
  const relative = analysisResult.relative_metrics || {};
  for (const phase of ['address', 'backswing_top', 'impact']) {
    if (!relative[phase]) continue;
    parts.push(`## ${phase} 단계 (프로 대비)`);
    for (const metricName of focus) {
      if (!relative[phase][metricName]) continue;
      const info = relative[phase][metricName];
      if (['unreliable', '2D_limited', 'no_baseline'].includes(info.status)) continue;
      const diffStr = info.diff_pct != null ? `${info.diff_pct > 0 ? '+' : ''}${info.diff_pct}%` : 'N/A';
      const zStr = info.z_score != null ? info.z_score.toFixed(2) : 'N/A';
      const krName = METRIC_NAMES_KR[metricName] || metricName;
      parts.push(
        `- ${krName}: ${info.value} (프로 평균: ${info.pro_mean}, ` +
        `차이: ${diffStr}, z-score: ${zStr}, 상태: ${info.status})`
      );
    }
    parts.push('');
  }

  // 요청
  parts.push('## 요청');
  parts.push('위 데이터를 분석하여 다음 형식으로 답변해주세요:');
  parts.push('1. **현재 상태 요약** (2~3문장)');
  parts.push('2. **개선점** (우선순위순)');
  parts.push('3. **추천 드릴** (구체적 실행 방법 포함)');
  parts.push('4. **다음 목표** (1~2주 내 달성 가능한 목표)');
  if (injuries.length > 0) {
    parts.push('5. **부상 위험 주의사항**');
  }

  return parts.join('\n');
}

/**
 * 한국어 깨짐 방지 후처리
 */
function cleanKoreanText(text) {
  return text.replace(
    /[^\uAC00-\uD7A3\u3131-\u3163\u1100-\u11FFa-zA-Z0-9\s.,!?:;\-()[\]*#@~'"/\n%+=\u00B0\u2192\u2190\u2191\u2193\u00B7\u2026&_]/g,
    ''
  );
}

/**
 * Groq API로 AI 피드백 생성
 * @param {Object} analysisResult - analyze() 결과
 * @param {Object} options - { apiKey, concern, lang }
 * @returns {string|null}
 */
export async function generateFeedback(analysisResult, options = {}) {
  const { apiKey, concern = 'distance' } = options;
  if (!apiKey) return null;

  const config = CONCERN_CONFIG[concern] || CONCERN_CONFIG.distance;
  const level = analysisResult.user_level?.level || 'intermediate';

  // 시스템 프롬프트 조합
  let systemPrompt = config.system_prompt;
  systemPrompt += '\n답변은 한국어로, 아마추어 골퍼가 이해하기 쉽게 작성하세요.';
  systemPrompt += LEVEL_INSTRUCTION[level] || LEVEL_INSTRUCTION.intermediate;
  systemPrompt += buildFeedbackStyleSection();

  systemPrompt += (
    "\n\n[절대 규칙]" +
    "\n1. 언어: 100% 한국어만. 외국어 문자 절대 금지." +
    "\n2. 문체: 존댓말(~합니다, ~하세요)만 사용." +
    "\n3. 자연스러운 한국어로 작성하세요." +
    "\n4. 구조: 아래 섹션을 각각 3~4문장으로 간결하게 작성하세요." +
    "\n  1) 현재 상태 요약" +
    "\n  2) 핵심 개선점" +
    "\n  3) 추천 드릴" +
    "\n  4) 다음 목표" +
    "\n  5) 부상 주의사항 (감지된 경우에만)"
  );

  const userPrompt = buildUserPrompt(analysisResult, concern);

  const maxTokensMap = { beginner: 1200, intermediate: 1500, advanced: 2000 };

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: maxTokensMap[level] || 1500,
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `API 오류 (${response.status})`);
    }

    const data = await response.json();
    let text = data.choices?.[0]?.message?.content || '';
    text = cleanKoreanText(text);
    return text;
  } catch (err) {
    console.error('Groq API 오류:', err);
    throw err;
  }
}
