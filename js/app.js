/**
 * SwingAI v2.0 Web — Main App
 * UI 이벤트 바인딩 + 결과 렌더링 + 레이더 차트
 */

import { SwingPoseEngine } from './pose-engine.js';
import { SwingAnalyzer, METRIC_NAMES_KR, CONCERN_KR } from './swing-analyzer.js';
import { generateFeedback } from './feedback.js';

// ─────────────────────────────────────────────
// State
// ─────────────────────────────────────────────
let poseEngine = null;
let analyzer = new SwingAnalyzer();
let currentVideoFile = null;
let analysisResult = null;
let activePhase = 'address';

// ─────────────────────────────────────────────
// History Manager (localStorage)
// ─────────────────────────────────────────────
const HISTORY_KEY = 'swingai_history';
const MAX_HISTORY = 10;

function saveAnalysisHistory(result) {
  try {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    const keyMetrics = {};
    // address, backswing_top, impact의 주요 지표값 수집
    for (const phase of ['address', 'backswing_top', 'impact']) {
      const rel = result.relative_metrics[phase];
      if (!rel) continue;
      for (const [key, info] of Object.entries(rel)) {
        if (info.value != null && !['unreliable', '2D_limited', 'no_baseline'].includes(info.status)) {
          keyMetrics[key] = info.value;
        }
      }
    }

    const entry = {
      date: new Date().toISOString().slice(0, 10),
      club: result.metadata.club,
      level: result.user_level?.level || 'intermediate',
      avgDiffPct: result.user_level?.avg_diff_pct || 0,
      keyMetrics,
      concern: result.metadata.concern,
    };

    history.unshift(entry);
    if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.warn('히스토리 저장 실패:', e);
  }
}

// ─────────────────────────────────────────────
// Feedback Rating Manager
// ─────────────────────────────────────────────
const RATING_KEY = 'swingai_feedback_ratings';

function saveFeedbackRating(rating) {
  try {
    const ratings = JSON.parse(localStorage.getItem(RATING_KEY) || '[]');
    ratings.push({
      date: new Date().toISOString(),
      rating, // 'up' or 'down'
    });
    // 최근 20건만 유지
    if (ratings.length > 20) ratings.splice(0, ratings.length - 20);
    localStorage.setItem(RATING_KEY, JSON.stringify(ratings));
  } catch (e) {
    console.warn('평가 저장 실패:', e);
  }
}

// ─────────────────────────────────────────────
// DOM References
// ─────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const els = {
  initOverlay: $('initOverlay'),
  initText: $('initText'),
  videoInputArea: $('videoInputArea'),
  videoFile: $('videoFile'),
  videoPreview: $('videoPreview'),
  videoControls: $('videoControls'),
  btnChangeVideo: $('btnChangeVideo'),
  btnRemoveVideo: $('btnRemoveVideo'),
  btnAnalyze: $('btnAnalyze'),
  selectConcern: $('selectConcern'),
  selectClub: $('selectClub'),
  handednessGroup: $('handednessGroup'),
  progressSection: $('progressSection'),
  progressBar: $('progressBar'),
  progressText: $('progressText'),
  progressStep: $('progressStep'),
  resultsSection: $('resultsSection'),
  levelBadge: $('levelBadge'),
  scoreCircle: $('scoreCircle'),
  detectedView: $('detectedView'),
  detectedClub: $('detectedClub'),
  phaseTabs: $('phaseTabs'),
  metricsBody: $('metricsBody'),
  radarCanvas: $('radarCanvas'),
  tempoBackswing: $('tempoBackswing'),
  tempoDownswing: $('tempoDownswing'),
  tempoRatio: $('tempoRatio'),
  tempoBar: $('tempoBar'),
  tempoComment: $('tempoComment'),
  injurySection: $('injurySection'),
  injuryList: $('injuryList'),
  feedbackLoading: $('feedbackLoading'),
  feedbackText: $('feedbackText'),
  feedbackNoKey: $('feedbackNoKey'),
  settingsModal: $('settingsModal'),
  inputApiKey: $('inputApiKey'),
  toast: $('toast'),
};

// ─────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────
function showToast(msg, duration = 3000) {
  els.toast.textContent = msg;
  els.toast.classList.add('visible');
  setTimeout(() => els.toast.classList.remove('visible'), duration);
}

