/**
 * SwingAI Self-Learning Module v1.0
 * 사용자의 스윙 분석 결과를 학습하여 페이즈 감지 정확도를 점진적으로 개선
 *
 * 저장 데이터:
 *   - 확정된 페이즈 위치 (비율 기반, 영상 길이 무관)
 *   - Gemini 확정 클럽 감지 결과
 *   - 최근 20개 페이즈 / 30개 클럽 데이터 유지
 *
 * 모든 데이터는 localStorage에 저장되며 서버 불필요
 */

export class SwingLearning {
  constructor() {
    this.storageKey = 'swingai_learning_data';
    this.data = this._load();
  }

  /**
   * localStorage에서 학습 데이터 로드
   */
  _load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  /**
   * localStorage에 학습 데이터 저장
   */
  _save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    } catch (e) {
      console.warn('[SwingLearning] 저장 실패:', e);
    }
  }

  /**
   * 확정된 페이즈 결과 저장
   * 비율로 저장하여 영상 길이에 무관하게 패턴 학습
   *
   * @param {string} cameraView - 'face_on' | 'down_the_line'
   * @param {number} totalFrames - 전체 프레임 수
   * @param {number} addressIdx - 어드레스 인덱스 (현재는 사용하지 않지만 확장 대비)
   * @param {number} topIdx - 백스윙 탑 인덱스
   * @param {number} impactIdx - 임팩트 인덱스
   * @param {string} source - 'math' | 'gemini' | 'user' — 확정 출처
   */
  saveConfirmedPhases(cameraView, totalFrames, addressIdx, topIdx, impactIdx, source = 'math') {
    if (!totalFrames || totalFrames < 10) return;

    const entry = {
      view: cameraView,
      topRatio: topIdx / totalFrames,
      impactRatio: impactIdx / totalFrames,
      source,
      timestamp: Date.now(),
    };

    if (!this.data.phases) this.data.phases = [];
    this.data.phases.push(entry);

    // 최근 20개만 유지
    if (this.data.phases.length > 20) {
      this.data.phases = this.data.phases.slice(-20);
    }

    this._save();
    console.log(`[SwingLearning] 페이즈 저장: view=${cameraView}, top=${entry.topRatio.toFixed(3)}, impact=${entry.impactRatio.toFixed(3)}, source=${source}`);
  }

  /**
   * 학습된 패턴에서 예상 위치 반환
   * 해당 카메라 뷰의 과거 데이터 평균을 반환
   *
   * @param {string} cameraView - 'face_on' | 'down_the_line'
   * @returns {Object|null} {topRatio, impactRatio, sampleSize, confidence}
   */
  getPredictedPhases(cameraView) {
    const entries = (this.data.phases || []).filter(e => e.view === cameraView);

    if (entries.length < 3) return null; // 데이터 부족

    // Gemini 확정 데이터에 가중치 부여
    let topSum = 0, impactSum = 0, weightSum = 0;
    for (const e of entries) {
      const weight = e.source === 'gemini' ? 2.0 : (e.source === 'user' ? 3.0 : 1.0);
      topSum += e.topRatio * weight;
      impactSum += e.impactRatio * weight;
      weightSum += weight;
    }

    const avgTop = topSum / weightSum;
    const avgImpact = impactSum / weightSum;

    // 편차 계산 (신뢰도 지표)
    const topStd = Math.sqrt(
      entries.reduce((sum, e) => sum + (e.topRatio - avgTop) ** 2, 0) / entries.length
    );
    const impactStd = Math.sqrt(
      entries.reduce((sum, e) => sum + (e.impactRatio - avgImpact) ** 2, 0) / entries.length
    );

    // 편차가 작을수록 높은 신뢰도
    const confidence = Math.max(0, Math.min(1, 1 - (topStd + impactStd) * 5));

    return {
      topRatio: avgTop,
      impactRatio: avgImpact,
      sampleSize: entries.length,
      confidence,
      topStd,
      impactStd,
    };
  }

  /**
   * 클럽 감지 결과 저장 (Gemini 확정 후)
   *
   * @param {Object} metrics - {wrist_height_rel, spine_angle_deg, x_factor_deg}
   * @param {string} confirmedClub - 'driver' | 'iron' | 'wedge' | 'putter'
   * @param {string} source - 'math' | 'gemini'
   */
  saveClubDetection(metrics, confirmedClub, source = 'math') {
    if (!confirmedClub) return;

    const entry = {
      maxWristHeight: metrics.maxWristHeight || metrics.wrist_height_rel || 0,
      avgSpineAngle: metrics.avgSpineAngle || metrics.spine_angle_deg || 0,
      maxXFactor: metrics.maxXFactor || metrics.x_factor_deg || 0,
      club: confirmedClub,
      source,
      timestamp: Date.now(),
    };

    if (!this.data.clubs) this.data.clubs = [];
    this.data.clubs.push(entry);

    // 최근 30개만 유지
    if (this.data.clubs.length > 30) {
      this.data.clubs = this.data.clubs.slice(-30);
    }

    this._save();
    console.log(`[SwingLearning] 클럽 저장: ${confirmedClub} (source=${source})`);
  }

  /**
   * 학습된 클럽 데이터를 기반으로 클럽 예측
   * k-최근접 이웃(KNN) 방식으로 유사한 메트릭의 클럽 결과 참조
   *
   * @param {Object} metrics - {maxWristHeight, avgSpineAngle, maxXFactor}
   * @returns {Object|null} {club, confidence, sampleSize}
   */
  predictClub(metrics) {
    const entries = this.data.clubs || [];
    if (entries.length < 5) return null;

    // 각 저장된 결과와의 유클리드 거리 계산
    const distances = entries.map(e => {
      const dWH = (metrics.maxWristHeight - e.maxWristHeight) * 10; // 스케일링
      const dSA = (metrics.avgSpineAngle - e.avgSpineAngle) / 5;
      const dXF = (metrics.maxXFactor - e.maxXFactor) / 10;
      const dist = Math.sqrt(dWH * dWH + dSA * dSA + dXF * dXF);
      // Gemini 소스에 가중치
      const weight = e.source === 'gemini' ? 2.0 : 1.0;
      return { club: e.club, dist, weight };
    });

    // 가장 가까운 5개
    distances.sort((a, b) => a.dist - b.dist);
    const k = Math.min(5, distances.length);
    const nearest = distances.slice(0, k);

    // 가중 투표
    const votes = {};
    for (const n of nearest) {
      const w = n.weight / (n.dist + 0.01); // 거리 역수 가중치
      votes[n.club] = (votes[n.club] || 0) + w;
    }

    let bestClub = null;
    let bestWeight = 0;
    let totalWeight = 0;
    for (const [club, weight] of Object.entries(votes)) {
      totalWeight += weight;
      if (weight > bestWeight) {
        bestWeight = weight;
        bestClub = club;
      }
    }

    return {
      club: bestClub,
      confidence: totalWeight > 0 ? bestWeight / totalWeight : 0,
      sampleSize: entries.length,
    };
  }

  /**
   * 학습 데이터 통계 반환
   */
  getStats() {
    const phases = this.data.phases || [];
    const clubs = this.data.clubs || [];

    return {
      phaseCount: phases.length,
      clubCount: clubs.length,
      phaseByView: {
        face_on: phases.filter(e => e.view === 'face_on').length,
        down_the_line: phases.filter(e => e.view === 'down_the_line').length,
      },
      geminiConfirmed: {
        phases: phases.filter(e => e.source === 'gemini').length,
        clubs: clubs.filter(e => e.source === 'gemini').length,
      },
    };
  }

  /**
   * 학습 데이터 초기화
   */
  clear() {
    this.data = {};
    this._save();
    console.log('[SwingLearning] 학습 데이터 초기화됨');
  }
}
