/**
 * SwingAI 자가학습 시스템 v2.0
 * Layer A: 베이지안 Prior
 * Layer B: K-NN 분류기 (Gemini 확인 데이터 2배 가중)
 * Layer C: TF.js 학습 데이터 축적
 * 저장: localStorage
 */

const STORAGE_KEY = 'swingai_v2_learning';
const MAX_KNN = 150;
const KNN_K   = 5;

const DEFAULT_PRIOR = {
  face_on:       { topRatioMean: 0.40, topRatioStd: 0.10, impactRatioMean: 0.65, impactRatioStd: 0.10, count: 0 },
  down_the_line: { topRatioMean: 0.42, topRatioStd: 0.10, impactRatioMean: 0.67, impactRatioStd: 0.10, count: 0 },
};

function loadData() { try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; } catch { return null; } }
function saveData(d) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch(e) { console.warn('[SwingLearning] save:', e.message); } }
function initData() { return { version: 2, prior: JSON.parse(JSON.stringify(DEFAULT_PRIOR)), knn: [], tfReady: [], totalSwings: 0, geminiCalls: 0, geminiCorrections: 0 }; }
function getData() {
  const d = loadData();
  if (!d || d.version !== 2) return initData();
  if (!d.prior) d.prior = JSON.parse(JSON.stringify(DEFAULT_PRIOR));
  if (!d.knn) d.knn = [];
  if (!d.tfReady) d.tfReady = [];
  return d;
}
function euclidean(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i]-b[i])**2; return Math.sqrt(s); }

const _NORM_KEYS = ['wrist_height_rel','x_factor_deg','shoulder_turn_deg','spine_angle_deg','shoulder_line_tilt_deg','hip_line_tilt_deg','left_arm_deg','left_knee_flex_deg'];
const _NORM_RANGE = { wrist_height_rel:[0.2,1.0],x_factor_deg:[0,60],shoulder_turn_deg:[0,90],spine_angle_deg:[0,45],shoulder_line_tilt_deg:[-30,30],hip_line_tilt_deg:[-20,25],left_arm_deg:[140,180],left_knee_flex_deg:[150,185] };

export function metricsToVec(m) {
  if (!m) return null;
  return _NORM_KEYS.map(k => {
    const v = m[k]; if (v == null || isNaN(v)) return 0.5;
    const [lo, hi] = _NORM_RANGE[k]; return Math.max(0, Math.min(1, (v-lo)/(hi-lo+1e-8)));
  });
}

export function exportLearningData() {
  const blob = new Blob([JSON.stringify(getData(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url;
  a.download = 'swingai_learning_' + new Date().toISOString().slice(0,10) + '.json'; a.click(); URL.revokeObjectURL(url);
}

export function importLearningData(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imp = JSON.parse(e.target.result);
        if (!imp.version || !imp.prior) throw new Error('invalid');
        const cur = getData();
        const merged = { ...cur, prior: imp.prior, knn: [...cur.knn,...(imp.knn||[])].slice(-MAX_KNN), tfReady: [...cur.tfReady,...(imp.tfReady||[])].slice(-200), totalSwings: cur.totalSwings+(imp.totalSwings||0), geminiCalls: cur.geminiCalls+(imp.geminiCalls||0), geminiCorrections: cur.geminiCorrections+(imp.geminiCorrections||0) };
        saveData(merged); res({ knnCount: merged.knn.length, swings: merged.totalSwings });
      } catch(e) { rej(e); }
    };
    reader.onerror = () => rej(new Error('read error')); reader.readAsText(file);
  });
}

export function getPriorPrediction(view) {
  const d = getData(); const v = view === 'down_the_line' ? 'down_the_line' : 'face_on'; const p = d.prior[v] || DEFAULT_PRIOR[v];
  return { topRatioMean: p.topRatioMean, topRatioStd: Math.max(0.03, p.topRatioStd), impactRatioMean: p.impactRatioMean, impactRatioStd: Math.max(0.03, p.impactRatioStd), count: p.count };
}

function updatePrior(view, topRatio, impactRatio, weight) {
  const d = getData(); const v = view === 'down_the_line' ? 'down_the_line' : 'face_on'; const p = d.prior[v];
  const alpha = (weight||1) / (p.count*0.3 + (weight||1));
  p.topRatioMean    = p.topRatioMean    * (1-alpha) + topRatio    * alpha;
  p.impactRatioMean = p.impactRatioMean * (1-alpha) + impactRatio * alpha;
  const beta = 0.15;
  p.topRatioStd    = Math.max(0.03, Math.min(0.20, Math.sqrt((1-beta)*p.topRatioStd**2    + beta*(topRatio   -p.topRatioMean)**2)));
  p.impactRatioStd = Math.max(0.03, Math.min(0.20, Math.sqrt((1-beta)*p.impactRatioStd**2 + beta*(impactRatio-p.impactRatioMean)**2)));
  p.count += 1; saveData(d);
}

