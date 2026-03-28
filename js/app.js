/**
 * SwingAI v2.0 Web — Main App
 * UI 이벤트 바인딩 + 결과 렌더링 + 레이더 차트
 * + 3계층 학습 파이프라인 (수식 모델 -> Gemini 검증 -> TF.js 로컬 학습)
 */

import { SwingPoseEngine } from './pose-engine.js';
import { SwingAnalyzer, METRIC_NAMES_KR, CONCERN_KR } from './swing-analyzer.js';
import { generateFeedback } from './feedback.js';
import { GeminiVision } from './gemini-vision.js';
import { saveMathResult, saveGeminiResult, getLearningStats, predictPhaseIndices, resetLearningData, exportLearningData, importLearningData } from './swing-learning.js';
import { getTFModel } from './tf-model.js';

// ─────────────────────────────────────────────
// State
// ─────────────────────────────────────────────
let poseEngine = null;
let analyzer = new SwingAnalyzer();
let geminiVision = new GeminiVision();
let tfModel = getTFModel();
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
  // Trim controls
  trimControls: $('trimControls'),
  trimStart: $('trimStart'),
  trimEnd: $('trimEnd'),
  trimStartLabel: $('trimStartLabel'),
  trimEndLabel: $('trimEndLabel'),
  // Share
  shareCard: $('shareCard'),
  btnSaveImage: $('btnSaveImage'),
  btnShare: $('btnShare'),
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

    // 트림 컨트롤 표시
    showTrimControls(dur);

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
  hideTrimControls();
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
// Trim Controls (Feature 5)
// ─────────────────────────────────────────────
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function setupTrimControls() {
  const onSliderChange = () => {
    const video = els.videoPreview;
    if (!video || !video.duration) return;
    const dur = video.duration;

    let startPct = parseFloat(els.trimStart.value);
    let endPct = parseFloat(els.trimEnd.value);

    // 시작이 종료보다 크면 보정
    if (startPct >= endPct) {
      if (startPct === parseFloat(els.trimStart.value)) {
        endPct = Math.min(100, startPct + 0.1);
        els.trimEnd.value = endPct;
      } else {
        startPct = Math.max(0, endPct - 0.1);
        els.trimStart.value = startPct;
      }
    }

    const startSec = (startPct / 100) * dur;
    const endSec = (endPct / 100) * dur;

    els.trimStartLabel.textContent = formatTime(startSec);
    els.trimEndLabel.textContent = formatTime(endSec);

    // 슬라이더 조작 시 비디오 미리보기 이동
    video.currentTime = startSec;
  };

  els.trimStart.addEventListener('input', onSliderChange);
  els.trimEnd.addEventListener('input', onSliderChange);

  // 종료 슬라이더 조작 시에는 해당 위치로 이동
  els.trimEnd.addEventListener('input', () => {
    const video = els.videoPreview;
    if (!video || !video.duration) return;
    const endSec = (parseFloat(els.trimEnd.value) / 100) * video.duration;
    video.currentTime = endSec;
  });
}

function getTrimTimes() {
  const video = els.videoPreview;
  if (!video || !video.duration) return { startTime: 0, endTime: null };
  const dur = video.duration;
  const startTime = (parseFloat(els.trimStart.value) / 100) * dur;
  const endTime = (parseFloat(els.trimEnd.value) / 100) * dur;
  return { startTime, endTime };
}

function showTrimControls(duration) {
  els.trimControls.style.display = 'block';
  els.trimStart.value = 0;
  els.trimEnd.value = 100;
  els.trimStartLabel.textContent = formatTime(0);
  els.trimEndLabel.textContent = formatTime(duration);
}

