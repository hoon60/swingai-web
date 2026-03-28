/**
 * SwingAI TensorFlow.js 로컬 학습 모델 v1.0
 *
 * 아키텍처: Dense(32) -> Dense(16) -> Dense(2, sigmoid)
 * 입력: 8개 지표 정규화 벡터
 * 출력: [topRatio, impactRatio]
 * 저장: IndexedDB (swingai-phase-model-v1)
 */

const MODEL_KEY = 'indexeddb://swingai-phase-model-v1';
const MIN_TRAIN  = 10;
const INPUT_DIM  = 8;

let _tf = null;
async function getTF() {
  if (_tf) return _tf;
  try {
    _tf = await import('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.esm.js');
  } catch {
    if (window.tf) { _tf = window.tf; return _tf; }
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js';
      s.onload = () => { _tf = window.tf; res(); };
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  return _tf;
}

const NORM = {
  wrist_height_rel:[0.2,1.0], x_factor_deg:[0,60], shoulder_turn_deg:[0,90],
  spine_angle_deg:[0,45], shoulder_line_tilt_deg:[-30,30], hip_line_tilt_deg:[-20,25],
  left_arm_deg:[140,180], left_knee_flex_deg:[150,185],
};
const KEYS = Object.keys(NORM);

export function tfMetricsToVec(m) {
  if (!m) return null;
  return KEYS.map(k => {
    const v = m[k];
    if (v == null || isNaN(v)) return 0.5;
    const [lo, hi] = NORM[k];
    return Math.max(0, Math.min(1, (v - lo) / (hi - lo + 1e-8)));
  });
}

export class TFPhaseModel {
  constructor() { this._model = null; this._ready = false; this._training = false; this.lossHistory = []; this.trainCount = 0; }
  get isReady() { return this._ready && this._model !== null && this.trainCount > 0; }

  async loadOrInit() {
    try {
      const tf = await getTF();
      try {
        this._model = await tf.loadLayersModel(MODEL_KEY);
        this._ready = true;
        // infer trainCount from model metadata if possible
        this.trainCount = 1;
        console.log('[TFModel] loaded from IndexedDB');
        return true;
      } catch {
        this._model = this._build(tf);
        this._ready = true;
        console.log('[TFModel] new model created');
        return false;
      }
    } catch(e) { console.warn('[TFModel] TF.js load fail:', e.message); this._ready = false; return false; }
  }

  _build(tf) {
    const m = tf.sequential();
    m.add(tf.layers.dense({ units: 32, activation: 'relu', inputShape: [INPUT_DIM] }));
    m.add(tf.layers.dropout({ rate: 0.2 }));
    m.add(tf.layers.dense({ units: 16, activation: 'relu' }));
    m.add(tf.layers.dense({ units: 2,  activation: 'sigmoid' }));
    m.compile({ optimizer: tf.train.adam(0.003), loss: 'meanSquaredError', metrics: ['mae'] });
    return m;
  }

  canTrain(data) {
    if (!this._ready || this._training) return false;
    return (data || []).filter(e => e.source === 'gemini').length >= MIN_TRAIN;
  }

  async train(data, onProgress) {
    if (!this.canTrain(data)) throw new Error('not enough data');
    this._training = true;
    try {
      const tf = await getTF();
      const gemini = data.filter(e => e.source === 'gemini');
      const math   = data.filter(e => e.source === 'math').slice(0, gemini.length * 2);
      const all    = [...gemini, ...gemini, ...math];
      const xs = [], ys = [];
      for (const entry of all) {
        const vec = entry.vec || this._synVec(entry.topRatio, entry.impactRatio);
        if (!vec || vec.length !== INPUT_DIM) continue;
        xs.push(vec); ys.push([entry.topRatio, entry.impactRatio]);
      }
      if (xs.length < MIN_TRAIN) throw new Error('insufficient valid samples');
      const xT = tf.tensor2d(xs), yT = tf.tensor2d(ys);
      const epochs = Math.min(60, 10 + Math.floor(xs.length / 3));
      let lastLoss = Infinity;
      await this._model.fit(xT, yT, {
        epochs, batchSize: Math.min(16, xs.length), validationSplit: 0.15, shuffle: true,
        callbacks: {
          onEpochEnd: async (ep, logs) => {
            lastLoss = logs.loss; this.lossHistory.push(+lastLoss.toFixed(5));
            if (onProgress) onProgress(ep + 1, epochs, lastLoss);
            await tf.nextFrame();
          }
        }
      });
      xT.dispose(); yT.dispose();
      await this._model.save(MODEL_KEY);
      this.trainCount += 1;
      return { loss: lastLoss, epochs, samples: xs.length };
    } finally { this._training = false; }
  }

  _synVec(topRatio, impactRatio) {
    return [
      0.3 + topRatio * 0.4, topRatio * 0.5, topRatio * 0.6, 0.45,
      0.5 + (topRatio - 0.4) * 0.3, 0.5 + (impactRatio - 0.6) * 0.2, 0.88, 0.75,
    ];
  }

  async predict(vec) {
    if (!this.isReady || !vec || vec.length !== INPUT_DIM) return null;
    try {
      const tf = await getTF();
      const inp = tf.tensor2d([vec]);
      const out = this._model.predict(inp);
      const vals = await out.data();
      inp.dispose(); out.dispose();
      return { topRatio: Math.max(0.2, Math.min(0.65, vals[0])), impactRatio: Math.max(0.45, Math.min(0.90, vals[1])) };
    } catch(e) { console.warn('[TFModel] predict:', e.message); return null; }
  }

  async reset() {
    try { const tf = await getTF(); await tf.io.removeModel(MODEL_KEY); } catch {}
    this._model = null; this._ready = false; this.lossHistory = []; this.trainCount = 0;
  }
}

let _inst = null;
export function getTFModel() { if (!_inst) _inst = new TFPhaseModel(); return _inst; }