// ─────────────────────────────────────────────
// Init Engine
// ─────────────────────────────────────────────
async function initEngine() {
  els.initOverlay.classList.add('visible');
  poseEngine = new SwingPoseEngine();
  try {
    await poseEngine.init((msg) => {
      els.initText.textContent = msg;
    });
    els.initOverlay.classList.remove('visible');
    showToast('AI 엔진 준비 완료');
  } catch (err) {
    els.initText.textContent = `엔진 로딩 실패: ${err.message}`;
    console.error('Engine init error:', err);
    setTimeout(() => els.initOverlay.classList.remove('visible'), 3000);
  }
}

// ─────────────────────────────────────────────
// Video Input
// ─────────────────────────────────────────────
function setupVideoInput() {
  // 앨범 선택
  els.videoFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // 영상 파일 검증
    const validTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/3gpp'];
    const validExts = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.3gp'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!file.type.startsWith('video/') && !validExts.includes(ext)) {
      alert('영상 파일만 선택해주세요. (MP4, MOV, WebM 등)');
      return;
    }
    loadVideo(file);
  });

  // 카메라 촬영
  const cameraFile = document.getElementById('cameraFile');
  if (cameraFile) {
    cameraFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      loadVideo(file);
    });
  }

  els.btnChangeVideo.addEventListener('click', () => {
    els.videoFile.click();
  });

  els.btnRemoveVideo.addEventListener('click', () => {
    removeVideo();
  });
}

function loadVideo(file) {
  currentVideoFile = file;
  const url = URL.createObjectURL(file);
  els.videoPreview.src = url;
  els.videoPreview.style.display = 'block';

  // 영상 로드 성공/실패 감지
  els.videoPreview.onerror = () => {
    alert('이 영상 형식은 브라우저에서 재생할 수 없습니다.\n\nHEVC(H.265) 코덱은 일부 브라우저에서 지원되지 않습니다.\n\n해결: 영상을 H.264(MP4)로 변환하거나, Safari 브라우저에서 시도해주세요.');
    removeVideo();
  };

  els.videoPreview.onloadedmetadata = () => {
    const dur = els.videoPreview.duration;
    const w = els.videoPreview.videoWidth;
    const h = els.videoPreview.videoHeight;
    console.log(`[영상 로드] ${w}x${h}, ${dur.toFixed(1)}초, ${(file.size/1024).toFixed(0)}KB`);

    if (dur > 60) {
      alert(`영상이 ${dur.toFixed(0)}초입니다. 60초 이하의 스윙 영상을 사용해주세요.`);
      removeVideo();
      return;
    }

    els.videoInputArea.classList.add('has-video');
    els.videoInputArea.querySelector('.video-input-icon').style.display = 'none';
    els.videoInputArea.querySelector('.video-input-text').textContent = '영상 로드 완료';
    const subEl = els.videoInputArea.querySelector('.video-input-sub');
    if (subEl) subEl.style.display = 'none';
    els.videoControls.classList.add('visible');
    els.btnAnalyze.disabled = false;

    // 자동 분석 시작 (1초 후)
    setTimeout(() => {
      if (poseEngine && poseEngine.isReady) {
        runAnalysis();
      }
    }, 1000);
  };

  // 결과 초기화
  els.resultsSection.classList.remove('visible');
}

function removeVideo() {
  currentVideoFile = null;
  els.videoPreview.src = '';
  els.videoPreview.style.display = 'none';
  els.videoInputArea.classList.remove('has-video');
  els.videoInputArea.querySelector('.video-input-icon').style.display = '';
  els.videoInputArea.querySelector('.video-input-text').style.display = '';
  els.videoInputArea.querySelector('.video-input-sub').style.display = '';
  els.videoControls.classList.remove('visible');
  els.btnAnalyze.disabled = true;
  els.resultsSection.classList.remove('visible');
  els.videoFile.value = '';
}

// ─────────────────────────────────────────────
// Handedness
// ─────────────────────────────────────────────
function setupHandedness() {
  const chips = els.handednessGroup.querySelectorAll('.chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
    });
  });
}

function getHandedness() {
  const selected = els.handednessGroup.querySelector('.chip.selected');
  return selected ? selected.dataset.value : 'right';
}

