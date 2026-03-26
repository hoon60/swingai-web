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
  els.videoInputArea.addEventListener('click', () => {
    els.videoFile.click();
  });

  els.videoFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    loadVideo(file);
  });

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
    // 영상 정보 표시
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
    els.videoInputArea.querySelector('.video-input-text').style.display = 'none';
    els.videoInputArea.querySelector('.video-input-sub').style.display = 'none';
    els.videoControls.classList.add('visible');
    els.btnAnalyze.disabled = false;
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

    // Step 4: AI 피드백 (비동기)
    const apiKey = localStorage.getItem('groq_api_key');
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
    els.metricsBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">데이터 없음</td></tr>';
    return;
  }

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
