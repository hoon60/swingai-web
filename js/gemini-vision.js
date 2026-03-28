/**
 * SwingAI Gemini Vision Module v2.0
 * Gemini 2.0 Flash를 활용한 골프 스윙 페이즈 검증, 클럽 판별, 스윙 폼 분석
 *
 * 역할:
 *   - 수학 모델이 선정한 후보 프레임을 Gemini Vision에 보내 백스윙 탑 확정
 *   - 어드레스/탑/임팩트 3장 검증
 *   - 이미지 기반 클럽 종류 판별
 *   - 모든 호출은 비동기, 실패 시 수학 결과로 폴백
 */

export class GeminiVision {
  constructor() {
    // 인코딩된 키에서 복원 (btoa/atob)
    this._encodedKey = 'QUl6YVN5RERhYVNQWnlSUmpWVlpqZGdYZmVGSEpXRE5jLTRwWVYw';
    this.apiKey = this._getKey();
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
    this._timeout = 15000; // 15초 타임아웃
  }

  /**
   * 인코딩된 키 복원
   */
  _getKey() {
    try {
      return atob(this._encodedKey);
    } catch {
      console.warn('[GeminiVision] API 키 복원 실패');
      return null;
    }
  }

  /**
   * Gemini API 호출 (공통)
   * @param {string} promptText - 프롬프트 텍스트
   * @param {Array} images - [{mime_type, data}] base64 이미지 배열
   * @returns {Object|null} 파싱된 응답 또는 null
   */
  async _callGemini(promptText, images = [], opts = {}) {
    if (!this.apiKey) return null;

    const parts = [{ text: promptText }];
    for (const img of images) {
      parts.push({
        inline_data: {
          mime_type: img.mime_type || 'image/jpeg',
          data: img.data,
        },
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this._timeout);

    try {
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: opts.temperature ?? 0.1,
            maxOutputTokens: opts.maxTokens ?? 500,
          },
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[GeminiVision] API 오류: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return null;

      // JSON 블록 추출 시도
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          // JSON 파싱 실패시 텍스트로 반환
          return { raw: text };
        }
      }
      return { raw: text };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        console.warn('[GeminiVision] 요청 타임아웃');
      } else {
        console.warn('[GeminiVision] 호출 실패:', err.message);
      }
      return null;
    }
  }

  /**
   * 프레임에서 base64 이미지 데이터 추출
   * canvas를 사용해 비디오 프레임을 JPEG로 변환
   * @param {HTMLVideoElement} video - 비디오 엘리먼트
   * @param {number} time - 프레임 시간(초)
   * @returns {Promise<string>} base64 인코딩된 이미지 데이터 (data URL 프리픽스 없음)
   */
  async _captureFrameAsBase64(video, time) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 640 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);

      // 5초 타임아웃 — seeked 이벤트가 안 오면 실패 처리
      const timeout = setTimeout(() => {
        video.removeEventListener('seeked', onSeeked);
        reject(new Error('Frame capture timeout'));
      }, 5000);

      const onSeeked = () => {
        clearTimeout(timeout);
        video.removeEventListener('seeked', onSeeked);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        const base64 = dataUrl.split(',')[1];
        resolve(base64);
      };

      video.addEventListener('seeked', onSeeked);
      video.currentTime = time;
    });
  }

  /**
   * 후보 프레임 5개를 보내서 백스윙 탑 확정
   * @param {Array} candidateFrames - [{index, time, imageBase64, wristHeight, shoulderTilt}]
   * @returns {Object|null} {selectedIndex, confidence, comment}
   */
  async confirmBackswingTop(candidateFrames) {
    if (!candidateFrames || candidateFrames.length === 0) return null;

    const images = candidateFrames.map(f => ({
      mime_type: 'image/jpeg',
      data: f.imageBase64,
    }));

    const frameDescriptions = candidateFrames.map((f, i) =>
      `프레임 ${i + 1}: 손목높이=${f.wristHeight?.toFixed(3) || '?'}, 어깨기울기=${f.shoulderTilt?.toFixed(1) || '?'}도`
    ).join('\n');

    const prompt = `당신은 골프 스윙 분석 전문가입니다. 다음 ${candidateFrames.length}장의 골프 스윙 프레임 중 백스윙 탑(클럽이 가장 높은 위치, 백스윙에서 다운스윙으로 전환되는 순간)인 프레임 번호를 선택하세요.

각 프레임 수치:
${frameDescriptions}

반드시 다음 JSON 형식으로 응답하세요:
{"selectedIndex": 숫자(1부터 시작), "confidence": 0.0~1.0, "comment": "선택 이유"}`;

    const result = await this._callGemini(prompt, images);
    if (!result || result.selectedIndex === undefined) return null;

    return {
      selectedIndex: result.selectedIndex - 1, // 0-based로 변환
      confidence: result.confidence || 0.5,
      comment: result.comment || '',
    };
  }

  /**
   * 전체 페이즈 검증 — 어드레스/탑/임팩트 3장이 정확한지 확인
   * @param {string} addressBase64 - 어드레스 프레임 base64
   * @param {string} topBase64 - 백스윙 탑 프레임 base64
   * @param {string} impactBase64 - 임팩트 프레임 base64
   * @returns {Object|null} {valid, corrections, comment}
   */
  async validatePhases(addressBase64, topBase64, impactBase64) {
    const images = [
      { mime_type: 'image/jpeg', data: addressBase64 },
      { mime_type: 'image/jpeg', data: topBase64 },
      { mime_type: 'image/jpeg', data: impactBase64 },
    ];

    const prompt = `당신은 골프 스윙 분석 전문가입니다. 3장의 이미지가 순서대로 어드레스, 백스윙 탑, 임팩트 순간을 정확히 보여주는지 확인하세요.

어드레스: 스윙 시작 자세, 클럽이 공 뒤에 놓인 상태
백스윙 탑: 클럽이 가장 높이 올라간 상태, 몸이 뒤로 회전한 상태
임팩트: 클럽이 공을 치는 순간, 팔이 쭉 펴진 상태

반드시 다음 JSON 형식으로 응답하세요:
{"valid": true/false, "addressOk": true/false, "topOk": true/false, "impactOk": true/false, "comment": "설명"}`;

    return await this._callGemini(prompt, images);
  }

  /**
   * 이미지 기반 클럽 종류 판별
   * @param {string} frameBase64 - 프레임 base64 이미지
   * @returns {Object|null} {club: "driver"|"iron"|"wedge"|"putter", confidence, comment}
   */
  async detectClub(frameBase64) {
    const images = [{ mime_type: 'image/jpeg', data: frameBase64 }];

    const prompt = `당신은 골프 장비 전문가입니다. 이 골프 스윙 이미지에서 사용하는 클럽 종류를 판별하세요.

판별 기준:
- 드라이버(driver): 큰 헤드, 긴 샤프트, 티 위의 공
- 아이언(iron): 중간 크기 헤드, 날이 있는 형태
- 웨지(wedge): 아이언과 유사하나 더 짧고 로프트가 큼, 벙커/어프로치
- 퍼터(putter): 납작한 헤드, 그린 위에서 사용

반드시 다음 JSON 형식으로 응답하세요:
{"club": "driver" 또는 "iron" 또는 "wedge" 또는 "putter", "confidence": 0.0~1.0, "comment": "판별 근거"}`;

    const result = await this._callGemini(prompt, images);
    if (!result || !result.club) return null;

    // 유효한 클럽 타입인지 확인
    const validClubs = ['driver', 'iron', 'wedge', 'putter'];
    if (!validClubs.includes(result.club)) return null;

    return result;
  }

  /**
   * 비디오에서 핵심 프레임 캡처 후 백스윙 탑 검증 실행
   * 수학 모델 결과와 함께 사용
   *
   * @param {HTMLVideoElement} video - 비디오 엘리먼트
   * @param {Object} phaseDetection - _lastPhaseDetection 객체
   * @param {Array} usedFrames - 분석에 사용된 프레임 배열
   * @returns {Object|null} Gemini 검증 결과
   */
  async verifyBackswingTop(video, phaseDetection, usedFrames) {
    if (!phaseDetection || !usedFrames || usedFrames.length === 0) return null;

    const { topIdx, totalFrames } = phaseDetection;

    // 탑 인덱스 근처 ±2 프레임을 후보로 선정
    const candidateIndices = [];
    for (let offset = -2; offset <= 2; offset++) {
      const idx = topIdx + offset;
      if (idx >= 0 && idx < totalFrames && usedFrames[idx]) {
        candidateIndices.push(idx);
      }
    }

    if (candidateIndices.length === 0) return null;

    // 각 후보 프레임 캡처
    const candidates = [];
    for (const idx of candidateIndices) {
      const frame = usedFrames[idx];
      if (!frame || frame.time === undefined) continue;

      try {
        const base64 = await this._captureFrameAsBase64(video, frame.time);
        candidates.push({
          index: idx,
          time: frame.time,
          imageBase64: base64,
          wristHeight: frame.metrics?.wrist_height_rel,
          shoulderTilt: frame.metrics?.shoulder_line_tilt_deg,
        });
      } catch {
        // 프레임 캡처 실패 무시
      }
    }

    if (candidates.length === 0) return null;

    const result = await this.confirmBackswingTop(candidates);
    if (!result) return null;

    // 선택된 후보의 실제 프레임 인덱스로 변환
    const selectedCandidate = candidates[result.selectedIndex];
    if (selectedCandidate) {
      result.frameIndex = selectedCandidate.index;
    }

    return result;
  }

  /**
   * 비디오에서 클럽 판별 실행
   * @param {HTMLVideoElement} video - 비디오 엘리먼트
   * @param {Array} usedFrames - 분석에 사용된 프레임 배열
   * @returns {Object|null} {club, confidence, comment}
   */
  /**
   * 스윙 폼 직접 분석 (Gemini Vision)
   * 2D 수학으로 계산 불가능한 자세 요소를 영상에서 직접 판독
   *
   * @param {HTMLVideoElement} video
   * @param {number} addressTime - 어드레스 프레임 시간(초)
   * @param {number} topTime - 백스윙 탑 프레임 시간(초)
   * @param {number} impactTime - 임팩트 프레임 시간(초)
   * @param {string} cameraView - 'face_on' | 'down_the_line'
   * @param {string} club - 'driver' | 'iron' | 'wedge' | 'putter'
   * @returns {Object|null} {observations: [{aspect, aspect_kr, rating, detail_kr}], key_issue_kr}
   */
  async analyzeSwingForm(video, addressTime, topTime, impactTime, cameraView, club) {
    try {
      const [addrImg, topImg, impImg] = await Promise.all([
        this._captureFrameAsBase64(video, addressTime),
        this._captureFrameAsBase64(video, topTime),
        this._captureFrameAsBase64(video, impactTime),
      ]);

      const images = [
        { mime_type: 'image/jpeg', data: addrImg },
        { mime_type: 'image/jpeg', data: topImg },
        { mime_type: 'image/jpeg', data: impImg },
      ];

      const clubKr = { driver: '드라이버', iron: '아이언', wedge: '웨지', putter: '퍼터' }[club] || '아이언';
      let prompt;

      if (cameraView === 'down_the_line') {
        prompt = `당신은 PGA 투어 코치 출신 골프 스윙 분석 전문가입니다.
측면(DTL) 뷰에서 촬영된 ${clubKr} 스윙 3장(어드레스/백스윙탑/임팩트)을 분석하세요.

다음 5가지 항목을 각각 평가하세요:
1. shoulder_plane (어깨 회전 평면): 백스윙 탑에서 어깨가 충분히 회전했는지, 회전 평면이 적절한 경사인지
2. hip_shoulder_separation (힙-어깨 분리): 다운스윙에서 힙이 어깨보다 먼저 회전하는지 (X-Factor)
3. spine_tilt (척추 기울기): 어드레스-탑-임팩트에서 전방 기울기가 일정하게 유지되는지
4. weight_transfer (체중 이동): 백스윙에서 오른발, 임팩트에서 왼발로 체중이 이동하는지
5. club_shaft (클럽 샤프트): 백스윙 탑에서 샤프트가 타겟 라인과 대략 평행한지

반드시 다음 JSON 형식으로 응답하세요:
{"observations":[{"aspect":"shoulder_plane","aspect_kr":"어깨 회전","rating":"good 또는 caution 또는 poor","detail_kr":"평가 설명 1문장"},{"aspect":"hip_shoulder_separation","aspect_kr":"힙-어깨 분리","rating":"...","detail_kr":"..."},{"aspect":"spine_tilt","aspect_kr":"척추 기울기","rating":"...","detail_kr":"..."},{"aspect":"weight_transfer","aspect_kr":"체중 이동","rating":"...","detail_kr":"..."},{"aspect":"club_shaft","aspect_kr":"클럽 샤프트","rating":"...","detail_kr":"..."}],"key_issue_kr":"가장 중요한 개선점 1문장"}`;
      } else {
        prompt = `당신은 PGA 투어 코치 출신 골프 스윙 분석 전문가입니다.
정면(Face-on) 뷰에서 촬영된 ${clubKr} 스윙 3장(어드레스/백스윙탑/임팩트)을 분석하세요.

다음 4가지 항목을 각각 평가하세요:
1. head_stability (머리 안정성): 스윙 전체에서 머리 위치가 크게 움직이지 않는지
2. extension (임팩트 익스텐션): 임팩트에서 양팔이 충분히 뻗어 있는지, 타겟 방향으로 클럽이 뻗는지
3. balance (밸런스): 어드레스와 임팩트에서 몸의 균형이 잡혀 있는지
4. rotation_sequence (회전 순서): 백스윙/다운스윙에서 몸의 회전이 자연스러운지

반드시 다음 JSON 형식으로 응답하세요:
{"observations":[{"aspect":"head_stability","aspect_kr":"머리 안정성","rating":"good 또는 caution 또는 poor","detail_kr":"평가 설명 1문장"},{"aspect":"extension","aspect_kr":"임팩트 뻗기","rating":"...","detail_kr":"..."},{"aspect":"balance","aspect_kr":"밸런스","rating":"...","detail_kr":"..."},{"aspect":"rotation_sequence","aspect_kr":"회전 순서","rating":"...","detail_kr":"..."}],"key_issue_kr":"가장 중요한 개선점 1문장"}`;
      }

      const result = await this._callGemini(prompt, images, { maxTokens: 1024, temperature: 0.2 });
      if (!result || !result.observations) return null;

      // rating 값 정규화
      const validRatings = ['good', 'caution', 'poor'];
      for (const obs of result.observations) {
        if (!validRatings.includes(obs.rating)) obs.rating = 'caution';
      }

      return result;
    } catch (err) {
      console.warn('[GeminiVision] analyzeSwingForm 실패:', err.message);
      return null;
    }
  }

  async verifyClub(video, usedFrames) {
    if (!usedFrames || usedFrames.length === 0) return null;

    // 어드레스 구간 프레임 사용 (클럽이 가장 잘 보이는 시점)
    const addressIdx = Math.min(3, usedFrames.length - 1);
    const frame = usedFrames[addressIdx];
    if (!frame || frame.time === undefined) return null;

    try {
      const base64 = await this._captureFrameAsBase64(video, frame.time);
      return await this.detectClub(base64);
    } catch {
      return null;
    }
  }
}