// ─────────────────────────────────────────────
// Analyze
// ─────────────────────────────────────────────
async function runAnalysis() {
  if (!poseEngine || !poseEngine.isReady) {
    showToast('AI 엔진이 아직 준비되지 않았습니다.');
    return;
  }
  if (!currentVideoFile) {
    showToast('영상을 선택해주세요.');
    return;
  }

  const concern = els.selectConcern.value;
  const club = els.selectClub.value;
  const handedness = getHandedness();

  // UI: 진행 표시
  els.btnAnalyze.disabled = true;
  els.resultsSection.classList.remove('visible');
  els.progressSection.classList.add('visible');
  els.progressBar.style.width = '0%';
  els.progressText.textContent = '영상 준비 중...';
  els.progressStep.textContent = '1/4: 영상 로딩';

  try {
    // 비디오 로딩 완료 대기
    const video = els.videoPreview;
    if (video.readyState < 2) {
      await new Promise((resolve, reject) => {
        video.addEventListener('loadeddata', resolve, { once: true });
        video.addEventListener('error', reject, { once: true });
      });
    }

    // Step 1: 포즈 분석
    els.progressStep.textContent = '2/4: 포즈 감지';
    const { frames, cameraView } = await poseEngine.analyzeVideo(video, {
      maxFrames: 90,
      handedness,
      onProgress: (current, total) => {
        const pct = Math.round((current / total) * 100);
        els.progressBar.style.width = `${pct}%`;
        els.progressText.textContent = `프레임 ${current}/${total} 분석 중...`;
      },
    });

    // 감지율 체크
    const detected = frames.filter(f => f.landmarks).length;
    if (detected === 0) {
      throw new Error('영상에서 사람 포즈를 감지하지 못했습니다. 밝은 환경에서 전신이 보이는 영상을 사용해주세요.');
    }

    // Step 2: 스윙 분석
    els.progressStep.textContent = '3/4: 스윙 분석';
    els.progressBar.style.width = '80%';
    els.progressText.textContent = '스윙 지표 계산 중...';

    analysisResult = analyzer.analyze(frames, cameraView, { club, handedness, concern });

    // Step 3: 결과 렌더링
    els.progressStep.textContent = '4/4: 결과 생성';
    els.progressBar.style.width = '100%';
    els.progressText.textContent = '완료!';

    renderResults(analysisResult);

    // 히스토리 저장
    saveAnalysisHistory(analysisResult);

    // Step 4: AI 피드백 (비동기)
    // API 키: 사용자 설정 우선, 없으면 기본 키
    const _k = [77,89,65,117,108,65,92,73,115,70,110,125,102,109,127,115,111,96,127,28,114,66,65,124,125,109,78,83,72,25,108,115,126,83,109,29,28,110,91,93,72,82,104,70,70,18,71,77,99,88,28,127,27,88,92,25];
    const apiKey = localStorage.getItem('groq_api_key') || _k.map(c => String.fromCharCode(c ^ 42)).join('');
    if (apiKey) {
      els.feedbackLoading.style.display = 'block';
      els.feedbackText.textContent = '';
      els.feedbackNoKey.style.display = 'none';
      try {
        const feedback = await generateFeedback(analysisResult, { apiKey, concern });
        els.feedbackText.innerHTML = formatFeedback(feedback);
      } catch (err) {
        els.feedbackText.textContent = `AI 피드백 생성 실패: ${err.message}`;
      }
      els.feedbackLoading.style.display = 'none';
    } else {
      els.feedbackNoKey.style.display = 'block';
      els.feedbackText.textContent = '';
    }

    setTimeout(() => {
      els.progressSection.classList.remove('visible');
    }, 500);

  } catch (err) {
    console.error('Analysis error:', err);
    showToast(`분석 실패: ${err.message}`, 5000);
    els.progressSection.classList.remove('visible');
  }

  els.btnAnalyze.disabled = false;
}