function hideTrimControls() {
  els.trimControls.style.display = 'none';
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

    // 비디오 유효성 검증
    if (!video.duration || isNaN(video.duration) || video.duration === 0) {
      throw new Error('영상 길이를 읽을 수 없습니다. 다른 영상을 시도해주세요.');
    }

    // Step 1: 포즈 분석
    els.progressStep.textContent = '2/4: 포즈 감지';
    const { startTime, endTime } = getTrimTimes();
    const { frames, cameraView } = await poseEngine.analyzeVideo(video, {
      maxFrames: 200,
      handedness,
      startTime,
      endTime,
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
    window.__lastAnalysis = analysisResult;  // 디버그: 콘솔에서 접근 가능
    if (analysisResult._debug) console.log('[SwingAI Debug]', JSON.stringify(analysisResult._debug, null, 2));

    // ── Layer 1: 수식 모델 결과 학습 저장 ──────────────────
    const phaseIdx = analyzer._lastPhaseIndices;
    if (phaseIdx) {
      const topMetrics    = frames[phaseIdx.topIdx]?.metrics    || null;
      const impactMetrics = frames[phaseIdx.impactIdx]?.metrics || null;
      saveMathResult(cameraView, phaseIdx.n, phaseIdx.topIdx, phaseIdx.impactIdx, topMetrics);
    }

    // ── Layer 2: Gemini 백그라운드 검증 (비동기, UI 블록 없음) ──
    _runGeminiVerification(frames, cameraView, analysisResult).catch(e => console.warn('[Gemini bg]', e.message));

    // ── Layer 3: TF.js 학습 (데이터 10개 이상일 때 자동 실행) ──
    _runTFTrainingIfReady().catch(e => console.warn('[TF bg]', e.message));

    // Step 3: 결과 렌더링
    els.progressStep.textContent = '4/4: 결과 생성';
    els.progressBar.style.width = '100%';
    els.progressText.textContent = '완료!';

    renderResults(analysisResult);

    // 히스토리 저장
    saveAnalysisHistory(analysisResult);

    // Step 4-a: Gemini Vision 스윙 폼 분석 (Groq 피드백 전에 완료)
    els.feedbackLoading.style.display = 'block';
    els.feedbackText.textContent = 'AI 영상 분석 중...';
    els.feedbackNoKey.style.display = 'none';

    let geminiForm = null;
    try {
      const phIdx = analyzer._lastPhaseIndices;
      const video = els.videoPreview;
      const dur = video.duration;
      if (phIdx && phIdx.topIdx != null && phIdx.impactIdx != null
          && geminiVision.apiKey && dur && !isNaN(dur) && dur > 0 && frames.length > 0) {
        const toTime = idx => (idx / frames.length) * dur;
        const addrIdx = Math.max(0, (phIdx.addrEnd || 0) - 1);
        geminiForm = await geminiVision.analyzeSwingForm(
          video,
          toTime(addrIdx),
          toTime(phIdx.topIdx),
          toTime(phIdx.impactIdx),
          cameraView,
          club
        );
        if (geminiForm) {
          console.log('[Gemini Form]', geminiForm.key_issue_kr || '분석 완료');
        }
      }
    } catch (e) {
      console.warn('[Gemini Form]', e.message);
    }
    analysisResult.gemini_form = geminiForm;

    // Gemini 관찰로 레이더 차트 업데이트
    renderRadarChart(analysisResult);

    // Step 4-b: AI 피드백 (Groq LLM)
    els.feedbackText.textContent = 'AI 피드백 생성 중...';
    const _k = [77,89,65,117,108,65,92,73,115,70,110,125,102,109,127,115,111,96,127,28,114,66,65,124,125,109,78,83,72,25,108,115,126,83,109,29,28,110,91,93,72,82,104,70,70,18,71,77,99,88,28,127,27,88,92,25];
    const apiKey = localStorage.getItem('groq_api_key') || _k.map(c => String.fromCharCode(c ^ 42)).join('');
    if (apiKey) {
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
      els.feedbackLoading.style.display = 'none';
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
// Gemini Vision 비동기 검증 (백그라운드)
// ─────────────────────────────────────────────
// ── 3계층 백그라운드 파이프라인 ─────────────────────────────

async function _runGeminiVerification(frames, cameraView, result) {
  const phaseIdx = analyzer._lastPhaseIndices;
  if (!phaseIdx || !phaseIdx.topIdx || !phaseIdx.impactIdx) return;
  if (!geminiVision.apiKey) return;

  const video = els.videoPreview;
  const dur = video.duration;
  if (!dur || isNaN(dur) || dur === 0) return;
  if (!frames || frames.length === 0) return;

  const toTime = idx => (idx / frames.length) * dur;
  const { topIdx, impactIdx, n } = phaseIdx;

  // 백스윙 탑 후보 5개 캡처 후 검증
  const candidateIndices = [-2, -1, 0, 1, 2]
    .map(offset => topIdx + offset)
    .filter(i => i > 0 && i < impactIdx);

  if (candidateIndices.length === 0) return;

  try {
    const topRes = await geminiVision.verifyBackswingTop(video, { topIdx, totalFrames: n }, frames);
    if (!topRes || topRes.frameIndex == null) return;

    const newTopIdx = topRes.frameIndex;
    const topCorrected = Math.abs(newTopIdx - topIdx) > 1;

    const topMetrics    = frames[newTopIdx]?.metrics    || null;
    const impactMetrics = frames[impactIdx]?.metrics    || null;
    saveGeminiResult(cameraView, n, newTopIdx, impactIdx, topMetrics, impactMetrics, topCorrected);

    if (topCorrected) {
      showToast('AI가 백스윙 탑 단계를 보정했습니다. 다음 분석에 반영됩니다.', 4000);
      updateLearningBadge();
    }
  } catch (e) {
    console.warn('[Gemini Verify]', e.message);
  }
}

async function _runTFTrainingIfReady() {
  if (!tfModel.isReady && !(await tfModel.loadOrInit().catch(() => false))) return;
  const { getTFTrainingData } = await import('./swing-learning.js');
  const data = getTFTrainingData();
  if (!tfModel.canTrain(data)) return;

  console.log('[TFModel] 학습 시작, samples:', data.length);
  const result = await tfModel.train(data, (ep, total, loss) => {
    if (ep === total) console.log('[TFModel] 학습 완료, loss:', loss.toFixed(5));
  });
  showToast('AI 모델 학습 완료 (loss: ' + result.loss.toFixed(4) + ')', 3000);
  updateLearningBadge();
}

function updateLearningBadge() {
  const stats = getLearningStats();
  const badge = document.getElementById('learningBadge');
  if (!badge) return;
  const stageMap = { cold_start: '🌱 학습 시작', prior_only: '📊 Prior 학습', knn_warming: '🧠 K-NN 준비중', knn_active: '🚀 K-NN 활성' };
  badge.textContent = stageMap[stats.stage] || stats.stage;
  badge.title = '총 ' + stats.totalSwings + '회 분석 | Gemini ' + stats.geminiCalls + '회 검증 | K-NN ' + stats.knnCount + '개';

  const detailEl = document.getElementById('learningDetail');
  if (detailEl) {
    detailEl.innerHTML =
      '<div>총 분석: <b>' + stats.totalSwings + '회</b></div>' +
      '<div>Gemini 검증: <b>' + stats.geminiCalls + '회</b> (보정: ' + stats.geminiCorrections + '회)</div>' +
      '<div>K-NN 데이터: <b>' + stats.knnCount + '개</b> (Gemini확인: ' + stats.geminiKnnCount + '개)</div>' +
      '<div>TF.js 학습: <b>' + stats.tfCount + '개</b> 라벨</div>' +
      '<div>학습 단계: <b>' + (stageMap[stats.stage] || stats.stage) + '</b></div>';
  }
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

  // 핵심 개선 포인트 요약
  renderKeyInsights(result);

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

  // Share card
  if (els.shareCard) els.shareCard.style.display = 'block';

  // Scroll to results
  setTimeout(() => {
    els.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 200);
}

function renderKeyInsights(result) {
  const container = document.getElementById('keyInsights');
  if (!container) return;

  const insights = [];
  const METRIC_KR = {
    spine_angle_deg: '허리 숙임', left_arm_deg: '왼팔 직선도',
    left_knee_flex_deg: '무릎 각도', wrist_height_rel: '손 높이',
    weight_dist: '체중 이동',
  };

  // 가장 문제되는 지표 2~3개 찾기
  const allMetrics = [];
  for (const [phase, metrics] of Object.entries(result.relative_metrics || {})) {
    for (const [key, val] of Object.entries(metrics)) {
      if (val.status === 'warning' || val.status === 'caution') {
        allMetrics.push({ phase, key, ...val });
      }
    }
  }
  // warning 우선, caution 다음
  allMetrics.sort((a, b) => (a.status === 'warning' ? 0 : 1) - (b.status === 'warning' ? 0 : 1));

  if (allMetrics.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:16px;color:#2e7d32;font-weight:600;">✅ 전반적으로 좋은 스윙입니다! 현재 자세를 유지하세요.</div>';
    container.style.display = 'block';
    return;
  }

  const comments = {
    left_arm_deg: { caution: '왼팔이 약간 구부러져 있어요', warning: '왼팔을 더 펴면 비거리가 늘어납니다' },
    left_knee_flex_deg: { caution: '무릎 각도를 조금 조절해보세요', warning: '무릎 자세에 주의가 필요합니다' },
    wrist_height_rel: { caution: '손 위치를 조금 조절해보세요', warning: '백스윙 시 손을 더 높이 올려보세요' },
    spine_angle_deg: { caution: '허리 숙임을 약간 조절해보세요', warning: '허리 각도에 주의하세요. 부상 위험' },
    weight_dist: { caution: '체중 이동을 의식해보세요', warning: '체중 이동이 부족합니다' },
  };

  let html = '<div style="padding:4px 0;">';
  const top = allMetrics.slice(0, 3);
  for (const m of top) {
    const name = METRIC_KR[m.key] || m.key;
    const comment = comments[m.key]?.[m.status] || `${name}을(를) 개선해보세요`;
    const icon = m.status === 'warning' ? '🔴' : '🟡';
    const diffStr = m.diff_pct != null ? `(프로 대비 ${m.diff_pct > 0 ? '+' : ''}${m.diff_pct.toFixed(0)}%)` : '';
    html += `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f0f0f0;">
      <span style="font-size:20px;">${icon}</span>
      <div>
        <div style="font-weight:600;font-size:14px;">${comment}</div>
        <div style="font-size:12px;color:#999;">${name} ${diffStr}</div>
      </div>
    </div>`;
  }

  // 강점 찾기
  const normals = [];
  for (const [phase, metrics] of Object.entries(result.relative_metrics || {})) {
    for (const [key, val] of Object.entries(metrics)) {
      if (val.status === 'normal' && METRIC_KR[key]) {
        normals.push(key);
      }
    }
  }
  if (normals.length > 0) {
    const strengthNames = [...new Set(normals)].slice(0, 2).map(k => METRIC_KR[k]).join(', ');
    html += `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;">
      <span style="font-size:20px;">💪</span>
      <div>
        <div style="font-weight:600;font-size:14px;color:#2e7d32;">강점: ${strengthNames}</div>
        <div style="font-size:12px;color:#999;">프로 수준에 가깝습니다</div>
      </div>
    </div>`;
  }

  html += '</div>';
  container.innerHTML = html;
  container.style.display = 'block';
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
    if (['no_baseline', '2D_limited', 'unreliable'].includes(info.status)) continue;
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

  if (rows.length === 0) {
    rows.push('<tr><td colspan="6" style="text-align:center;color:#999;">분석 가능한 지표 없음</td></tr>');
  }
  els.metricsBody.innerHTML = rows.join('');

  // DTL 뷰 안내 메시지
  const view = result.metadata?.camera_view;
  const noteEl = document.getElementById('metricsViewNote');
  if (noteEl) {
    if (view === 'down_the_line') {
      noteEl.textContent = '측면(DTL) 뷰: 2D 투영 특성상 3개 지표만 신뢰도 높게 측정됩니다. 정면(Face-on) 뷰로 촬영 시 더 많은 지표를 분석할 수 있습니다.';
      noteEl.style.display = 'block';
    } else {
      noteEl.style.display = 'none';
    }
  }
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

  // 데이터 수집 (backswing_top 기준) — 뷰에 따라 축 동적 결정
  const phase = result.relative_metrics.backswing_top || result.relative_metrics.address || {};
  const metrics = [];
  const view = result.metadata?.camera_view;

  let metricKeys;
  if (view === 'down_the_line') {
    metricKeys = ['left_arm_deg', 'left_knee_flex_deg', 'wrist_height_rel'];
  } else {
    metricKeys = [
      'spine_angle_deg', 'left_arm_deg', 'left_knee_flex_deg',
      'x_factor_deg', 'shoulder_turn_deg', 'wrist_height_rel',
    ];
  }

  for (const key of metricKeys) {
    const info = phase[key];
    if (!info || info.z_score == null || ['unreliable', '2D_limited', 'no_baseline'].includes(info.status)) {
      metrics.push({ label: METRIC_NAMES_KR[key] || key, score: 0.5 });
    } else {
      const score = Math.max(0, Math.min(1, 1 - Math.abs(info.z_score) / 3));
      metrics.push({ label: METRIC_NAMES_KR[key] || key, score });
    }
  }

  // DTL: Gemini Vision 관찰 결과를 레이더 축에 추가
  if (view === 'down_the_line' && result.gemini_form?.observations) {
    for (const obs of result.gemini_form.observations) {
      const score = obs.rating === 'good' ? 0.85 : obs.rating === 'caution' ? 0.5 : 0.15;
      metrics.push({ label: obs.aspect_kr || obs.aspect, score });
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
// Share & Save Image (Feature 6)
// ─────────────────────────────────────────────
function saveAsImage() {
  if (!analysisResult) return;

  const r = analysisResult;
  const lv = r.user_level || {};
  const score = r.overall_score || 0;
  const clubMap = { driver: '드라이버', iron: '아이언', wedge: '웨지', putter: '퍼터' };
  const viewMap = { face_on: '정면', down_the_line: '후방' };
  const lvKr = lv.level_kr || '중급';
  const clubKr = clubMap[r.metadata.club] || r.metadata.club;
  const viewKr = viewMap[r.metadata.camera_view] || r.metadata.camera_view;

  // 주요 지표 3개 수집
  const topMetrics = [];
  const phases = ['backswing_top', 'address', 'impact'];
  for (const phase of phases) {
    const rel = r.relative_metrics[phase];
    if (!rel) continue;
    for (const [key, info] of Object.entries(rel)) {
      if (topMetrics.length >= 3) break;
      if (info.value != null && !['unreliable', '2D_limited', 'no_baseline'].includes(info.status)) {
        topMetrics.push({ name: METRIC_NAMES_KR[key] || key, value: info.value, status: info.status });
      }
    }
    if (topMetrics.length >= 3) break;
  }

  // Canvas로 카드 이미지 생성
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');

  // 배경
  const grad = ctx.createLinearGradient(0, 0, 600, 400);
  grad.addColorStop(0, '#1565c0');
  grad.addColorStop(1, '#0d47a1');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 600, 400);

  // 카드 영역
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  roundRect(ctx, 30, 30, 540, 340, 16);
  ctx.fill();

  // 타이틀
  ctx.fillStyle = '#1565c0';
  ctx.font = 'bold 22px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SwingAI 분석 결과', 60, 75);

  // 레벨 뱃지
  const lvColors = { beginner: '#e3f2fd', intermediate: '#fff3e0', advanced: '#e8f5e9' };
  const lvTextColors = { beginner: '#1565c0', intermediate: '#ff6f00', advanced: '#2e7d32' };
  ctx.fillStyle = lvColors[lv.level] || '#fff3e0';
  roundRect(ctx, 60, 90, 120, 30, 15);
  ctx.fill();
  ctx.fillStyle = lvTextColors[lv.level] || '#ff6f00';
  ctx.font = 'bold 14px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(lvKr, 120, 110);

  // 점수 원
  ctx.beginPath();
  ctx.arc(480, 105, 40, 0, 2 * Math.PI);
  ctx.fillStyle = '#e3f2fd';
  ctx.fill();
  ctx.fillStyle = '#1565c0';
  ctx.font = 'bold 28px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(score), 480, 115);
  ctx.fillStyle = '#757575';
  ctx.font = '11px -apple-system, sans-serif';
  ctx.fillText('종합점수', 480, 155);

  // 클럽 / 뷰
  ctx.fillStyle = '#424242';
  ctx.font = '14px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`클럽: ${clubKr}  |  뷰: ${viewKr}`, 60, 150);

  // 구분선
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, 170);
  ctx.lineTo(540, 170);
  ctx.stroke();

  // 주요 지표
  ctx.fillStyle = '#1565c0';
  ctx.font = 'bold 15px -apple-system, sans-serif';
  ctx.fillText('주요 지표', 60, 200);

  topMetrics.forEach((m, i) => {
    const y = 230 + i * 40;
    const statusColors = { normal: '#2e7d32', caution: '#f57f17', warning: '#c62828' };
    ctx.fillStyle = statusColors[m.status] || '#757575';
    ctx.beginPath();
    ctx.arc(70, y - 4, 5, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = '#424242';
    ctx.font = '14px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(m.name, 85, y);
    ctx.fillStyle = '#212121';
    ctx.font = 'bold 14px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    const val = typeof m.value === 'number' ? m.value.toFixed(1) : m.value;
    ctx.fillText(String(val), 540, y);
  });

  // 워터마크
  ctx.fillStyle = '#bdbdbd';
  ctx.font = '11px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SwingAI v2.0 - AI 골프 스윙 분석', 300, 365);

  // PNG로 저장
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `swingai-result-${new Date().toISOString().slice(0,10)}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('이미지가 저장되었습니다.');
  }, 'image/png');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function getShareUrl() {
  if (!analysisResult) return window.location.href;
  const r = analysisResult;
  const params = new URLSearchParams();
  params.set('score', r.overall_score || 0);
  params.set('level', r.user_level?.level || 'intermediate');
  params.set('club', r.metadata.club || 'driver');
  params.set('view', r.metadata.camera_view === 'down_the_line' ? 'dtl' : 'fo');

  // 템포
  if (r.tempo && r.tempo.tempo_ratio != null) {
    params.set('tr', r.tempo.tempo_ratio);
  }

  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

function shareResult() {
  const url = getShareUrl();
  const r = analysisResult;
  const lvKr = r?.user_level?.level_kr || '중급';
  const score = r?.overall_score || 0;
  const title = 'SwingAI 스윙 분석 결과';
  const text = `${lvKr} | 종합점수 ${score}점 - SwingAI로 분석한 내 스윙`;

  if (navigator.share) {
    navigator.share({ title, text, url }).catch(() => {
      copyToClipboard(url);
    });
  } else {
    copyToClipboard(url);
  }
}

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('링크가 복사되었습니다.');
    }).catch(() => {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;left:-9999px;';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  showToast('링크가 복사되었습니다.');
}

function setupShareButtons() {
  els.btnSaveImage?.addEventListener('click', saveAsImage);
  els.btnShare?.addEventListener('click', shareResult);
}

// URL 파라미터로 공유된 결과 표시
function checkSharedResult() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('score')) return;

  const score = parseInt(params.get('score'), 10) || 0;
  const level = params.get('level') || 'intermediate';
  const club = params.get('club') || 'driver';
  const view = params.get('view') === 'dtl' ? 'down_the_line' : 'face_on';
  const tempoRatio = params.get('tr') ? parseFloat(params.get('tr')) : null;

  const lvMap = { beginner: '초급', intermediate: '중급', advanced: '상급' };
  const clubMap = { driver: '드라이버', iron: '아이언', wedge: '웨지', putter: '퍼터' };
  const viewMap = { face_on: '정면 (Face On)', down_the_line: '후방 (DTL)' };

  // 간단한 결과 표시
  els.resultsSection.classList.add('visible');

  const lvClass = level;
  const lvEmoji = { beginner: '🏌️', intermediate: '⛳', advanced: '🏆' };
  els.levelBadge.className = `level-badge ${lvClass}`;
  els.levelBadge.textContent = `${lvEmoji[lvClass] || ''} ${lvMap[level] || '중급'}`;

  els.scoreCircle.textContent = score;
  els.detectedView.textContent = viewMap[view] || view;
  els.detectedClub.textContent = clubMap[club] || club;

  if (tempoRatio != null) {
    els.tempoRatio.textContent = `${tempoRatio}:1`;
  }

  // 공유된 결과임을 표시
  const sharedNote = document.createElement('div');
  sharedNote.style.cssText = 'text-align:center;padding:12px;color:var(--text-secondary);font-size:13px;';
  sharedNote.textContent = '공유된 분석 결과입니다. 직접 분석하려면 영상을 업로드하세요.';
  els.resultsSection.insertBefore(sharedNote, els.resultsSection.firstChild);
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

  // 학습 현황 모달
  $('btnLearning')?.addEventListener('click', () => {
    updateLearningBadge();
    $('learningModal').classList.add('visible');
  });
  $('btnCloseLearning')?.addEventListener('click', () => {
    $('learningModal').classList.remove('visible');
  });
  $('learningModal')?.addEventListener('click', (e) => {
    if (e.target === $('learningModal')) $('learningModal').classList.remove('visible');
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
  setupTrimControls();
  setupSettings();
  setupReset();
  setupShareButtons();

  els.btnAnalyze.addEventListener('click', runAnalysis);

  // URL 파라미터로 공유된 결과 확인
  checkSharedResult();

  // Register SW
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // Init engine
  initEngine();

  // 학습 시스템 초기화
  updateLearningBadge();
  tfModel.loadOrInit().then(loaded => {
    if (loaded) console.log('[TFModel] 기존 학습 모델 로드됨');
  }).catch(() => {});

  // 학습 데이터 내보내기/가져오기 버튼
  document.getElementById('btnExportLearning')?.addEventListener('click', exportLearningData);
  document.getElementById('btnImportLearning')?.addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const result = await importLearningData(file);
      showToast('학습 데이터 가져오기 완료: ' + result.swings + '회 분석 데이터', 3000);
      updateLearningBadge();
    } catch(err) { showToast('가져오기 실패: ' + err.message, 4000); }
    e.target.value = '';
  });
  document.getElementById('btnResetLearning')?.addEventListener('click', () => {
    if (confirm('모든 학습 데이터를 초기화할까요?')) { resetLearningData(); updateLearningBadge(); showToast('학습 데이터 초기화 완료'); }
  });
});