function knnPredict(vec, view) {
  const d = getData();
  const entries = d.knn.filter(e => e.view === view && e.vec && e.vec.length === vec.length);
  if (entries.length < 3) return null;
  const dists = entries.map(e => ({ dist: euclidean(vec,e.vec), topRatio:e.topRatio, impactRatio:e.impactRatio, w: e.source==='gemini' ? 2.0 : 1.0 }));
  dists.sort((a,b) => a.dist-b.dist);
  const nb = dists.slice(0, Math.min(KNN_K, dists.length));
  const inv = nb.map(n => n.w/(n.dist+1e-6)); const tw = inv.reduce((a,b) => a+b, 0);
  return { topRatio: nb.reduce((s,n,i) => s+n.topRatio*inv[i], 0)/tw, impactRatio: nb.reduce((s,n,i) => s+n.impactRatio*inv[i], 0)/tw, neighborCount: nb.length, minDist: nb[0].dist };
}

export function predictPhaseIndices(n, view, metrics) {
  const prior = getPriorPrediction(view); let knn = null;
  if (metrics) { const vec = metricsToVec(metrics); if (vec) knn = knnPredict(vec, view); }
  let topRatio, impactRatio, source, confidence;
  if (knn && knn.neighborCount >= 3 && knn.minDist < 0.5) {
    const kw = Math.min(0.7, 0.3 + knn.neighborCount*0.05);
    topRatio = knn.topRatio*kw + prior.topRatioMean*(1-kw);
    impactRatio = knn.impactRatio*kw + prior.impactRatioMean*(1-kw);
    source = 'prior+knn'; confidence = 0.6 + kw*0.3;
  } else {
    topRatio = prior.topRatioMean; impactRatio = prior.impactRatioMean;
    source = prior.count > 0 ? 'prior' : 'default';
    confidence = prior.count > 0 ? Math.min(0.7, 0.3+prior.count*0.02) : 0.2;
  }
  return { topIdx: Math.round(n*topRatio), impactIdx: Math.round(n*impactRatio), topRatio, impactRatio, confidence, source };
}

function storeKNN(d, view, vec, topRatio, impactRatio, source, label) {
  if (!vec) return;
  d.knn.push({ view, vec, topRatio, impactRatio, source, label, ts: Date.now() });
  if (d.knn.length > MAX_KNN) { const mi = d.knn.findIndex(e => e.source==='math'); d.knn.splice(mi!==-1?mi:0, 1); }
}

export function saveMathResult(view, n, topIdx, impactIdx, metrics) {
  if (n <= 0) return;
  const topRatio = topIdx/n, impactRatio = impactIdx/n;
  const d = getData(); d.totalSwings += 1;
  updatePrior(view, topRatio, impactRatio, 0.5);
  storeKNN(d, view, metricsToVec(metrics), topRatio, impactRatio, 'math', null);
  d.tfReady.push({ view, topRatio, impactRatio, n, vec: metricsToVec(metrics), source: 'math', ts: Date.now() });
  if (d.tfReady.length > 200) d.tfReady.shift();
  saveData(d);
}

export function saveGeminiResult(view, n, topIdx, impactIdx, topMetrics, impactMetrics, wasCorrected) {
  if (n <= 0) return;
  const topRatio = topIdx/n, impactRatio = impactIdx/n;
  const d = getData(); d.geminiCalls += 1; if (wasCorrected) d.geminiCorrections += 1;
  updatePrior(view, topRatio, impactRatio, wasCorrected ? 2.0 : 1.5);
  storeKNN(d, view, metricsToVec(topMetrics),    topRatio, impactRatio, 'gemini', 'backswing_top');
  storeKNN(d, view, metricsToVec(impactMetrics), topRatio, impactRatio, 'gemini', 'impact');
  d.tfReady.push({ view, topRatio, impactRatio, n, vec: metricsToVec(topMetrics), source: 'gemini', confirmed: true, ts: Date.now() });
  if (d.tfReady.length > 200) d.tfReady.shift();
  saveData(d);
}

export function getLearningStats() {
  const d = getData(); const fo = d.prior.face_on, dtl = d.prior.down_the_line;
  const gk = d.knn.filter(e => e.source==='gemini').length;
  return {
    totalSwings: d.totalSwings, geminiCalls: d.geminiCalls, geminiCorrections: d.geminiCorrections,
    knnCount: d.knn.length, geminiKnnCount: gk, tfCount: d.tfReady.length, tfGeminiCount: d.tfReady.filter(e => e.source==='gemini').length,
    prior: { face_on: { topRatioMean: +(fo.topRatioMean*100).toFixed(1), impactRatioMean: +(fo.impactRatioMean*100).toFixed(1), count: fo.count }, down_the_line: { topRatioMean: +(dtl.topRatioMean*100).toFixed(1), impactRatioMean: +(dtl.impactRatioMean*100).toFixed(1), count: dtl.count } },
    stage: gk >= 10 ? 'knn_active' : d.knn.length >= 3 ? 'knn_warming' : d.totalSwings > 0 ? 'prior_only' : 'cold_start',
  };
}

export function resetLearningData() { saveData(initData()); }
export function getTFTrainingData() {
  const d = getData();
  return [...d.tfReady.filter(e => e.source==='gemini'), ...d.tfReady.filter(e => e.source==='math')].slice(0, 100);
}