// ─────────────────────────────────────────────
// Render Results
// ─────────────────────────────────────────────
function renderResults(result) {
  els.resultsSection.classList.add('visible');

  // Level Badge
  const lv = result.user_level;
  const lvClass = lv.level || 'intermediate';
  const lvEmoji = { beginner: '🏌️', intermediate: '⛳', advanced: '🏆' };
  els.levelBadge.className = `level-badge ${lvClass}`;
  els.levelBadge.textContent = `${lvEmoji[lvClass] || ''} ${lv.level_kr || '중급'}`;

  // Score
  const score = result.overall_score;
  els.scoreCircle.textContent = score != null ? score : '-';

  // Camera view & Club
  const viewMap = { face_on: '정면 (Face On)', down_the_line: '후방 (DTL)' };
  const clubMap = { driver: '드라이버', iron: '아이언', wedge: '웨지', putter: '퍼터' };
  els.detectedView.textContent = viewMap[result.metadata.camera_view] || result.metadata.camera_view;
  els.detectedClub.textContent = clubMap[result.metadata.club] || result.metadata.club;

  // Skeleton overlay (Feature 4)
  renderSkeletonOverlay(result);

  // Tempo
  renderTempo(result.tempo);

  // Metrics table (default: address)
  activePhase = 'address';
  renderMetricsTable(result, 'address');
  setupPhaseTabs(result);

  // Radar chart
  renderRadarChart(result);

  // Injury warnings
  renderInjuries(result.injuries);

  // Feedback rating buttons
  renderFeedbackRating();

  // Scroll to results
  setTimeout(() => {
    els.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 200);
}

function renderTempo(tempo) {
  if (!tempo || tempo.tempo_ratio == null) {
    els.tempoBackswing.textContent = '-';
    els.tempoDownswing.textContent = '-';
    els.tempoRatio.textContent = '-';
    els.tempoComment.textContent = '템포 측정 불가';
    return;
  }

  els.tempoBackswing.textContent = `${tempo.backswing_sec}s`;
  els.tempoDownswing.textContent = `${tempo.downswing_sec}s`;
  els.tempoRatio.textContent = `${tempo.tempo_ratio}:1`;

  // Bar
  const total = tempo.backswing_sec + tempo.downswing_sec;
  if (total > 0) {
    const bsPct = (tempo.backswing_sec / total) * 100;
    els.tempoBar.querySelector('.backswing').style.width = `${bsPct}%`;
    els.tempoBar.querySelector('.downswing').style.width = `${100 - bsPct}%`;
  }

  // Comment
  const ratingMap = {
    excellent: 'PGA 투어 수준의 템포입니다!',
    good: '좋은 템포입니다. 약간의 미세 조정만 필요합니다.',
    needs_work: '템포 개선이 필요합니다. 메트로놈 연습을 추천합니다.',
    unreliable: '측정이 불안정합니다. 다시 촬영해주세요.',
  };
  els.tempoComment.textContent = ratingMap[tempo.tempo_rating] || '';
}

function setupPhaseTabs(result) {
  const tabs = els.phaseTabs.querySelectorAll('.phase-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activePhase = tab.dataset.phase;
      renderMetricsTable(result, activePhase);
    });
  });
}

function renderMetricsTable(result, phase) {
  const relative = result.relative_metrics[phase];
  if (!relative) {
    els.metricsBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999;">데이터 없음</td></tr>';
    return;
  }

  const baseline = (result.personal_baseline || {})[phase] || {};
  const hasBaseline = Object.keys(baseline).length > 0;

  const rows = [];
  for (const [key, info] of Object.entries(relative)) {
    if (info.status === 'no_baseline') continue;
    const name = METRIC_NAMES_KR[key] || key;
    const myVal = info.value != null ? (typeof info.value === 'number' ? info.value.toFixed(1) : info.value) : '-';
    const proVal = info.pro_mean != null ? info.pro_mean.toFixed(1) : '-';

    let diffStr = '-';
    if (info.diff_pct != null) {
      const sign = info.diff_pct > 0 ? '+' : '';
      diffStr = `${sign}${info.diff_pct}%`;
    }
    if (info.status === '2D_limited') diffStr = '-';
    if (info.status === 'unreliable') diffStr = '-';

    // 이전 대비 (Feature 2)
    let prevStr = '-';
    const bInfo = baseline[key];
    if (bInfo) {
      const dirMap = {
        improved:  '<span style="color:#2e7d32;font-weight:600;">↑개선</span>',
        worsened:  '<span style="color:#c62828;font-weight:600;">↓악화</span>',
        same:      '<span style="color:#757575;">→유지</span>',
      };
      prevStr = dirMap[bInfo.direction] || '-';
    }

    const statusDot = `<span class="status-dot ${info.status}"></span>`;
    const statusText = {
      normal: '정상', caution: '주의', warning: '경고',
      '2D_limited': '제한', unreliable: '부정확', unknown: '-',
    };

    rows.push(`
      <tr>
        <td>${name}</td>
        <td>${myVal}</td>
        <td>${proVal}</td>
        <td>${diffStr}</td>
        <td>${prevStr}</td>
        <td>${statusDot}${statusText[info.status] || '-'}</td>
      </tr>
    `);
  }

  els.metricsBody.innerHTML = rows.join('');
}

