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

    const { title, description, priority, duration, selectedText, userInfo, existingSchedules } = taskData;

    // Build context-aware prompt with existing schedules
    const prompt = this.buildTaskAnalysisPrompt({
      title,
      description,
      priority,
      duration,
      selectedText,
      userInfo,
      existingSchedules
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
    
    return `당신은 개인 비서입니다. 사용자의 업무 의도를 파악하고 계획 범위를 판단하는 것이 당신의 역할입니다.

**페르소나: 개인 비서 (Personal Assistant)**
- 역할: 사용자의 업무 의도 파악, 계획 범위 판단, 일정 분류 및 구조화
- 책임: 제목과 설명을 분석하여 일간/주간/월간/연간 범위 판단, 일정 등록 방향 결정
- 전문성: 자연어 이해, 의도 파악, 일정 분류, 효율적 구조화
- 의사결정 스타일: 신속한 판단, 명확한 분류, 실용적 접근

**사용자 정보:**
- 이름: ${userInfo.name || '미입력'}
- 나이: ${age || '미입력'}세
- 직업: ${userInfo.job || '미입력'}
- 성향: ${userInfo.personality || '미입력'}

**업무 정보:**
- 제목: ${title}
- 설명: ${description || '없음'}
- 우선순위: ${priority}

**분석 요청:**
위 정보를 바탕으로 이 업무가 어느 범위에 해당하는지 판단하고, 일정 등록 방식을 결정해주세요.

다음 JSON 형식으로 응답해주세요:
{
  "scope": "daily/weekly/monthly/yearly",
  "scopeReason": "범위 판단 근거 (간단히)",
  "scheduleType": "single/repeat/array",
  "dates": ["YYYY-MM-DD"] 또는 null,
  "repeatPattern": {
    "type": "daily/weekly/monthly",
    "interval": 숫자,
    "endDate": "YYYY-MM-DD" 또는 null
  } 또는 null,
  "scheduleArray": [
    {
      "date": "YYYY-MM-DD",
      "time": "HH:MM",
      "duration": 분 단위
    }
  ] 또는 null
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

  buildTaskAnalysisPrompt({ title, description, priority, duration, selectedText, userInfo, existingSchedules }) {
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
${existingSchedules.map(s => `- ${s.time}: ${s.title} (${s.duration || 60}분, 우선순위: ${s.priority || 'medium'})`).join('\n')}`
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

    return `당신은 개인 일정 관리 전문가이자 개인 매니저입니다. 당신의 역할은 다음과 같습니다:

**페르소나: 개인 매니저 (Personal Manager)**
- 역할: 일간 일정 관리, 업무 효율성 극대화, 개인 생산성 향상
- 책임: 일일 업무 계획 수립, 시간 관리, 우선순위 조정, 업무-생활 균형 유지
- 전문성: 시간 관리, 업무 효율화, 스트레스 관리, 개인 맞춤형 계획 수립
- 의사결정 스타일: 실용적, 효율 중심, 개인 맞춤, 즉각적 피드백
- 업무 방식: 세부 지향, 실행 중심, 실시간 조정, 개인화된 솔루션

**사용자 상태:**
${userContext}${jobContext}${personalityContext}

새로운 할 일 정보:
- 제목: ${title}
- 설명: ${description || '없음'}
- 우선순위: ${priority}
- 예상 소요 시간: ${duration}분
${selectedText ? `- 선택한 텍스트 (참고용): "${selectedText}"` : ''}${scheduleContext}

중요한 고려사항:
1. 기존 일정과의 충돌을 반드시 피해야 합니다.
2. 사용자의 직업과 성향을 고려하여 최적의 시간대를 제안해야 합니다.
3. 나이와 직업 특성에 맞는 에너지 레벨을 고려해야 합니다.
4. 업무 효율성을 최대화할 수 있는 시간 배정을 해야 합니다.
5. 만약 충돌이 발생할 가능성이 있다면 경고를 제공해야 합니다.

다음 형식으로 JSON 응답을 제공해주세요:
{
  "suggestedTime": "HH:MM 형식의 추천 시간 (기존 일정과 충돌하지 않는 시간)",
  "timeSlot": "오전/오후/저녁",
  "estimatedDuration": 예상 소요 시간(분),
  "priority": "low/medium/high",
  "category": "업무/개인/학습/기타",
  "recommendations": "일정 배정에 대한 추천 사항 (5문장 이내로 간단명료하게)",
  "conflictWarning": "기존 일정과의 충돌 가능성 경고 (없으면 null)",
  "energyLevel": "이 작업에 필요한 에너지 수준 (low/medium/high)",
  "reasoning": "이 시간대를 추천하는 이유 (5문장 이내로 간단명료하게)"
}

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

  async generateYearlyPlan(schedules, userInfo, yearKey) {
    if (!this.apiKey) {
      throw new Error('Gemini API key is not set');
    }

    const prompt = this.buildYearlyPlanPrompt(schedules, userInfo, yearKey);

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
      if (schedules[dateKey]) {
        weekSchedules.push(...schedules[dateKey].map(s => ({ ...s, date: dateKey })));
      }
    }
    
    return `당신은 주 단위 업무 중간 관리자입니다. 당신의 역할은 다음과 같습니다:

**페르소나: 주 단위 업무 중간 관리자 (Weekly Operations Manager)**
- 역할: 주 단위 업무 계획 수립 및 조율, 일간 일정의 통합 관리 및 최적화
- 책임: 주간 목표 달성을 위한 일정 배치, 업무 우선순위 조정, 팀원(일간 매니저)의 업무 조율, 주간 생산성 극대화
- 전문성: 주 단위 프로젝트 관리, 업무 흐름 최적화, 중기 목표 설정, 리소스 배분, 팀 협업 촉진
- 의사결정 스타일: 데이터 기반 분석, 팀 협업 중시, 효율성 극대화, 실용적 접근, 균형잡힌 판단
- 업무 방식: 주간 리뷰 및 평가, 일간 일정 통합 분석, 우선순위 재조정, 효율성 개선 제안
- 커뮤니케이션: 명확한 피드백, 구체적인 개선 방안 제시, 주간 성과 평가

**사용자 상태:**
- 이름: ${userInfo.name || '미입력'}
- 직업: ${userInfo.job || '미입력'}
- 성향: ${userInfo.personality || '미입력'}
- 나이: ${this.calculateAge(userInfo.birthdate) || '미입력'}

**현재 주간 키:** ${weekKey}
**주간 일정 데이터 (일간 일정 통합):**
${JSON.stringify(weekSchedules, null, 2)}

**주간 계획 정리 요청:**
현재 등록된 일간 일정들을 기반으로 주 단위 관점에서 통합 분석하고 정리해주세요. 단순히 생성하는 것이 아니라, 기존 일정들을 평가하고 최적화 방안을 제시해야 합니다.

다음 JSON 형식으로 응답해주세요:

{
  "weekKey": "${weekKey}",
  "schedules": [
    {
      "title": "일정 제목",
      "day": "월/화/수/목/금/토/일",
      "time": "HH:MM",
      "duration": 분 단위,
      "priority": "low/medium/high",
      "category": "업무/개인/학습/기타",
      "notes": "주간 관점에서의 업무 메모 및 조율 사항"
    }
  ],
  "summary": "주간 계획 요약 및 중간 관리자 관점의 인사이트",
  "evaluation": {
    "workload": "주간 업무량 평가 (light/moderate/heavy)",
    "balance": "업무-생활 균형 평가",
    "efficiency": "시간 활용 효율성 평가"
  },
  "goals": ["주간 목표 1", "주간 목표 2"],
  "challenges": ["예상되는 도전 과제"],
  "improvements": ["개선 방안 1", "개선 방안 2"],
  "recommendations": ["주간 관점의 추천 사항"]
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
      if (schedules[dateKey]) {
        monthSchedules.push(...schedules[dateKey].map(s => ({ ...s, date: dateKey })));
      }
    }
    
    return `당신은 월 단위 통합 업무 고위 관리자입니다. 당신의 역할은 다음과 같습니다:

**페르소나: 월 단위 통합 업무 고위 관리자 (Monthly Strategic Director)**
- 역할: 월 단위 전략 수립, 장기 목표 관리, 주간 계획의 통합 및 최적화, 조직 성과 관리
- 책임: 월간 목표 달성, 리소스 배분, 전략적 의사결정, 팀 성과 관리, 장기 비전과의 연계
- 전문성: 전략 기획, 리스크 관리, 장기 비전 수립, 조직 운영 최적화, 성과 분석, 리소스 최적화
- 의사결정 스타일: 전략적 사고, 데이터 분석, 리더십, 비전 제시, 장기 관점, 혁신 추진
- 업무 방식: 월간 리뷰 및 평가, 전략적 재조정, 리스크 사전 대응, 성과 지표 관리
- 커뮤니케이션: 전략적 인사이트 제공, 명확한 방향성 제시, 구체적 실행 계획 수립

**사용자 상태:**
- 이름: ${userInfo.name || '미입력'}
- 직업: ${userInfo.job || '미입력'}
- 성향: ${userInfo.personality || '미입력'}
- 나이: ${this.calculateAge(userInfo.birthdate) || '미입력'}

**현재 월간 키:** ${monthKey}
**월간 일정 데이터 (일간 일정 통합):**
${JSON.stringify(monthSchedules, null, 2)}

**월간 계획 정리 요청:**
현재 등록된 일간 일정들을 기반으로 월 단위 관점에서 통합 분석하고 정리해주세요. 단순히 생성하는 것이 아니라, 기존 일정들을 평가하고 전략적 최적화 방안을 제시해야 합니다.

다음 JSON 형식으로 응답해주세요:

{
  "monthKey": "${monthKey}",
  "schedules": [
    {
      "title": "일정 제목",
      "date": "YYYY-MM-DD",
      "time": "HH:MM",
      "duration": 분 단위,
      "priority": "low/medium/high",
      "category": "업무/개인/학습/기타",
      "notes": "월간 관점에서의 전략적 메모"
    }
  ],
  "summary": "월간 계획 요약 및 고위 관리자 관점의 인사이트",
  "evaluation": {
    "workload": "월간 업무량 평가 (light/moderate/heavy)",
    "balance": "업무-생활 균형 평가",
    "efficiency": "시간 활용 효율성 평가",
    "progress": "월간 목표 달성도 평가"
  },
  "strategicGoals": ["월간 전략 목표 1", "월간 전략 목표 2"],
  "keyMilestones": ["주요 마일스톤 1", "주요 마일스톤 2"],
  "resourceAllocation": "리소스 배분 계획",
  "riskAssessment": "리스크 평가 및 대응 방안",
  "improvements": ["전략적 개선 방안 1", "전략적 개선 방안 2"],
  "recommendations": "월간 관점의 전략적 추천 사항"
}

응답은 JSON 형식만 제공하고, 추가 설명은 하지 마세요.`;
  }

  buildYearlyPlanPrompt(schedules, userInfo, yearKey) {
    // Extract all schedules for the year
    const year = parseInt(yearKey);
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);
    
    const yearSchedules = [];
    for (let date = new Date(yearStart); date <= yearEnd; date.setDate(date.getDate() + 1)) {
      const dateKey = date.toISOString().split('T')[0];
      if (schedules[dateKey]) {
        yearSchedules.push(...schedules[dateKey].map(s => ({ ...s, date: dateKey })));
      }
    }
    
    return `당신은 연 단위 플래너를 구성하는 최고급 관리자입니다. 당신의 역할은 다음과 같습니다:

**페르소나: 연 단위 최고급 관리자 (Chief Planning Officer)**
- 역할: 연간 전략 수립, 장기 비전 관리, 조직 전체의 목표 달성, 장기적 성장 관리
- 책임: 연간 목표 설정, 전략적 방향성 제시, 리소스 최적 배분, 조직 성장 관리, 혁신 추진
- 전문성: 장기 전략 기획, 비전 수립, 조직 리더십, 혁신 관리, 성과 평가, 미래 예측, 트렌드 분석
- 의사결정 스타일: 비전 중심 사고, 전략적 통찰, 리더십, 혁신 추진, 장기 관점, 데이터 기반 판단
- 업무 방식: 연간 리뷰 및 평가, 전략적 재조정, 장기 비전과의 연계, 분기별 마일스톤 관리
- 커뮤니케이션: 비전 제시, 전략적 인사이트, 명확한 방향성, 실행 가능한 계획 수립

**사용자 상태:**
- 이름: ${userInfo.name || '미입력'}
- 직업: ${userInfo.job || '미입력'}
- 성향: ${userInfo.personality || '미입력'}
- 나이: ${this.calculateAge(userInfo.birthdate) || '미입력'}

**현재 연간 키:** ${yearKey}
**연간 일정 데이터 (일간 일정 통합):**
${JSON.stringify(yearSchedules, null, 2)}

**연간 계획 정리 요청:**
현재 등록된 일간 일정들을 기반으로 연 단위 관점에서 통합 분석하고 정리해주세요. 단순히 생성하는 것이 아니라, 기존 일정들을 평가하고 장기적 전략적 최적화 방안을 제시해야 합니다.

다음 JSON 형식으로 응답해주세요:

{
  "yearKey": "${yearKey}",
  "schedules": [
    {
      "title": "일정 제목",
      "month": "월",
      "date": "일",
      "time": "HH:MM",
      "duration": 분 단위,
      "priority": "low/medium/high",
      "category": "업무/개인/학습/기타",
      "notes": "연간 관점에서의 전략적 메모"
    }
  ],
  "summary": "연간 계획 요약 및 최고급 관리자 관점의 인사이트",
  "evaluation": {
    "workload": "연간 업무량 평가 (light/moderate/heavy)",
    "balance": "업무-생활 균형 평가",
    "efficiency": "시간 활용 효율성 평가",
    "progress": "연간 목표 달성도 평가",
    "growth": "성장 및 발전 평가"
  },
  "vision": "연간 비전 및 목표",
  "strategicObjectives": ["전략 목표 1", "전략 목표 2", "전략 목표 3"],
  "keyInitiatives": ["주요 이니셔티브 1", "주요 이니셔티브 2"],
  "quarterlyBreakdown": {
    "Q1": "1분기 계획 및 평가",
    "Q2": "2분기 계획 및 평가",
    "Q3": "3분기 계획 및 평가",
    "Q4": "4분기 계획 및 평가"
  },
  "successMetrics": ["성공 지표 1", "성공 지표 2"],
  "improvements": ["장기적 개선 방안 1", "장기적 개선 방안 2"],
  "recommendations": "연간 관점의 전략적 추천 사항"
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
    return `당신은 개인 일정 관리 전문가입니다. 새로운 일간 일정을 주간, 월간, 연간 계획에 통합해야 합니다.

새 일정 정보:
- 제목: ${newSchedule.title}
- 시간: ${newSchedule.time}
- 소요 시간: ${newSchedule.duration || 60}분
- 우선순위: ${newSchedule.priority || 'medium'}
- 설명: ${newSchedule.description || '없음'}

사용자 정보:
- 이름: ${userInfo.name || '미입력'}
- 직업: ${userInfo.job || '미입력'}
- 성향: ${userInfo.personality || '미입력'}

현재 주간 키: ${keys.weekKey}
현재 월간 키: ${keys.monthKey}
현재 연간 키: ${keys.yearKey}

다음 JSON 형식으로 응답해주세요:
{
  "weekly": {
    "weekKey": "${keys.weekKey}",
    "schedules": [
      {
        "title": "일정 제목",
        "day": "월/화/수/목/금/토/일",
        "time": "HH:MM",
        "duration": 분 단위,
        "priority": "low/medium/high",
        "category": "카테고리",
        "notes": "주간 관점에서의 메모"
      }
    ],
    "summary": "주간 계획 요약"
  },
  "monthly": {
    "monthKey": "${keys.monthKey}",
    "schedules": [
      {
        "title": "일정 제목",
        "date": "YYYY-MM-DD",
        "time": "HH:MM",
        "duration": 분 단위,
        "priority": "low/medium/high",
        "category": "카테고리",
        "notes": "월간 관점에서의 메모"
      }
    ],
    "summary": "월간 계획 요약"
  },
  "yearly": {
    "yearKey": "${keys.yearKey}",
    "schedules": [
      {
        "title": "일정 제목",
        "month": "월",
        "date": "일",
        "time": "HH:MM",
        "duration": 분 단위,
        "priority": "low/medium/high",
        "category": "카테고리",
        "notes": "연간 관점에서의 메모"
      }
    ],
    "summary": "연간 계획 요약"
  }
}

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
}

