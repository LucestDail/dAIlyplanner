/**
 * Gemini API Integration
 * Handles AI-powered task analysis and scheduling
 */

export class GeminiAPI {
  constructor(apiKey, model = 'gemini-2.5-flash') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  }

  async analyzeTask(taskData) {
    if (!this.apiKey) {
      throw new Error('Gemini API key is not set');
    }

    const { title, description, priority, duration, selectedText, userInfo, existingSchedules, clientLocalTime } = taskData;

    // Build context-aware prompt with existing schedules
    const prompt = this.buildTaskAnalysisPrompt({
      title,
      description,
      priority,
      duration,
      selectedText,
      userInfo,
      existingSchedules,
      clientLocalTime
    });

    try {
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API request failed');
      }

      const data = await response.json();
      const text = data.candidates[0]?.content?.parts[0]?.text || '';
      
      // Parse AI response
      return this.parseAIResponse(text);
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw error;
    }
  }

  // 일간 일정 분석 - 특정 날짜에 고정하여 시간 배분
  async analyzeDailyTask({ title, description, priority, duration, targetDate, userInfo, existingSchedules, clientLocalTime }) {
    if (!this.apiKey) {
      throw new Error('Gemini API key is not set');
    }

    const prompt = this.buildDailyTaskPrompt({
      title,
      description,
      priority,
      duration,
      targetDate,
      userInfo,
      existingSchedules,
      clientLocalTime
    });

    try {
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API request failed');
      }

      const data = await response.json();
      const text = data.candidates[0]?.content?.parts[0]?.text || '';
      return this.parseAIResponse(text);
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw error;
    }
  }

  buildDailyTaskPrompt({ title, description, priority, duration, targetDate, userInfo, existingSchedules, clientLocalTime }) {
    // 클라이언트 로컬 시간
    const now = clientLocalTime ? new Date(clientLocalTime) : new Date();
    const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // 대상 날짜가 오늘인지 확인
    const today = this.getLocalDateKey(now);
    const isToday = targetDate === today;
    
    // 시간을 시간 단위로 변환
    const durationHours = (duration / 60).toFixed(1);
    
    // 기존 일정 포맷팅 (완료된 일정은 이미 필터링됨)
    const scheduleContext = existingSchedules && existingSchedules.length > 0
      ? `\n**${targetDate} 기존 일정 (완료되지 않은 일정만, 시간 충돌 피해야 함):**
${existingSchedules.map(s => `- ${s.time}: ${s.title} (${((s.duration || 60) / 60).toFixed(1)}시간, 우선순위: ${s.priority || 'medium'})`).join('\n')}`
      : `\n**${targetDate} 기존 일정:** 없음 (자유롭게 시간을 배정할 수 있어요)`;

    const tossStyleGuide = `
**토스 스타일 라이팅 원칙:**
- 해요체 사용: '~해요', '~있어요', '~드릴게요'
- 간결하고 친근하게
`;

    return `당신은 ${userInfo.name || '사용자'}님의 일간 일정 매니저예요. **${targetDate}** 하루의 일정을 관리해드려요.

${tossStyleGuide}

**현재 시간 정보:**
- 현재 시간: ${currentTimeStr}
- 대상 날짜: ${targetDate} ${isToday ? '(오늘)' : ''}
- 업무 가능 시간: 09:00 ~ 18:00 (8시간)

**사용자 정보:**
- 이름: ${userInfo.name || '사용자'}님
- 직업: ${userInfo.job || '미입력'}
- 성향: ${userInfo.personality || '미입력'}

**새로운 업무:**
- 제목: ${title}
- 설명: ${description || '없음'}
- 우선순위: ${priority}
- 예상 소요 시간: ${durationHours}시간 (${duration}분)
${scheduleContext}

**중요 업무 규칙:**
1. **날짜 고정**: 이 업무는 반드시 ${targetDate}에 배정해요
2. 하루 최대 업무 시간은 8시간이에요
3. 동일 업무는 하루 최대 4시간까지만 배정해요
4. 4시간(240분) 초과 업무는 여러 시간대로 분할해요
5. 기존 일정과 시간이 겹치지 않게 배정해요
${isToday ? `6. 현재 시간(${currentTimeStr}) 이후의 시간대만 추천해요` : ''}

**JSON 응답 형식:**
{
  "suggestedTitle": "간결한 제목 (10자 이내)",
  "suggestedTime": "HH:MM (시작 시간)",
  "timeSlot": "오전/오후",
  "estimatedDuration": ${duration},
  "durationHours": ${durationHours},
  "priority": "${priority || 'medium'}",
  "splitRequired": true/false,
  "scheduleArray": [
    {"time": "HH:MM", "duration": 분단위숫자, "title": "업무명 (1/N)"}
  ],
  "recommendations": "시간 배분 안내 (토스체)",
  "conflictWarning": "충돌 경고 (없으면 null)",
  "reasoning": "이 시간대를 추천하는 이유"
}

**splitRequired 규칙:**
- 소요시간이 4시간(240분) 이하: splitRequired: false
- 소요시간이 4시간(240분) 초과: splitRequired: true, scheduleArray에 4시간 단위로 분할

응답은 JSON 형식만 제공해주세요.`;
  }

  getLocalDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async analyzeScheduleIntent({ title, description, priority, userInfo }) {
    if (!this.apiKey) {
      throw new Error('Gemini API key is not set');
    }

    const prompt = this.buildScheduleIntentPrompt({ title, description, priority, userInfo });

    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();
      const text = data.candidates[0]?.content?.parts[0]?.text || '';
      return this.parseIntentResponse(text);
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw error;
    }
  }

  buildScheduleIntentPrompt({ title, description, priority, userInfo }) {
    const age = this.calculateAge(userInfo.birthdate);
    const today = new Date().toISOString().split('T')[0];
    
    return `당신은 ${userInfo.name || '사용자'}님의 비서예요. 업무 의도를 파악하고 일정 범위를 정해드려요.

**역할: 개인 비서**
- 제목과 설명을 분석해서 일간/주간/월간/분기 범위를 판단해요
- 적절한 일정 등록 방식을 결정해드려요

**사용자 정보:**
- 이름: ${userInfo.name || '사용자'}님
- 나이: ${age || '미입력'}세
- 직업: ${userInfo.job || '미입력'}
- 성향: ${userInfo.personality || '미입력'}

**오늘 날짜:** ${today}

**업무 정보:**
- 제목: ${title}
- 설명: ${description || '없음'}
- 우선순위: ${priority}

**분석 요청:**
이 업무가 어느 범위에 해당하는지 판단하고, 일정 등록 방식을 결정해주세요.
- 오늘 또는 특정 하루에 해야 할 일 → daily
- 이번 주 내에 해야 할 일 → weekly
- 이번 달 내에 해야 할 일 → monthly
- 분기 단위로 진행할 일 → quarterly

다음 JSON 형식으로 응답해주세요:
{
  "scope": "daily/weekly/monthly/quarterly",
  "scopeReason": "범위 판단 이유 (토스체로)",
  "scheduleType": "single/repeat/array",
  "dates": ["${today}"],
  "repeatPattern": null,
  "scheduleArray": [
    {
      "date": "${today}",
      "time": "09:00",
      "duration": 60
    }
  ]
}

응답은 JSON 형식만 제공하고, 추가 설명은 하지 마세요.`;
  }

  parseIntentResponse(text) {
    try {
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error('Failed to parse intent response:', error);
      return { scope: 'daily', scheduleType: 'single', dates: null };
    }
  }

  buildTaskAnalysisPrompt({ title, description, priority, duration, selectedText, userInfo, existingSchedules, clientLocalTime }) {
    // 클라이언트 로컬 시간 (전달되지 않으면 현재 시간 사용)
    const now = clientLocalTime ? new Date(clientLocalTime) : new Date();
    const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const currentDateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    
    // 시간을 시간 단위로 변환
    const durationHours = (duration / 60).toFixed(1);
    
    // Calculate age from birthdate
    let age = null;
    if (userInfo.birthdate) {
      const birthDate = new Date(userInfo.birthdate);
      const today = new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
    }

    // Format existing schedules for context
    const scheduleContext = existingSchedules && existingSchedules.length > 0
      ? `\n기존 일정 목록 (충돌을 피하고 최적의 시간을 제안해야 함):
${existingSchedules.map(s => `- ${s.time}: ${s.title} (${((s.duration || 60) / 60).toFixed(1)}시간, 우선순위: ${s.priority || 'medium'})`).join('\n')}`
      : '\n기존 일정: 없음 (자유롭게 시간을 제안할 수 있습니다)';

    const userContext = userInfo.name 
      ? `사용자 정보 (이 정보를 바탕으로 업무 스타일과 에너지 레벨을 고려해야 함):
- 이름: ${userInfo.name}
${age ? `- 나이: ${age}세` : ''}
- 생년월일: ${userInfo.birthdate || '미입력'}
- 성별: ${userInfo.gender || '미입력'}
- 직업: ${userInfo.job || '미입력'}
- 성향 및 업무 스타일: ${userInfo.personality || '미입력'}
`
      : '';

    // Build context-aware prompt considering user's job and personality
    let jobContext = '';
    if (userInfo.job) {
      jobContext = `\n직업 관련 고려사항:
- 직업: ${userInfo.job}
- 이 직업의 특성상 ${this.getJobCharacteristics(userInfo.job)}을 고려해야 합니다.
- 업무 시간대와 에너지 패턴을 직업 특성에 맞게 조정해야 합니다.`;
    }

    let personalityContext = '';
    if (userInfo.personality) {
      personalityContext = `\n성향 및 업무 스타일 고려사항:
- 사용자 성향: ${userInfo.personality}
- 이 성향을 바탕으로 최적의 업무 시간대와 작업 방식을 제안해야 합니다.
- 사용자의 업무 효율성과 만족도를 최대화할 수 있는 시간 배정을 해야 합니다.`;
    }

    const tossStyleGuide = `
**토스 스타일 라이팅 원칙 (반드시 준수):**
- 해요체 사용: 모든 문장은 '~해요', '~있어요', '~드릴게요', '~보세요'로 끝내세요
- 간결하게: 한 문장은 가능한 짧고 명확하게
- 친근하게: 딱딱한 표현 대신 부드럽고 친근한 말투
- 긍정적으로: 부정적 표현보다 긍정적인 안내
- 예시: "시간이 충돌합니다" → "이 시간에는 다른 일정이 있어요"
- 예시: "권장합니다" → "이렇게 해보시면 좋을 것 같아요"
`;

    return `당신은 ${userInfo.name || '사용자'}님의 일간 매니저예요. 하루 일정을 친근하고 세심하게 관리해드려요.

${tossStyleGuide}

**현재 시간 정보:**
- 현재 날짜: ${currentDateStr}
- 현재 시간: ${currentTimeStr}
- 업무 시간: 09:00 ~ 18:00 (8시간)

**역할: 일간 매니저**
- 하루 일정을 효율적으로 계획해드려요
- 시간 충돌을 방지하고 최적의 시간대를 추천해드려요
- 현재 시간 이후의 시간대만 추천해주세요

**사용자 정보:**
${userContext}${jobContext}${personalityContext}

**새로운 할 일:**
- 제목: ${title}
- 설명: ${description || '없음'}
- 우선순위: ${priority}
- 예상 소요 시간: ${durationHours}시간 (${duration}분)
${selectedText ? `- 참고 텍스트: "${selectedText}"` : ''}${scheduleContext}

**중요 업무 분할 규칙:**
1. 하루 최대 업무 시간은 8시간이에요
2. 동일 업무는 하루 최대 4시간까지만 배정해요
3. 4시간 초과 업무는 여러 날에 나눠서 등록해야 해요
4. splitRequired가 true면 scheduleArray에 분할된 일정을 포함해주세요

**중요 지침:**
1. 기존 일정과 충돌하지 않는 시간을 추천해주세요
2. 현재 시간(${currentTimeStr}) 이후의 시간대만 추천해주세요
3. suggestedTitle: 사용자가 입력한 제목을 10자 이내의 간결한 제목으로 정리해주세요
4. 추천 사항(recommendations)에 시간 가이드를 포함해주세요
5. 모든 안내는 토스체(해요체)로 친근하게 작성해주세요

다음 JSON 형식으로 응답해주세요:
{
  "suggestedTitle": "간결한 제목 (10자 이내)",
  "suggestedTime": "HH:MM (시작 시간, 현재 시간 이후)",
  "timeSlot": "오전/오후/저녁",
  "estimatedDuration": ${duration || 60},
  "durationHours": ${durationHours},
  "priority": "${priority || 'medium'}",
  "category": "업무/개인/학습/기타",
  "splitRequired": true/false,
  "scheduleArray": [
    {"date": "YYYY-MM-DD", "time": "HH:MM", "duration": 분단위숫자, "title": "분할된 제목 (1/N)"}
  ],
  "recommendations": "HH:MM에 시작해서 HH:MM까지 진행하시면 돼요. (토스체로 친근한 추가 안내)",
  "conflictWarning": "충돌 경고 메시지 (없으면 null, 있으면 토스체로)",
  "energyLevel": "low/medium/high",
  "reasoning": "이 시간대를 추천하는 이유 (토스체로 2-3문장)"
}

**splitRequired와 scheduleArray 규칙:**
- 요청된 소요시간이 4시간(240분) 이하면: splitRequired: false, scheduleArray는 단일 일정
- 요청된 소요시간이 4시간(240분) 초과면: splitRequired: true, 4시간 단위로 분할하여 scheduleArray에 포함
- 분할 시 각 날짜에 동일 업무는 최대 4시간, 하루 총 업무는 8시간 이내로 배정

응답은 JSON 형식만 제공하고, 추가 설명은 하지 마세요.`;
  }

  getJobCharacteristics(job) {
    const jobMap = {
      '개발자': '집중력이 필요한 시간대와 창의적 사고가 필요한 시간대',
      '디자이너': '창의적 작업에 최적화된 시간대',
      '기획자': '사고와 계획에 적합한 시간대',
      '마케터': '커뮤니케이션이 활발한 시간대',
      '영업': '고객 접촉이 가능한 업무 시간대',
      '교사': '수업 준비와 정리 시간',
      '의사': '환자 진료 시간대',
      '간호사': '근무 시간대',
      '학생': '학습 효율이 높은 시간대',
      '프리랜서': '자유롭게 조정 가능한 시간대',
      '경영진': '중요 의사결정에 적합한 시간대'
    };
    
    // Check if job contains any keyword
    for (const [key, value] of Object.entries(jobMap)) {
      if (job.includes(key)) {
        return value;
      }
    }
    
    return '업무 특성에 맞는 시간대';
  }

  parseAIResponse(text) {
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      // Return default structure if parsing fails
      return {
        suggestedTime: null,
        timeSlot: '오후',
        estimatedDuration: 60,
        priority: 'medium',
        category: '기타',
        recommendations: 'AI 분석을 완료할 수 없었습니다.',
        conflictWarning: null,
        energyLevel: 'medium',
        reasoning: '기본 시간대를 사용합니다.'
      };
    }
  }

  async generateWeeklyPlan(schedules, userInfo, weekKey) {
    if (!this.apiKey) {
      throw new Error('Gemini API key is not set');
    }

    const prompt = this.buildWeeklyPlanPrompt(schedules, userInfo, weekKey);

    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();
      const text = data.candidates[0]?.content?.parts[0]?.text || '';
      return this.parsePlanResponse(text);
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw error;
    }
  }

  async generateMonthlyPlan(schedules, userInfo, monthKey) {
    if (!this.apiKey) {
      throw new Error('Gemini API key is not set');
    }

    const prompt = this.buildMonthlyPlanPrompt(schedules, userInfo, monthKey);

    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();
      const text = data.candidates[0]?.content?.parts[0]?.text || '';
      return this.parsePlanResponse(text);
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw error;
    }
  }

  async generateQuarterlyPlan(schedules, userInfo, quarterKey, quarter, year) {
    if (!this.apiKey) {
      throw new Error('Gemini API key is not set');
    }

    const prompt = this.buildQuarterlyPlanPrompt(schedules, userInfo, quarterKey, quarter, year);

    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();
      const text = data.candidates[0]?.content?.parts[0]?.text || '';
      return this.parsePlanResponse(text);
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw error;
    }
  }

  buildWeeklyPlanPrompt(schedules, userInfo, weekKey) {
    // Extract all schedules for the week
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const weekSchedules = [];
    for (let date = new Date(weekStart); date <= weekEnd; date.setDate(date.getDate() + 1)) {
      const dateKey = date.toISOString().split('T')[0];
      if (schedules[dateKey] && Array.isArray(schedules[dateKey])) {
        schedules[dateKey].forEach(s => {
          if (s && s.title) {
            weekSchedules.push({ ...s, date: dateKey });
          }
        });
      }
    }
    
    const tossStyleGuide = `
**토스 스타일 라이팅 원칙 (반드시 준수):**
- 해요체 사용: 모든 문장은 '~해요', '~있어요', '~드릴게요'로 끝내세요
- 간결하게: 한 문장은 가능한 짧고 명확하게
- 친근하게: 딱딱한 표현 대신 부드럽고 친근한 말투
- 긍정적으로: 부정적 표현보다 긍정적인 안내
`;
    
    const schedulesText = weekSchedules.length > 0
      ? weekSchedules.map(s => `- [${s.date}] ${s.time || '미정'}: ${s.title} (${s.duration || 60}분)`).join('\n')
      : '(이번 주 등록된 일정이 없어요)';
    
    return `당신은 ${userInfo.name || '사용자'}님의 주간 매니저예요. 이번 주 일정을 친근하게 정리해드려요.

${tossStyleGuide}

**역할: 주간 매니저**
- 이번 주 일간 일정들을 통합 분석해요
- 주간 목표와 핵심 업무를 정리해드려요
- 효율적인 시간 활용을 도와드려요

**${userInfo.name || '사용자'}님 정보:**
- 직업: ${userInfo.job || '미입력'}
- 성향: ${userInfo.personality || '미입력'}

**이번 주 일정 (${weekKey}):**
${schedulesText}

**작성 요청:**
위 일간 일정을 바탕으로 주간 계획을 토스체로 친근하게 정리해주세요.
- 일정이 없으면: "이번 주는 아직 등록된 일정이 없어요. 새로운 일정을 추가해보세요!"
- 일정이 있으면: 핵심 일정 위주로 친근하게 요약해주세요

다음 JSON 형식으로 응답해주세요:
{
  "weekKey": "${weekKey}",
  "schedules": [일간 일정 배열],
  "summary": "이번 주에는 N개의 일정이 있어요. (토스체로 친근하게 요약)"
}

응답은 JSON 형식만 제공하고, 추가 설명은 하지 마세요.`;
  }

  buildMonthlyPlanPrompt(schedules, userInfo, monthKey) {
    // Extract all schedules for the month
    const [year, month] = monthKey.split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    
    const monthSchedules = [];
    for (let date = new Date(monthStart); date <= monthEnd; date.setDate(date.getDate() + 1)) {
      const dateKey = date.toISOString().split('T')[0];
      if (schedules[dateKey] && Array.isArray(schedules[dateKey])) {
        schedules[dateKey].forEach(s => {
          if (s && s.title) {
            monthSchedules.push({ ...s, date: dateKey });
          }
        });
      }
    }
    
    const tossStyleGuide = `
**토스 스타일 라이팅 원칙 (반드시 준수):**
- 해요체 사용: 모든 문장은 '~해요', '~있어요', '~드릴게요'로 끝내세요
- 간결하게: 한 문장은 가능한 짧고 명확하게
- 친근하게: 딱딱한 표현 대신 부드럽고 친근한 말투
- 긍정적으로: 부정적 표현보다 긍정적인 안내
`;
    
    const monthName = `${month}월`;
    const schedulesText = monthSchedules.length > 0
      ? monthSchedules.map(s => `- [${s.date}] ${s.time || '미정'}: ${s.title} (${s.duration || 60}분)`).join('\n')
      : `(${monthName}에 등록된 일정이 없어요)`;
    
    return `당신은 ${userInfo.name || '사용자'}님의 월간 매니저예요. 이번 달 일정을 친근하게 정리해드려요.

${tossStyleGuide}

**역할: 월간 매니저**
- 이번 달 일간 일정들을 통합 분석해요
- 월간 목표와 주요 마일스톤을 정리해드려요
- 한 달의 흐름을 한눈에 볼 수 있게 도와드려요

**${userInfo.name || '사용자'}님 정보:**
- 직업: ${userInfo.job || '미입력'}
- 성향: ${userInfo.personality || '미입력'}

**이번 달 일정 (${monthName}, ${monthSchedules.length}개):**
${schedulesText}

**작성 요청:**
위 일간 일정을 바탕으로 월간 계획을 토스체로 친근하게 정리해주세요.
- 일정이 없으면: "이번 달은 아직 등록된 일정이 없어요. 새로운 일정을 추가해보세요!"
- 일정이 있으면: 핵심 일정 위주로 친근하게 요약해주세요

다음 JSON 형식으로 응답해주세요:
{
  "monthKey": "${monthKey}",
  "schedules": [일간 일정 배열],
  "summary": "이번 달에는 N개의 일정이 있어요. (토스체로 친근하게 요약)"
}

응답은 JSON 형식만 제공하고, 추가 설명은 하지 마세요.`;
  }

  buildQuarterlyPlanPrompt(schedules, userInfo, quarterKey, quarter, year) {
    // Extract all schedules for the quarter
    const quarterStartMonth = (quarter - 1) * 3;
    const quarterEndMonth = quarterStartMonth + 2;
    const quarterStart = new Date(year, quarterStartMonth, 1);
    const quarterEnd = new Date(year, quarterEndMonth + 1, 0);
    
    const quarterSchedules = [];
    for (let date = new Date(quarterStart); date <= quarterEnd; date.setDate(date.getDate() + 1)) {
      const dateKey = date.toISOString().split('T')[0];
      if (schedules[dateKey] && Array.isArray(schedules[dateKey])) {
        schedules[dateKey].forEach(s => {
          if (s && s.title) {
            quarterSchedules.push({ ...s, date: dateKey });
          }
        });
      }
    }
    
    const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    const quarterMonths = `${monthNames[quarterStartMonth]} ~ ${monthNames[quarterEndMonth]}`;
    
    const tossStyleGuide = `
**토스 스타일 라이팅 원칙 (반드시 준수):**
- 해요체 사용: 모든 문장은 '~해요', '~있어요', '~드릴게요'로 끝내세요
- 간결하게: 한 문장은 가능한 짧고 명확하게
- 친근하게: 딱딱한 표현 대신 부드럽고 친근한 말투
- 긍정적으로: 부정적 표현보다 긍정적인 안내
`;
    
    const schedulesText = quarterSchedules.length > 0
      ? quarterSchedules.map(s => `- [${s.date}] ${s.time || '미정'}: ${s.title} (${s.duration || 60}분)`).join('\n')
      : `(${quarter}분기에 등록된 일정이 없어요)`;
    
    return `당신은 ${userInfo.name || '사용자'}님의 분기 매니저예요. 이번 분기 일정을 친근하게 정리해드려요.

${tossStyleGuide}

**역할: 분기 매니저**
- 이번 분기 일간 일정들을 통합 분석해요
- 분기 목표와 주요 마일스톤을 정리해드려요
- 3개월의 흐름을 한눈에 볼 수 있게 도와드려요

**${userInfo.name || '사용자'}님 정보:**
- 직업: ${userInfo.job || '미입력'}
- 성향: ${userInfo.personality || '미입력'}

**이번 분기 (${year}년 ${quarter}분기, ${quarterMonths}):**
등록된 일정: ${quarterSchedules.length}개
${schedulesText}

**작성 요청:**
위 일간 일정을 바탕으로 분기 계획을 토스체로 친근하게 정리해주세요.
- 일정이 없으면: "이번 분기는 아직 등록된 일정이 없어요. 새로운 일정을 추가해보세요!"
- 일정이 있으면: 핵심 일정 위주로 친근하게 요약해주세요

다음 JSON 형식으로 응답해주세요:
{
  "quarterKey": "${quarterKey}",
  "schedules": [일간 일정 배열],
  "summary": "${quarter}분기에는 N개의 일정이 있어요. (토스체로 친근하게 요약)"
}

응답은 JSON 형식만 제공하고, 추가 설명은 하지 마세요.`;
  }

  calculateAge(birthdate) {
    if (!birthdate) return null;
    const birth = new Date(birthdate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  parsePlanResponse(text) {
    try {
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error('Failed to parse plan response:', error);
      return null;
    }
  }

  async optimizeScheduleOrder(schedules, userInfo) {
    if (!this.apiKey) {
      throw new Error('Gemini API key is not set');
    }

    const prompt = this.buildScheduleOptimizationPrompt(schedules, userInfo);

    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();
      const text = data.candidates[0]?.content?.parts[0]?.text || '';
      
      // Parse optimized schedule order
      return this.parseOptimizedSchedule(text, schedules);
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw error;
    }
  }

  buildScheduleOptimizationPrompt(schedules, userInfo) {
    const scheduleList = schedules.map((s, index) => 
      `${index + 1}. ${s.time} - ${s.title} (${s.duration || 60}분, 우선순위: ${s.priority || 'medium'})`
    ).join('\n');

    const age = this.calculateAge(userInfo.birthdate);

    return `당신은 개인 매니저입니다. 사용자가 일정의 순서를 드래그 앤 드롭으로 변경했습니다. 새로운 순서를 분석하여 최적의 시간 배정을 제안해주세요.

**페르소나: 개인 매니저 (Personal Manager)**
- 역할: 일간 일정 관리, 업무 효율성 극대화
- 책임: 일일 업무 계획 수립, 시간 관리, 우선순위 조정

**사용자 상태:**
- 이름: ${userInfo.name || '미입력'}
- 나이: ${age || '미입력'}세
- 직업: ${userInfo.job || '미입력'}
- 성향: ${userInfo.personality || '미입력'}

**변경된 일정 순서:**
${scheduleList}

다음 형식으로 JSON 응답을 제공해주세요 (시간은 분 단위로도 세밀하게 조정 가능):
{
  "schedules": [
    {
      "id": "일정 ID",
      "time": "HH:MM 형식의 최적 시간 (예: 09:30, 14:15 등 분 단위 가능)",
      "title": "일정 제목",
      "duration": 소요 시간(분),
      "priority": "low/medium/high",
      "reasoning": "이 시간대로 조정한 이유"
    }
  ]
}

응답은 JSON 형식만 제공하고, 추가 설명은 하지 마세요.`;
  }

  parseOptimizedSchedule(text, originalSchedules) {
    try {
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
      const parsed = JSON.parse(jsonStr);
      
      if (parsed.schedules && Array.isArray(parsed.schedules)) {
        // Merge with original schedule data
        return parsed.schedules.map(optSchedule => {
          const original = originalSchedules.find(s => s.id === optSchedule.id);
          return {
            ...original,
            ...optSchedule,
            time: optSchedule.time || original?.time
          };
        }).filter(Boolean);
      }
      
      return originalSchedules;
    } catch (error) {
      console.error('Failed to parse optimized schedule:', error);
      return originalSchedules;
    }
  }

  async syncScheduleToPlans(newSchedule, allSchedules, userInfo, keys) {
    if (!this.apiKey) {
      throw new Error('Gemini API key is not set');
    }

    const prompt = this.buildScheduleSyncPrompt(newSchedule, allSchedules, userInfo, keys);

    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();
      const text = data.candidates[0]?.content?.parts[0]?.text || '';
      
      return this.parseSyncResponse(text);
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw error;
    }
  }

  buildScheduleSyncPrompt(newSchedule, allSchedules, userInfo, keys) {
    // Collect all schedules for the relevant periods
    const weeklySchedules = [];
    const monthlySchedules = [];
    const quarterlySchedules = [];
    
    // Get current date info from the keys
    const weekYear = parseInt(keys.weekKey.split('-W')[0]);
    const weekNum = parseInt(keys.weekKey.split('-W')[1]);
    const monthYear = parseInt(keys.monthKey.split('-')[0]);
    const monthNum = parseInt(keys.monthKey.split('-')[1]);
    const quarterYear = parseInt(keys.quarterKey.split('-Q')[0]);
    const quarterNum = parseInt(keys.quarterKey.split('-Q')[1]);
    
    // Get quarter month range
    const quarterStartMonth = (quarterNum - 1) * 3 + 1;
    const quarterEndMonth = quarterNum * 3;
    
    // Use directly passed weekStart and weekEnd if available, otherwise calculate
    let weekDates;
    if (keys.weekStart && keys.weekEnd) {
      weekDates = {
        start: new Date(keys.weekStart + 'T00:00:00'),
        end: new Date(keys.weekEnd + 'T23:59:59')
      };
    } else {
      // Fallback: Calculate week start and end dates
      const getWeekDates = (year, weekNumber) => {
        const simple = new Date(year, 0, 1 + (weekNumber - 1) * 7);
        const dow = simple.getDay();
        const startDate = new Date(simple);
        if (dow <= 4) {
          startDate.setDate(simple.getDate() - simple.getDay());
        } else {
          startDate.setDate(simple.getDate() + 7 - simple.getDay());
        }
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        return { start: startDate, end: endDate };
      };
      weekDates = getWeekDates(weekYear, weekNum);
    }
    
    console.log('Building sync prompt with:', {
      weekKey: keys.weekKey,
      monthKey: keys.monthKey,
      quarterKey: keys.quarterKey,
      weekDates,
      allSchedulesKeys: Object.keys(allSchedules)
    });
    
    // Collect schedules for each period
    for (const [dateKey, schedules] of Object.entries(allSchedules)) {
      // Skip undefined or invalid date keys
      if (!dateKey || dateKey === 'undefined' || !Array.isArray(schedules)) {
        continue;
      }
      
      const date = new Date(dateKey + 'T00:00:00');
      if (isNaN(date.getTime())) continue;
      
      const scheduleMonth = date.getMonth() + 1;
      const scheduleYear = date.getFullYear();
      
      // Check if schedule is within the current week
      if (date >= weekDates.start && date <= weekDates.end) {
        schedules.forEach(s => {
          weeklySchedules.push({ ...s, date: dateKey });
        });
      }
      
      // Check if schedule is within the current month
      if (scheduleYear === monthYear && scheduleMonth === monthNum) {
        schedules.forEach(s => {
          monthlySchedules.push({ ...s, date: dateKey });
        });
      }
      
      // Check if schedule is within the current quarter
      if (scheduleYear === quarterYear && 
          scheduleMonth >= quarterStartMonth && 
          scheduleMonth <= quarterEndMonth) {
        schedules.forEach(s => {
          quarterlySchedules.push({ ...s, date: dateKey });
        });
      }
    }
    
    // Include the new schedule if it's valid
    if (newSchedule.title && newSchedule.title !== '계획 재생성') {
      const newScheduleDate = newSchedule.date || new Date().toISOString().split('T')[0];
      const newDate = new Date(newScheduleDate + 'T00:00:00');
      const newMonth = newDate.getMonth() + 1;
      const newYear = newDate.getFullYear();
      
      const scheduleObj = { ...newSchedule, date: newScheduleDate };
      
      if (newDate >= weekDates.start && newDate <= weekDates.end) {
        weeklySchedules.push(scheduleObj);
      }
      if (newYear === monthYear && newMonth === monthNum) {
        monthlySchedules.push(scheduleObj);
      }
      if (newYear === quarterYear && newMonth >= quarterStartMonth && newMonth <= quarterEndMonth) {
        quarterlySchedules.push(scheduleObj);
      }
    }
    
    // 중복 제거 함수 (id 또는 date+time+title 기준)
    const removeDuplicates = (arr) => {
      const seen = new Set();
      return arr.filter(s => {
        const key = s.id || `${s.date}-${s.time}-${s.title}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };
    
    // Sort schedules
    const sortSchedules = (arr) => arr.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.time || '00:00').localeCompare(b.time || '00:00');
    });
    
    // 중복 제거 후 정렬
    const uniqueWeeklySchedules = removeDuplicates(weeklySchedules);
    const uniqueMonthlySchedules = removeDuplicates(monthlySchedules);
    const uniqueQuarterlySchedules = removeDuplicates(quarterlySchedules);
    
    sortSchedules(uniqueWeeklySchedules);
    sortSchedules(uniqueMonthlySchedules);
    sortSchedules(uniqueQuarterlySchedules);
    
    // Format schedules for prompt
    const formatSchedules = (arr) => arr.length > 0 
      ? arr.map(s => `- [${s.date}] ${s.time || '미정'}: ${s.title} (${s.duration || 60}분, 우선순위: ${s.priority || 'medium'}${s.completed ? ', 완료' : ''})`).join('\n')
      : '(등록된 일정이 없어요)';
    
    console.log('Collected schedules (after dedup):', {
      weekly: uniqueWeeklySchedules.length,
      monthly: uniqueMonthlySchedules.length,
      quarterly: uniqueQuarterlySchedules.length
    });
    
    const tossStyleGuide = `
**토스 스타일 라이팅 원칙 (반드시 준수):**
- 해요체 사용: 모든 문장은 '~해요', '~있어요', '~드릴게요'로 끝내세요
- 간결하게: 한 문장은 가능한 짧고 명확하게
- 친근하게: 딱딱한 표현 대신 부드럽고 친근한 말투
- 긍정적으로: 부정적 표현보다 긍정적인 안내
- 예시: "계획이 없습니다" → "아직 등록된 일정이 없어요"
- 예시: "확인하십시오" → "확인해보세요"
`;
    
    return `당신은 사용자의 개인 일정 매니저예요. 일간 일정을 바탕으로 주간, 월간, 분기 계획을 친근하게 정리해드려요.

${tossStyleGuide}

**이번 주(${keys.weekKey}) 일간 일정 (${uniqueWeeklySchedules.length}개):**
${formatSchedules(uniqueWeeklySchedules)}

**이번 달(${keys.monthKey}) 일간 일정 (${uniqueMonthlySchedules.length}개):**
${formatSchedules(uniqueMonthlySchedules)}

**이번 분기(${keys.quarterKey}) 일간 일정 (${uniqueQuarterlySchedules.length}개):**
${formatSchedules(uniqueQuarterlySchedules)}

**사용자 정보:**
- 이름: ${userInfo.name || '사용자'}님
- 직업: ${userInfo.job || '미입력'}
- 성향: ${userInfo.personality || '미입력'}

**작성 요청:**
위 일간 일정 데이터를 기반으로 각 기간별 계획 요약을 작성해주세요.
- summary는 토스체로 친근하게 작성해주세요
- 등록된 일정이 없으면 "아직 등록된 일정이 없어요. 새로운 일정을 추가해보세요!" 형태로 안내해주세요
- 일정이 있으면 주요 일정을 친근하게 요약해주세요

다음 JSON 형식으로 응답해주세요:
{
  "weekly": {
    "weekKey": "${keys.weekKey}",
    "schedules": [
      { "date": "YYYY-MM-DD", "time": "HH:MM", "title": "일정 제목", "duration": 60, "priority": "medium" }
    ],
    "summary": "이번 주에는 N개의 일정이 있어요. (토스체로 요약)"
  },
  "monthly": {
    "monthKey": "${keys.monthKey}",
    "schedules": [
      { "date": "YYYY-MM-DD", "time": "HH:MM", "title": "일정 제목", "duration": 60, "priority": "medium" }
    ],
    "summary": "이번 달에는 N개의 일정이 있어요. (토스체로 요약)"
  },
  "quarterly": {
    "quarterKey": "${keys.quarterKey}",
    "schedules": [
      { "date": "YYYY-MM-DD", "time": "HH:MM", "title": "일정 제목", "duration": 60, "priority": "medium" }
    ],
    "summary": "이번 분기에는 N개의 일정이 있어요. (토스체로 요약)"
  }
}

**중요: schedules 배열의 각 일정은 반드시 위 형식(date, time, title, duration, priority)을 따라주세요. 일정이 없으면 빈 배열 []을 반환하세요.**

응답은 JSON 형식만 제공하고, 추가 설명은 하지 마세요.`;
  }

  parseSyncResponse(text) {
    try {
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error('Failed to parse sync response:', error);
      return null;
    }
  }

  async reviewScheduleChanges(schedules, userInfo, changeType) {
    if (!this.apiKey) {
      throw new Error('Gemini API key is not set');
    }

    const prompt = this.buildReviewPrompt(schedules, userInfo, changeType);

    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();
      return data.candidates[0]?.content?.parts[0]?.text || '';
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw error;
    }
  }

  buildReviewPrompt(schedules, userInfo, changeType) {
    return `일정이 ${changeType === 'delete' ? '삭제' : changeType === 'reorder' ? '재배치' : '업데이트'}되었습니다. 변경된 일정을 검토하고 최적화 방안을 제안해주세요.

사용자 정보:
- 이름: ${userInfo.name || '미입력'}
- 직업: ${userInfo.job || '미입력'}
- 성향: ${userInfo.personality || '미입력'}

현재 일정:
${JSON.stringify(schedules, null, 2)}

변경 사항을 검토하고 필요시 최적화 방안을 제안해주세요.`;
  }

  // ============================================
  // 채팅 기능 - 개인 일정 관리 에이전트
  // ============================================

  async chat({ message, userInfo, scheduleContext, clientLocalTime, chatHistory = [] }) {
    if (!this.apiKey) {
      throw new Error('Gemini API key is not set');
    }

    const prompt = this.buildChatPrompt({
      message,
      userInfo,
      scheduleContext,
      clientLocalTime,
      chatHistory
    });

    try {
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            maxOutputTokens: 2048
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API request failed');
      }

      const data = await response.json();
      const text = data.candidates[0]?.content?.parts[0]?.text || '';
      
      return text.trim();
    } catch (error) {
      console.error('Gemini Chat API Error:', error);
      throw error;
    }
  }

  buildChatPrompt({ message, userInfo, scheduleContext, clientLocalTime, chatHistory }) {
    const { dailySchedules, weeklyPlan, monthlyPlan, quarterlyPlan } = scheduleContext;
    
    // 오늘 날짜와 시간 정보
    const now = new Date(clientLocalTime);
    const todayStr = now.toLocaleDateString('ko-KR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric', 
      weekday: 'long' 
    });
    const currentTimeStr = now.toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    // 일간 일정 포맷팅
    const formatDailySchedules = (schedules) => {
      if (!schedules || schedules.length === 0) {
        return '(등록된 일정이 없어요)';
      }
      return schedules.map(s => {
        const status = s.completed ? '✅ 완료' : '⏳ 예정';
        const durationHours = (s.duration / 60).toFixed(1);
        return `- [${s.time}] ${s.title} (${durationHours}시간, ${status})`;
      }).join('\n');
    };

    // 주간 일정 포맷팅
    const formatWeeklySchedules = (weeklyData) => {
      if (!weeklyData || !weeklyData.schedules || weeklyData.schedules.length === 0) {
        return '(등록된 일정이 없어요)';
      }
      return weeklyData.schedules.map(s => {
        const durationHours = ((s.duration || 60) / 60).toFixed(1);
        return `- [${s.date}] ${s.time || '미정'}: ${s.title} (${durationHours}시간)`;
      }).join('\n');
    };

    // 월간 일정 포맷팅
    const formatMonthlySchedules = (monthlyData) => {
      if (!monthlyData || !monthlyData.schedules || monthlyData.schedules.length === 0) {
        return '(등록된 일정이 없어요)';
      }
      return monthlyData.schedules.map(s => {
        const durationHours = ((s.duration || 60) / 60).toFixed(1);
        return `- [${s.date}] ${s.time || '미정'}: ${s.title} (${durationHours}시간)`;
      }).join('\n');
    };

    // 분기 일정 포맷팅
    const formatQuarterlySchedules = (quarterlyData) => {
      if (!quarterlyData || !quarterlyData.schedules || quarterlyData.schedules.length === 0) {
        return '(등록된 일정이 없어요)';
      }
      return quarterlyData.schedules.map(s => {
        const durationHours = ((s.duration || 60) / 60).toFixed(1);
        return `- [${s.date}] ${s.time || '미정'}: ${s.title} (${durationHours}시간)`;
      }).join('\n');
    };

    // 이전 대화 내역 포맷팅
    const formatChatHistory = (history) => {
      if (!history || history.length === 0) {
        return '';
      }
      return history.slice(-6).map(msg => {
        const role = msg.role === 'user' ? '사용자' : '어시스턴트';
        return `${role}: ${msg.content}`;
      }).join('\n');
    };

    const historySection = chatHistory.length > 0 
      ? `\n## 이전 대화 내역\n${formatChatHistory(chatHistory)}\n` 
      : '';

    return `당신은 개인 일정 관리를 도와주는 친근한 AI 어시스턴트예요. 사용자의 일정과 계획에 대한 질문에 답변하고, 효율적인 시간 관리를 위한 조언을 제공해요.

## 페르소나 & 말투 스타일
- 토스(Toss)의 따뜻하고 친근한 말투를 사용해요
- "~해요", "~이에요", "~네요" 처럼 부드러운 종결어를 사용해요
- 이모지를 적절히 활용해서 친근감을 더해요 (과하지 않게)
- 짧고 명확한 문장을 사용하고, 핵심을 먼저 말해요
- 사용자를 ${userInfo.name || '회원'}님으로 부르며 존중해요
- 공감과 격려의 표현을 자연스럽게 넣어요
- 필요할 때는 리스트나 구조화된 형태로 정보를 정리해서 전달해요

## 현재 시간 정보
- 오늘: ${todayStr}
- 현재 시간: ${currentTimeStr}

## 사용자 프로필
- 이름: ${userInfo.name || '(미입력)'}
- 직업: ${userInfo.job || '(미입력)'}
- 성향: ${userInfo.personality || '(미입력)'}

## 오늘의 일정 (${this.getLocalDateKey(now)})
${formatDailySchedules(dailySchedules)}

## 이번 주 일정
${formatWeeklySchedules(weeklyPlan)}

## 이번 달 일정
${formatMonthlySchedules(monthlyPlan)}

## 이번 분기 일정
${formatQuarterlySchedules(quarterlyPlan)}
${historySection}
## 응답 가이드라인
1. 사용자의 일정 데이터를 기반으로 정확한 정보를 제공해요
2. 일정 관련 질문에는 구체적인 날짜와 시간을 포함해서 답변해요
3. 일정 추가/수정/삭제는 직접 할 수 없지만, 적절한 조언을 제공할 수 있어요
4. 업무 효율성, 시간 관리, 우선순위 설정에 대한 조언을 해줄 수 있어요
5. 사용자의 성향을 고려해서 맞춤형 조언을 제공해요
6. 너무 길지 않게, 핵심 위주로 답변해요

## 사용자 질문
${message}

위 정보를 참고해서 사용자의 질문에 친근하고 도움이 되는 답변을 해주세요.`;
  }

  // 날짜 키 생성 헬퍼 (로컬 타임존 기준)
  getLocalDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