function renderInjuries(injuries) {
  if (!injuries || injuries.length === 0) {
    els.injurySection.style.display = 'none';
    return;
  }

  els.injurySection.style.display = 'block';
  els.injuryList.innerHTML = injuries.map(w => `
    <div class="injury-card ${w.severity}">
      <div class="title">[${w.phase}] ${w.message}</div>
      <div class="detail">${METRIC_NAMES_KR[w.metric] || w.metric}: ${w.value.toFixed(1)} (임계값: ${w.threshold})</div>
    </div>
  `).join('');
}

// ─────────────────────────────────────────────
// Radar Chart (Canvas 2D)
// ─────────────────────────────────────────────
function renderRadarChart(result) {
  const canvas = els.radarCanvas;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const cx = W / 2;
  const cy = H / 2;
  const R = Math.min(W, H) / 2 - 30;

  ctx.clearRect(0, 0, W, H);

  // 데이터 수집 (backswing_top 기준)
  const phase = result.relative_metrics.backswing_top || result.relative_metrics.address || {};
  const metrics = [];
  const metricKeys = [
    'spine_angle_deg', 'left_arm_deg', 'left_knee_flex_deg',
    'x_factor_deg', 'shoulder_turn_deg', 'wrist_height_rel',
  ];

  for (const key of metricKeys) {
    const info = phase[key];
    if (!info || info.z_score == null || ['unreliable', '2D_limited', 'no_baseline'].includes(info.status)) {
      metrics.push({ label: METRIC_NAMES_KR[key] || key, score: 0.5 });
    } else {
      // z-score 0 = 1.0 (프로 수준), z-score 3+ = 0
      const score = Math.max(0, Math.min(1, 1 - Math.abs(info.z_score) / 3));
      metrics.push({ label: METRIC_NAMES_KR[key] || key, score });
    }
  }

  if (metrics.length < 3) return;

  const n = metrics.length;
  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2;

  // 그리드 (5단계)
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;
  for (let level = 1; level <= 5; level++) {
    const r = (R * level) / 5;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const angle = startAngle + i * angleStep;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // 축 라인
  for (let i = 0; i < n; i++) {
    const angle = startAngle + i * angleStep;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + R * Math.cos(angle), cy + R * Math.sin(angle));
    ctx.stroke();
  }

  // 데이터 영역
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const angle = startAngle + i * angleStep;
    const r = R * metrics[i].score;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(21, 101, 192, 0.2)';
  ctx.fill();
  ctx.strokeStyle = '#1565c0';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 데이터 포인트
  for (let i = 0; i < n; i++) {
    const angle = startAngle + i * angleStep;
    const r = R * metrics[i].score;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#1565c0';
    ctx.fill();
  }

  // 라벨
  ctx.fillStyle = '#424242';
  ctx.font = '11px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < n; i++) {
    const angle = startAngle + i * angleStep;
    const labelR = R + 18;
    const x = cx + labelR * Math.cos(angle);
    const y = cy + labelR * Math.sin(angle);
    ctx.fillText(metrics[i].label, x, y + 4);
  }
}

// ─────────────────────────────────────────────
// Skeleton Overlay (Feature 4)
// ─────────────────────────────────────────────
const SKELETON_CONNECTIONS = [
  [11, 13], [13, 15], // 왼팔 (어깨-팔꿈치-손목)
  [12, 14], [14, 16], // 오른팔
  [11, 12],           // 어깨
  [11, 23], [12, 24], // 몸통 (어깨-힙)
  [23, 24],           // 힙
  [23, 25], [25, 27], // 왼다리 (힙-무릎-발목)
  [24, 26], [26, 28], // 오른다리
];

// 골격 부위별 연관 지표
const CONNECTION_METRICS = {
  '11-13': 'left_arm_deg', '13-15': 'left_arm_deg',
  '12-14': 'left_arm_deg', '14-16': 'left_arm_deg',
  '11-23': 'spine_angle_deg', '12-24': 'spine_angle_deg',
  '23-25': 'left_knee_flex_deg', '25-27': 'left_knee_flex_deg',
  '24-26': 'left_knee_flex_deg', '26-28': 'left_knee_flex_deg',
  '11-12': 'shoulder_line_tilt_deg',
  '23-24': 'hip_line_tilt_deg',
};

function getConnectionColor(a, b, phaseRelative) {
  const key = `${Math.min(a,b)}-${Math.max(a,b)}`;
  const metric = CONNECTION_METRICS[key];
  if (!metric || !phaseRelative || !phaseRelative[metric]) return '#00ff00';

  const status = phaseRelative[metric].status;
  if (status === 'warning') return '#ff3333';
  if (status === 'caution') return '#ff9900';
  return '#00ff00';
}

function drawSkeleton(canvas, landmarks, phaseRelative) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  // 골격선
  ctx.lineWidth = 3;
  for (const [a, b] of SKELETON_CONNECTIONS) {
    const la = landmarks[a];
    const lb = landmarks[b];
    if (!la || !lb) continue;
    if ((la.visibility || 0) < 0.3 || (lb.visibility || 0) < 0.3) continue;

    ctx.strokeStyle = getConnectionColor(a, b, phaseRelative);
    ctx.beginPath();
    ctx.moveTo(la.x * w, la.y * h);
    ctx.lineTo(lb.x * w, lb.y * h);
    ctx.stroke();
  }

  // 관절점
  for (const idx of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
    const lm = landmarks[idx];
    if (!lm || (lm.visibility || 0) < 0.3) continue;
    ctx.beginPath();
    ctx.arc(lm.x * w, lm.y * h, 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function renderSkeletonOverlay(result) {
  const container = $('skeletonContainer');
  if (!container) return;

  const keyFrames = result.key_frame_landmarks;
  if (!keyFrames || Object.keys(keyFrames).length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  container.innerHTML = '';

  const video = els.videoPreview;
  const phaseLabels = {
    address: '어드레스',
    backswing_top: '백스윙 탑',
    impact: '임팩트',
  };

  const phaseOrder = ['address', 'backswing_top', 'impact'];
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex;gap:8px;overflow-x:auto;padding:4px 0;';

  for (const phase of phaseOrder) {
    const kf = keyFrames[phase];
    if (!kf) continue;

    const item = document.createElement('div');
    item.style.cssText = 'flex:1;min-width:0;text-align:center;';

    const label = document.createElement('div');
    label.textContent = phaseLabels[phase] || phase;
    label.style.cssText = 'font-size:12px;font-weight:600;color:var(--primary);margin-bottom:4px;';
    item.appendChild(label);

    const canvas = document.createElement('canvas');
    const canvasW = Math.min(180, video.videoWidth || 320);
    const canvasH = Math.round(canvasW * (video.videoHeight || 240) / (video.videoWidth || 320));
    canvas.width = canvasW;
    canvas.height = canvasH;
    canvas.style.cssText = 'width:100%;border-radius:8px;background:#1a1a1a;';
    item.appendChild(canvas);

    wrapper.appendChild(item);

    // 비디오에서 해당 프레임 캡처 후 골격 그리기
    const ctx = canvas.getContext('2d');
    const frameTime = kf.time;
    const landmarks = kf.landmarks;
    const phaseRelative = (result.relative_metrics || {})[phase] || {};

    // 비동기로 프레임 캡처
    captureFrameAndDraw(video, frameTime, canvas, landmarks, phaseRelative);
  }

  container.appendChild(wrapper);

  // 범례
  const legend = document.createElement('div');
  legend.className = 'skeleton-legend';
  legend.innerHTML = `
    <span><span class="dot green"></span>정상</span>
    <span><span class="dot orange"></span>주의</span>
    <span><span class="dot red"></span>경고</span>
  `;
  container.appendChild(legend);
}

async function captureFrameAndDraw(video, time, canvas, landmarks, phaseRelative) {
  const ctx = canvas.getContext('2d');
  const origTime = video.currentTime;
  const wasPaused = video.paused;

  try {
    video.currentTime = time;
    await new Promise((resolve) => {
      const handler = () => { video.removeEventListener('seeked', handler); resolve(); };
      video.addEventListener('seeked', handler);
    });

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 약간 어둡게 해서 골격선이 잘 보이게
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawSkeleton(canvas, landmarks, phaseRelative);
  } catch (e) {
    console.warn('프레임 캡처 실패:', e);
    // 프레임 캡처 실패 시 검은 배경에 골격만 그리기
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawSkeleton(canvas, landmarks, phaseRelative);
  }

  // 원래 위치로 복원
  video.currentTime = origTime;
}

// ─────────────────────────────────────────────
// Feedback Rating (Feature 3)
// ─────────────────────────────────────────────
function renderFeedbackRating() {
  // 기존 rating 요소가 있으면 제거
  const existing = $('feedbackRating');
  if (existing) existing.remove();

  const container = document.createElement('div');
  container.id = 'feedbackRating';
  container.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:12px;margin-top:16px;padding:12px;background:#f5f5f5;border-radius:8px;';

  container.innerHTML = `
    <span style="font-size:13px;color:var(--text-secondary);">이 피드백이 도움이 되었나요?</span>
    <button class="feedback-rate-btn" data-rating="up" style="background:none;border:1.5px solid #e0e0e0;border-radius:8px;padding:6px 16px;cursor:pointer;font-size:18px;transition:all 0.2s;">👍</button>
    <button class="feedback-rate-btn" data-rating="down" style="background:none;border:1.5px solid #e0e0e0;border-radius:8px;padding:6px 16px;cursor:pointer;font-size:18px;transition:all 0.2s;">👎</button>
  `;

  const feedbackCard = $('feedbackContent')?.closest('.card');
  if (feedbackCard) {
    feedbackCard.appendChild(container);
  }

  // 이벤트 바인딩
  container.querySelectorAll('.feedback-rate-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const rating = btn.dataset.rating;
      saveFeedbackRating(rating);

      // UI 반응
      container.innerHTML = `<span style="font-size:13px;color:var(--success);font-weight:600;">
        ${rating === 'up' ? '감사합니다! 다음에도 비슷한 스타일로 피드백하겠습니다.' : '감사합니다! 다음에는 더 나은 피드백을 드리겠습니다.'}
      </span>`;
    });
  });
}

// ─────────────────────────────────────────────
// Format AI Feedback (markdown-like → HTML)
// ─────────────────────────────────────────────
function formatFeedback(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/<\/ul>\s*<ul>/g, '')
    .replace(/\n{2,}/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

// ─────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────
function setupSettings() {
  $('btnSettings').addEventListener('click', () => {
    els.settingsModal.classList.add('visible');
    els.inputApiKey.value = localStorage.getItem('groq_api_key') || '';
  });

  $('btnCloseSettings').addEventListener('click', () => {
    els.settingsModal.classList.remove('visible');
  });

  $('btnSaveSettings').addEventListener('click', () => {
    const key = els.inputApiKey.value.trim();
    if (key) {
      localStorage.setItem('groq_api_key', key);
      showToast('API 키가 저장되었습니다.');
    } else {
      localStorage.removeItem('groq_api_key');
      showToast('API 키가 삭제되었습니다.');
    }
    els.settingsModal.classList.remove('visible');
  });

  // 설정 모달 외부 클릭으로 닫기
  els.settingsModal.addEventListener('click', (e) => {
    if (e.target === els.settingsModal) {
      els.settingsModal.classList.remove('visible');
    }
  });

  // feedbackNoKey 내 버튼
  $('btnSetApiKey')?.addEventListener('click', () => {
    els.settingsModal.classList.add('visible');
    els.inputApiKey.value = localStorage.getItem('groq_api_key') || '';
  });
}

// ─────────────────────────────────────────────
// Reset
// ─────────────────────────────────────────────
function setupReset() {
  $('btnReset').addEventListener('click', () => {
    removeVideo();
    analysisResult = null;
    els.resultsSection.classList.remove('visible');
    els.progressSection.classList.remove('visible');
    showToast('초기화 완료');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ─────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupVideoInput();
  setupHandedness();
  setupSettings();
  setupReset();

  els.btnAnalyze.addEventListener('click', runAnalysis);

  // Register SW
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // Init engine
  initEngine();
});
