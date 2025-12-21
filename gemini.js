/**
 * Gemini API Integration
 * Handles AI-powered task analysis and scheduling
 */

import { i18n } from './i18n.js';

export class GeminiAPI {
  constructor(apiKey, model = 'gemini-2.5-flash', language = 'ko') {
    this.apiKey = apiKey;
    this.model = model;
    this.language = language;
    this.baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  }

  // Helper method to get translated text
  t(key, params = {}) {
    // Use i18n if available, otherwise fallback to direct access
    if (typeof i18n !== 'undefined' && i18n.t) {
      return i18n.t(key, params);
    }
    // Fallback: return key if i18n not available
    return key;
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
    const lang = this.language || 'ko';
    const locale = lang === 'ko' ? 'ko-KR' : 'en-US';
    
    // 클라이언트 로컬 시간
    const now = clientLocalTime ? new Date(clientLocalTime) : new Date();
    const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // 대상 날짜가 오늘인지 확인
    const today = this.getLocalDateKey(now);
    const isToday = targetDate === today;
    
    // 시간을 시간 단위로 변환
    const durationHours = (duration / 60).toFixed(1);
    
    // 기존 일정 포맷팅 (완료된 일정은 이미 필터링됨)
    const hoursText = this.t('prompts.hours');
    const scheduleContext = existingSchedules && existingSchedules.length > 0
      ? `\n${this.t('prompts.targetDateSchedules', { date: targetDate })}\n${existingSchedules.map(s => `- ${s.time}: ${s.title} (${((s.duration || 60) / 60).toFixed(1)}${hoursText}, ${this.t('prompts.priority')}: ${s.priority || 'medium'})`).join('\n')}`
      : `\n${this.t('prompts.targetDateNoSchedules', { date: targetDate })}`;

    const tossStyleGuide = `
${this.t('prompts.tossStyleGuide')}
${this.t('prompts.tossStyle1')}
${this.t('prompts.tossStyle2')}
${this.t('prompts.tossStyle3')}
${this.t('prompts.tossStyle4')}
`;

    const todayText = isToday ? (lang === 'ko' ? '(오늘)' : '(Today)') : '';
    const workHoursText = lang === 'ko' ? '09:00 ~ 18:00 (8시간)' : '09:00 ~ 18:00 (8 hours)';
    const timeSlotText = lang === 'ko' ? '오전/오후' : 'Morning/Afternoon';
    const notEntered = this.t('prompts.notEntered');
    const none = this.t('prompts.none');
    const user = this.t('prompts.user');
    const member = this.t('prompts.member');

    return `${this.t('prompts.dailyManager', { name: userInfo.name || user, date: targetDate })}

${tossStyleGuide}

**${lang === 'ko' ? '현재 시간 정보' : 'Current Time Information'}:**
- ${lang === 'ko' ? '현재 시간' : 'Current Time'}: ${currentTimeStr}
- ${lang === 'ko' ? '대상 날짜' : 'Target Date'}: ${targetDate} ${todayText}
- ${lang === 'ko' ? '업무 가능 시간' : 'Available Work Hours'}: ${workHoursText}

**${this.t('prompts.userProfile', { name: userInfo.name || user, job: userInfo.job || notEntered, personality: userInfo.personality || notEntered })}**

**${this.t('prompts.newTask')}:**
- ${this.t('prompts.taskTitle')}: ${title}
- ${this.t('prompts.taskDescription')}: ${description || none}
- ${this.t('prompts.priority')}: ${priority}
- ${this.t('prompts.estimatedDuration')}: ${durationHours}${hoursText} (${duration}${this.t('prompts.minutes')})
${scheduleContext}

**${lang === 'ko' ? '중요 업무 규칙' : 'Important Task Rules'}:**
1. ${this.t('prompts.dateFixed', { date: targetDate })}
2. ${this.t('prompts.maxWorkHoursRule')}
3. ${this.t('prompts.maxSameTaskRule')}
4. ${this.t('prompts.splitOver4HoursRule2')}
5. ${this.t('prompts.noTimeConflict')}
${isToday ? `6. ${this.t('prompts.afterCurrentTimeRule', { time: currentTimeStr })}` : ''}
7. ${lang === 'ko' ? '**병렬 수행 가능**: 만약 해당 날짜에 일정이 가득 차서 새로운 일정을 추가할 수 없다면, 기존 일정과 동일한 시간대에 병렬로 수행 가능한 일정으로 배정해주세요. 예를 들어, 기존 일정이 "09:00-12:00 회의"라면, 새로운 일정도 "09:00-12:00" 시간대에 배정하여 병렬로 수행할 수 있도록 해주세요. 이 경우 scheduleArray에 동일한 time 값을 가진 일정을 포함시켜주세요.' : '**Parallel Execution Allowed**: If the target date is fully booked and a new schedule cannot be added, assign it as a parallel task at the same time slot as existing schedules. For example, if an existing schedule is "09:00-12:00 Meeting", assign the new schedule also at "09:00-12:00" to allow parallel execution. In this case, include schedules with the same time value in scheduleArray.'}

**${lang === 'ko' ? 'JSON 응답 형식' : 'JSON Response Format'}:**
{
  "suggestedTitle": "${lang === 'ko' ? '간결한 제목 (10자 이내)' : 'Concise title (within 10 characters)'}",
  "suggestedTime": "HH:MM (${lang === 'ko' ? '시작 시간' : 'Start time'})",
  "timeSlot": "${timeSlotText}",
  "estimatedDuration": ${duration},
  "durationHours": ${durationHours},
  "priority": "${priority || 'medium'}",
  "splitRequired": true/false,
  "scheduleArray": [
    {"time": "HH:MM", "duration": ${lang === 'ko' ? '분단위숫자' : 'minutes'}, "title": "${lang === 'ko' ? '업무명 (1/N)' : 'Task name (1/N)'}", "parallel": true/false}
  ],
  "recommendations": "${lang === 'ko' ? '시간 배분 안내 (토스체)' : 'Time allocation guide (friendly tone)'}",
  "conflictWarning": "${lang === 'ko' ? '충돌 경고 (없으면 null)' : 'Conflict warning (null if none)'}",
  "reasoning": "${lang === 'ko' ? '이 시간대를 추천하는 이유' : 'Reason for recommending this time slot'}"
}

**${lang === 'ko' ? 'splitRequired 규칙' : 'splitRequired Rules'}:**
- ${lang === 'ko' ? '소요시간이 4시간(240분) 이하: splitRequired: false' : 'If duration is 4 hours (240 minutes) or less: splitRequired: false'}
- ${lang === 'ko' ? '소요시간이 4시간(240분) 초과: splitRequired: true, scheduleArray에 4시간 단위로 분할' : 'If duration exceeds 4 hours (240 minutes): splitRequired: true, split into 4-hour units in scheduleArray'}

${this.t('prompts.jsonOnly')}`;
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
    const lang = this.language || 'ko';
    const age = this.calculateAge(userInfo.birthdate);
    const today = new Date().toISOString().split('T')[0];
    const user = this.t('prompts.user');
    const member = this.t('prompts.member');
    const notEntered = this.t('prompts.notEntered');
    const none = this.t('prompts.none');
    
    return `${this.t('prompts.scheduleSecretary', { name: userInfo.name || user })}

${this.t('prompts.scheduleSecretaryRole')}
${this.t('prompts.analyzeScope')}
${this.t('prompts.determineMethod')}

**${this.t('prompts.userProfile', { name: userInfo.name || user, job: userInfo.job || notEntered, personality: userInfo.personality || notEntered })}**
- ${this.t('prompts.age')}: ${age ? `${age}${this.t('prompts.ageUnit')}` : notEntered}

**${lang === 'ko' ? '오늘 날짜' : 'Today\'s Date'}:** ${today}

**${lang === 'ko' ? '업무 정보' : 'Task Information'}:**
- ${this.t('prompts.taskTitle')}: ${title}
- ${this.t('prompts.taskDescription')}: ${description || none}
- ${this.t('prompts.priority')}: ${priority}

**${lang === 'ko' ? '분석 요청' : 'Analysis Request'}:**
${this.t('prompts.scopeDecision')}
${this.t('prompts.dailyScope')}
${this.t('prompts.weeklyScope')}
${this.t('prompts.monthlyScope')}
${this.t('prompts.quarterlyScope')}

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
    const lang = this.language || 'ko';
    const locale = lang === 'ko' ? 'ko-KR' : 'en-US';
    
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
    const hoursText = this.t('prompts.hours');
    const scheduleContext = existingSchedules && existingSchedules.length > 0
      ? `\n${this.t('prompts.existingSchedules')}:\n${existingSchedules.map(s => `- ${s.time}: ${s.title} (${((s.duration || 60) / 60).toFixed(1)}${hoursText}, ${this.t('prompts.priority')}: ${s.priority || 'medium'})`).join('\n')}`
      : `\n${this.t('prompts.noExistingSchedules')}`;

    const user = this.t('prompts.user');
    const member = this.t('prompts.member');
    const notEntered = this.t('prompts.notEntered');
    const userContext = userInfo.name 
      ? `${this.t('prompts.userInfo')}:\n- ${this.t('prompts.name')}: ${userInfo.name}\n${age ? `- ${this.t('prompts.age')}: ${age}${this.t('prompts.ageUnit')}\n` : ''}- ${this.t('prompts.birthdate')}: ${userInfo.birthdate || notEntered}\n- ${this.t('prompts.gender')}: ${userInfo.gender || notEntered}\n- ${this.t('prompts.job')}: ${userInfo.job || notEntered}\n- ${this.t('prompts.personality')}: ${userInfo.personality || notEntered}\n`
      : '';

    // Build context-aware prompt considering user's job and personality
    let jobContext = '';
    if (userInfo.job) {
      const characteristics = this.getJobCharacteristics(userInfo.job);
      jobContext = `\n${this.t('prompts.jobConsiderations')}\n- ${this.t('prompts.job')}: ${userInfo.job}\n- ${this.t('prompts.jobCharacteristics', { characteristics })}\n- ${this.t('prompts.adjustWorkTime')}`;
    }

    let personalityContext = '';
    if (userInfo.personality) {
      personalityContext = `\n${this.t('prompts.personalityConsiderations')}\n- ${this.t('prompts.personalityNote', { personality: userInfo.personality })}\n- ${this.t('prompts.optimizeTime')}\n- ${this.t('prompts.maximizeEfficiency')}`;
    }

    const tossStyleGuide = `
${this.t('prompts.tossStyleGuide')}
${this.t('prompts.tossStyle1')}
${this.t('prompts.tossStyle2')}
${this.t('prompts.tossStyle3')}
${this.t('prompts.tossStyle4')}
${this.t('prompts.tossStyleExample1')}
${this.t('prompts.tossStyleExample2')}
`;

    const workHoursText = lang === 'ko' ? '09:00 ~ 18:00 (8시간)' : '09:00 ~ 18:00 (8 hours)';
    const none = this.t('prompts.none');
    const timeSlotText = this.t('prompts.timeSlot');
    const categoryText = this.t('prompts.category');

    return `${this.t('prompts.dailyManagerFriendly', { name: userInfo.name || user })}

${tossStyleGuide}

**${lang === 'ko' ? '현재 시간 정보' : 'Current Time Information'}:**
- ${lang === 'ko' ? '현재 날짜' : 'Current Date'}: ${currentDateStr}
- ${lang === 'ko' ? '현재 시간' : 'Current Time'}: ${currentTimeStr}
- ${lang === 'ko' ? '업무 시간' : 'Work Hours'}: ${workHoursText}

${this.t('prompts.dailyManagerRole')}
${this.t('prompts.planEfficiently')}
${this.t('prompts.preventConflict')}
${this.t('prompts.afterCurrentTimeOnly')}

**${this.t('prompts.userProfile', { name: userInfo.name || user, job: userInfo.job || notEntered, personality: userInfo.personality || notEntered })}**
${userContext}${jobContext}${personalityContext}

**${this.t('prompts.newTask')}:**
- ${this.t('prompts.taskTitle')}: ${title}
- ${this.t('prompts.taskDescription')}: ${description || none}
- ${this.t('prompts.priority')}: ${priority}
- ${this.t('prompts.estimatedDuration')}: ${durationHours}${hoursText} (${duration}${this.t('prompts.minutes')})
${selectedText ? `- ${this.t('prompts.referenceText')}: "${selectedText}"` : ''}${scheduleContext}

**${this.t('prompts.workRules')}:**
1. ${this.t('prompts.maxWorkHours')}
2. ${this.t('prompts.maxSameTask')}
3. ${this.t('prompts.splitOver4Hours')}
4. ${lang === 'ko' ? 'splitRequired가 true면 scheduleArray에 분할된 일정을 포함해주세요' : 'If splitRequired is true, include split schedules in scheduleArray'}

**${this.t('prompts.guidelines')}:**
1. ${this.t('prompts.noConflict')}
2. ${this.t('prompts.afterCurrentTime', { time: currentTimeStr })}
3. ${this.t('prompts.conciseTitle')}
4. ${this.t('prompts.includeTimeGuide')}
5. ${this.t('prompts.tossStyle')}

${lang === 'ko' ? '다음 JSON 형식으로 응답해주세요' : 'Please respond in the following JSON format'}:
{
  "suggestedTitle": "${lang === 'ko' ? '간결한 제목 (10자 이내)' : 'Concise title (within 10 characters)'}",
  "suggestedTime": "HH:MM (${lang === 'ko' ? '시작 시간, 현재 시간 이후' : 'Start time, after current time'})",
  "timeSlot": "${timeSlotText}",
  "estimatedDuration": ${duration || 60},
  "durationHours": ${durationHours},
  "priority": "${priority || 'medium'}",
  "category": "${categoryText}",
  "splitRequired": true/false,
  "scheduleArray": [
    {"date": "YYYY-MM-DD", "time": "HH:MM", "duration": ${lang === 'ko' ? '분단위숫자' : 'minutes'}, "title": "${lang === 'ko' ? '분할된 제목 (1/N)' : 'Split title (1/N)'}"}
  ],
  "recommendations": "${lang === 'ko' ? 'HH:MM에 시작해서 HH:MM까지 진행하시면 돼요. (토스체로 친근한 추가 안내)' : 'Start at HH:MM and proceed until HH:MM. (Additional friendly guidance in conversational tone)'}",
  "conflictWarning": "${lang === 'ko' ? '충돌 경고 메시지 (없으면 null, 있으면 토스체로)' : 'Conflict warning message (null if none, in conversational tone if present)'}",
  "energyLevel": "low/medium/high",
  "reasoning": "${lang === 'ko' ? '이 시간대를 추천하는 이유 (토스체로 2-3문장)' : 'Reason for recommending this time slot (2-3 sentences in conversational tone)'}"
}

**${this.t('prompts.splitRules')}:**
- ${this.t('prompts.splitUnder4Hours')}
- ${this.t('prompts.splitOver4HoursRule')}
- ${this.t('prompts.splitMaxHours')}

${this.t('prompts.jsonOnly')}`;
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
    const lang = this.language || 'ko';
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
${this.t('prompts.tossStyleGuide')}
${this.t('prompts.tossStyle1')}
${this.t('prompts.tossStyle2')}
${this.t('prompts.tossStyle3')}
${this.t('prompts.tossStyle4')}
`;
    
    const undecided = this.t('prompts.undecided');
    const minutesText = this.t('prompts.minutes');
    const schedulesText = weekSchedules.length > 0
      ? weekSchedules.map(s => `- [${s.date}] ${s.time || undecided}: ${s.title} (${s.duration || 60}${minutesText})`).join('\n')
      : `(${this.t('prompts.noScheduleInPeriod', { period: lang === 'ko' ? '주' : 'week' })})`;
    
    const user = this.t('prompts.user');
    const member = this.t('prompts.member');
    const notEntered = this.t('prompts.notEntered');
    
    return `${this.t('prompts.weeklyManager', { name: userInfo.name || user })}

${tossStyleGuide}

**${lang === 'ko' ? '역할: 주간 매니저' : 'Role: Weekly Manager'}**
- ${lang === 'ko' ? '이번 주 일간 일정들을 통합 분석해요' : 'Integrate and analyze this week\'s daily schedules'}
- ${lang === 'ko' ? '주간 목표와 핵심 업무를 정리해드려요' : 'Organize weekly goals and key tasks'}
- ${lang === 'ko' ? '효율적인 시간 활용을 도와드려요' : 'Help with efficient time management'}

**${userInfo.name || user}${lang === 'ko' ? '님 정보' : '\'s Information'}:**
- ${this.t('prompts.job')}: ${userInfo.job || notEntered}
- ${lang === 'ko' ? '성향' : 'Personality'}: ${userInfo.personality || notEntered}

**${this.t('prompts.thisWeekSchedule')} (${weekKey}):**
${schedulesText}

**${lang === 'ko' ? '작성 요청' : 'Writing Request'}:**
${lang === 'ko' ? '위 일간 일정을 바탕으로 주간 계획을 토스체로 친근하게 정리해주세요.' : 'Based on the daily schedules above, organize the weekly plan in a friendly, conversational tone.'}
- ${lang === 'ko' ? '일정이 없으면' : 'If no schedules'}: "${this.t('prompts.noScheduleInPeriod', { period: lang === 'ko' ? '주' : 'week' })}. ${this.t('prompts.addNewSchedule')}"
- ${lang === 'ko' ? '일정이 있으면' : 'If schedules exist'}: ${this.t('prompts.friendlySummary')}

${lang === 'ko' ? '다음 JSON 형식으로 응답해주세요' : 'Please respond in the following JSON format'}:
{
  "weekKey": "${weekKey}",
  "schedules": [${lang === 'ko' ? '일간 일정 배열' : 'daily schedule array'}],
  "summary": "${this.t('prompts.scheduleCount', { period: lang === 'ko' ? '주' : 'week', count: 'N' })} (${lang === 'ko' ? '토스체로 친근하게 요약' : 'friendly summary in conversational tone'})"
}

${this.t('prompts.jsonOnly')}`;
  }

  buildMonthlyPlanPrompt(schedules, userInfo, monthKey) {
    const lang = this.language || 'ko';
    const locale = lang === 'ko' ? 'ko-KR' : 'en-US';
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
${this.t('prompts.tossStyleGuide')}
${this.t('prompts.tossStyle1')}
${this.t('prompts.tossStyle2')}
${this.t('prompts.tossStyle3')}
${this.t('prompts.tossStyle4')}
`;
    
    const monthName = this.t('prompts.monthName', { month });
    const undecided = this.t('prompts.undecided');
    const minutesText = this.t('prompts.minutes');
    const schedulesText = monthSchedules.length > 0
      ? monthSchedules.map(s => `- [${s.date}] ${s.time || undecided}: ${s.title} (${s.duration || 60}${minutesText})`).join('\n')
      : `(${this.t('prompts.noScheduleInPeriod', { period: monthName })})`;
    
    const user = this.t('prompts.user');
    const member = this.t('prompts.member');
    const notEntered = this.t('prompts.notEntered');
    
    return `${this.t('prompts.monthlyManager', { name: userInfo.name || user })}

${tossStyleGuide}

**${lang === 'ko' ? '역할: 월간 매니저' : 'Role: Monthly Manager'}**
- ${lang === 'ko' ? '이번 달 일간 일정들을 통합 분석해요' : 'Integrate and analyze this month\'s daily schedules'}
- ${lang === 'ko' ? '월간 목표와 주요 마일스톤을 정리해드려요' : 'Organize monthly goals and key milestones'}
- ${lang === 'ko' ? '한 달의 흐름을 한눈에 볼 수 있게 도와드려요' : 'Help visualize the flow of the month at a glance'}

**${userInfo.name || user}${lang === 'ko' ? '님 정보' : '\'s Information'}:**
- ${this.t('prompts.job')}: ${userInfo.job || notEntered}
- ${lang === 'ko' ? '성향' : 'Personality'}: ${userInfo.personality || notEntered}

**${this.t('prompts.thisMonthSchedule')} (${monthName}, ${monthSchedules.length}${lang === 'ko' ? '개' : ''}):**
${schedulesText}

**${lang === 'ko' ? '작성 요청' : 'Writing Request'}:**
${lang === 'ko' ? '위 일간 일정을 바탕으로 월간 계획을 토스체로 친근하게 정리해주세요.' : 'Based on the daily schedules above, organize the monthly plan in a friendly, conversational tone.'}
- ${lang === 'ko' ? '일정이 없으면' : 'If no schedules'}: "${this.t('prompts.noScheduleInPeriod', { period: lang === 'ko' ? '달' : 'month' })}. ${this.t('prompts.addNewSchedule')}"
- ${lang === 'ko' ? '일정이 있으면' : 'If schedules exist'}: ${this.t('prompts.friendlySummary')}

${lang === 'ko' ? '다음 JSON 형식으로 응답해주세요' : 'Please respond in the following JSON format'}:
{
  "monthKey": "${monthKey}",
  "schedules": [${lang === 'ko' ? '일간 일정 배열' : 'daily schedule array'}],
  "summary": "${this.t('prompts.scheduleCount', { period: lang === 'ko' ? '달' : 'month', count: 'N' })} (${lang === 'ko' ? '토스체로 친근하게 요약' : 'friendly summary in conversational tone'})"
}

${this.t('prompts.jsonOnly')}`;
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
    
    const lang = this.language || 'ko';
    const locale = lang === 'ko' ? 'ko-KR' : 'en-US';
    const monthNames = lang === 'ko' 
      ? ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
      : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const quarterMonths = `${monthNames[quarterStartMonth]} ~ ${monthNames[quarterEndMonth]}`;
    
    const tossStyleGuide = `
${this.t('prompts.tossStyleGuide')}
${this.t('prompts.tossStyle1')}
${this.t('prompts.tossStyle2')}
${this.t('prompts.tossStyle3')}
${this.t('prompts.tossStyle4')}
`;
    
    const undecided = this.t('prompts.undecided');
    const minutesText = this.t('prompts.minutes');
    const schedulesText = quarterSchedules.length > 0
      ? quarterSchedules.map(s => `- [${s.date}] ${s.time || undecided}: ${s.title} (${s.duration || 60}${minutesText})`).join('\n')
      : `(${this.t('prompts.noScheduleInPeriod', { period: this.t('prompts.quarterName', { year, quarter }) })})`;
    
    const user = this.t('prompts.user');
    const member = this.t('prompts.member');
    const notEntered = this.t('prompts.notEntered');
    const quarterName = this.t('prompts.quarterName', { year, quarter });
    
    return `${this.t('prompts.quarterlyManager', { name: userInfo.name || user })}

${tossStyleGuide}

**${lang === 'ko' ? '역할: 분기 매니저' : 'Role: Quarterly Manager'}**
- ${lang === 'ko' ? '이번 분기 일간 일정들을 통합 분석해요' : 'Integrate and analyze this quarter\'s daily schedules'}
- ${lang === 'ko' ? '분기 목표와 주요 마일스톤을 정리해드려요' : 'Organize quarterly goals and key milestones'}
- ${lang === 'ko' ? '3개월의 흐름을 한눈에 볼 수 있게 도와드려요' : 'Help visualize the flow of 3 months at a glance'}

**${userInfo.name || user}${lang === 'ko' ? '님 정보' : '\'s Information'}:**
- ${this.t('prompts.job')}: ${userInfo.job || notEntered}
- ${lang === 'ko' ? '성향' : 'Personality'}: ${userInfo.personality || notEntered}

**${this.t('prompts.thisQuarterSchedule')} (${quarterName}, ${this.t('prompts.quarterMonths', { months: quarterMonths })}):**
${lang === 'ko' ? '등록된 일정' : 'Registered schedules'}: ${quarterSchedules.length}${lang === 'ko' ? '개' : ''}
${schedulesText}

**${lang === 'ko' ? '작성 요청' : 'Writing Request'}:**
${lang === 'ko' ? '위 일간 일정을 바탕으로 분기 계획을 토스체로 친근하게 정리해주세요.' : 'Based on the daily schedules above, organize the quarterly plan in a friendly, conversational tone.'}
- ${lang === 'ko' ? '일정이 없으면' : 'If no schedules'}: "${this.t('prompts.noScheduleInPeriod', { period: lang === 'ko' ? '분기' : 'quarter' })}. ${this.t('prompts.addNewSchedule')}"
- ${lang === 'ko' ? '일정이 있으면' : 'If schedules exist'}: ${this.t('prompts.friendlySummary')}

${lang === 'ko' ? '다음 JSON 형식으로 응답해주세요' : 'Please respond in the following JSON format'}:
{
  "quarterKey": "${quarterKey}",
  "schedules": [${lang === 'ko' ? '일간 일정 배열' : 'daily schedule array'}],
  "summary": "${this.t('prompts.scheduleCount', { period: lang === 'ko' ? '분기' : 'quarter', count: 'N' })} (${lang === 'ko' ? '토스체로 친근하게 요약' : 'friendly summary in conversational tone'})"
}

${this.t('prompts.jsonOnly')}`;
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
    
    const lang = this.language || 'ko';
    // Format schedules for prompt
    const undecided = this.t('prompts.undecided');
    const minutesText = this.t('prompts.minutes');
    const complete = this.t('prompts.complete');
    const formatSchedules = (arr) => arr.length > 0 
      ? arr.map(s => `- [${s.date}] ${s.time || undecided}: ${s.title} (${s.duration || 60}${minutesText}, ${this.t('prompts.priority')}: ${s.priority || 'medium'}${s.completed ? `, ${complete}` : ''})`).join('\n')
      : `(${this.t('prompts.noScheduleYet')})`;
    
    console.log('Collected schedules (after dedup):', {
      weekly: uniqueWeeklySchedules.length,
      monthly: uniqueMonthlySchedules.length,
      quarterly: uniqueQuarterlySchedules.length
    });
    
    const tossStyleGuide = `
${this.t('prompts.tossStyleGuide')}
${this.t('prompts.tossStyle1')}
${this.t('prompts.tossStyle2')}
${this.t('prompts.tossStyle3')}
${this.t('prompts.tossStyle4')}
${this.t('prompts.tossStyleExample1')}
- ${lang === 'ko' ? '예시' : 'Example'}: "${lang === 'ko' ? '확인하십시오' : 'Please check'}" → "${lang === 'ko' ? '확인해보세요' : 'Please check'}"
`;
    
    const user = this.t('prompts.user');
    const member = this.t('prompts.member');
    const notEntered = this.t('prompts.notEntered');
    const countText = lang === 'ko' ? '개' : '';
    
    return `${this.t('prompts.scheduleManager')}

${tossStyleGuide}

**${this.t('prompts.thisWeekSchedule')} (${keys.weekKey}) (${uniqueWeeklySchedules.length}${countText}):**
${formatSchedules(uniqueWeeklySchedules)}

**${this.t('prompts.thisMonthSchedule')} (${keys.monthKey}) (${uniqueMonthlySchedules.length}${countText}):**
${formatSchedules(uniqueMonthlySchedules)}

**${this.t('prompts.thisQuarterSchedule')} (${keys.quarterKey}) (${uniqueQuarterlySchedules.length}${countText}):**
${formatSchedules(uniqueQuarterlySchedules)}

**${this.t('prompts.userProfile', { name: userInfo.name || user, job: userInfo.job || notEntered, personality: userInfo.personality || notEntered })}**

**${lang === 'ko' ? '작성 요청' : 'Writing Request'}:**
${lang === 'ko' ? '위 일간 일정 데이터를 기반으로 각 기간별 계획 요약을 작성해주세요.' : 'Based on the daily schedule data above, write a summary for each period.'}
- ${lang === 'ko' ? 'summary는 토스체로 친근하게 작성해주세요' : 'Write summary in a friendly, conversational tone'}
- ${lang === 'ko' ? '등록된 일정이 없으면' : 'If no schedules registered'}: "${this.t('prompts.noScheduleYet')}. ${this.t('prompts.addNewSchedule')}" ${lang === 'ko' ? '형태로 안내해주세요' : 'format'}
- ${lang === 'ko' ? '일정이 있으면 주요 일정을 친근하게 요약해주세요' : 'If schedules exist, summarize key schedules in a friendly way'}

${lang === 'ko' ? '다음 JSON 형식으로 응답해주세요' : 'Please respond in the following JSON format'}:
{
  "weekly": {
    "weekKey": "${keys.weekKey}",
    "schedules": [
      { "date": "YYYY-MM-DD", "time": "HH:MM", "title": "${lang === 'ko' ? '일정 제목' : 'Schedule title'}", "duration": 60, "priority": "medium" }
    ],
    "summary": "${this.t('prompts.scheduleCount', { period: lang === 'ko' ? '주' : 'week', count: 'N' })} (${lang === 'ko' ? '토스체로 요약' : 'summary in conversational tone'})"
  },
  "monthly": {
    "monthKey": "${keys.monthKey}",
    "schedules": [
      { "date": "YYYY-MM-DD", "time": "HH:MM", "title": "${lang === 'ko' ? '일정 제목' : 'Schedule title'}", "duration": 60, "priority": "medium" }
    ],
    "summary": "${this.t('prompts.scheduleCount', { period: lang === 'ko' ? '달' : 'month', count: 'N' })} (${lang === 'ko' ? '토스체로 요약' : 'summary in conversational tone'})"
  },
  "quarterly": {
    "quarterKey": "${keys.quarterKey}",
    "schedules": [
      { "date": "YYYY-MM-DD", "time": "HH:MM", "title": "${lang === 'ko' ? '일정 제목' : 'Schedule title'}", "duration": 60, "priority": "medium" }
    ],
    "summary": "${this.t('prompts.scheduleCount', { period: lang === 'ko' ? '분기' : 'quarter', count: 'N' })} (${lang === 'ko' ? '토스체로 요약' : 'summary in conversational tone'})"
  }
}

**${lang === 'ko' ? '중요' : 'Important'}: ${lang === 'ko' ? 'schedules 배열의 각 일정은 반드시 위 형식(date, time, title, duration, priority)을 따라주세요. 일정이 없으면 빈 배열 []을 반환하세요.' : 'Each schedule in the schedules array must follow the format above (date, time, title, duration, priority). Return an empty array [] if there are no schedules.'}**

${this.t('prompts.jsonOnly')}`;
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
    
    // Get language for date formatting
    const lang = this.language || 'ko';
    const locale = lang === 'ko' ? 'ko-KR' : 'en-US';
    
    // 오늘 날짜와 시간 정보
    const now = new Date(clientLocalTime);
    const todayStr = now.toLocaleDateString(locale, { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric', 
      weekday: 'long' 
    });
    const currentTimeStr = now.toLocaleTimeString(locale, { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    // Get translations
    const noSchedule = this.t('prompts.noSchedule');
    const completed = this.t('prompts.completed');
    const scheduled = this.t('prompts.scheduled');
    const userRole = this.t('prompts.user');
    const assistantRole = this.t('prompts.assistant');
    const notEntered = this.t('prompts.notEntered');
    const member = this.t('prompts.member');
    const undecided = this.t('prompts.undecided');
    const hoursText = lang === 'ko' ? '시간' : 'hours';

    // 일간 일정 포맷팅
    const formatDailySchedules = (schedules) => {
      if (!schedules || schedules.length === 0) {
        return noSchedule;
      }
      return schedules.map(s => {
        const status = s.completed ? completed : scheduled;
        const durationHours = (s.duration / 60).toFixed(1);
        return `- [${s.time}] ${s.title} (${durationHours}${hoursText}, ${status})`;
      }).join('\n');
    };

    // 주간 일정 포맷팅
    const formatWeeklySchedules = (weeklyData) => {
      if (!weeklyData || !weeklyData.schedules || weeklyData.schedules.length === 0) {
        return noSchedule;
      }
      return weeklyData.schedules.map(s => {
        const durationHours = ((s.duration || 60) / 60).toFixed(1);
        return `- [${s.date}] ${s.time || undecided}: ${s.title} (${durationHours}${hoursText})`;
      }).join('\n');
    };

    // 월간 일정 포맷팅
    const formatMonthlySchedules = (monthlyData) => {
      if (!monthlyData || !monthlyData.schedules || monthlyData.schedules.length === 0) {
        return noSchedule;
      }
      return monthlyData.schedules.map(s => {
        const durationHours = ((s.duration || 60) / 60).toFixed(1);
        return `- [${s.date}] ${s.time || undecided}: ${s.title} (${durationHours}${hoursText})`;
      }).join('\n');
    };

    // 분기 일정 포맷팅
    const formatQuarterlySchedules = (quarterlyData) => {
      if (!quarterlyData || !quarterlyData.schedules || quarterlyData.schedules.length === 0) {
        return noSchedule;
      }
      return quarterlyData.schedules.map(s => {
        const durationHours = ((s.duration || 60) / 60).toFixed(1);
        return `- [${s.date}] ${s.time || undecided}: ${s.title} (${durationHours}${hoursText})`;
      }).join('\n');
    };

    // 이전 대화 내역 포맷팅
    const formatChatHistory = (history) => {
      if (!history || history.length === 0) {
        return '';
      }
      return history.slice(-6).map(msg => {
        const role = msg.role === 'user' ? userRole : assistantRole;
        return `${role}: ${msg.content}`;
      }).join('\n');
    };

    const historySection = chatHistory.length > 0 
      ? `\n${this.t('prompts.chatHistory')}\n${formatChatHistory(chatHistory)}\n` 
      : '';

    // Build prompt using i18n
    const chatAssistant = this.t('prompts.chatAssistant');
    const personaStyle = this.t('prompts.personaStyle', { name: userInfo.name || member });
    const currentTimeInfo = this.t('prompts.currentTimeInfo', { today: todayStr, currentTime: currentTimeStr });
    const userProfile = this.t('prompts.userProfile', { 
      name: userInfo.name || notEntered, 
      job: userInfo.job || notEntered, 
      personality: userInfo.personality || notEntered 
    });
    const todaySchedule = this.t('prompts.todaySchedule', { date: this.getLocalDateKey(now) });
    const thisWeekSchedule = this.t('prompts.thisWeekSchedule');
    const thisMonthSchedule = this.t('prompts.thisMonthSchedule');
    const thisQuarterSchedule = this.t('prompts.thisQuarterSchedule');
    const responseGuidelines = this.t('prompts.responseGuidelines');
    const userQuestion = this.t('prompts.userQuestion', { message });

    return `${chatAssistant}

${personaStyle}

${currentTimeInfo}

${userProfile}

${todaySchedule}
${formatDailySchedules(dailySchedules)}

${thisWeekSchedule}
${formatWeeklySchedules(weeklyPlan)}

${thisMonthSchedule}
${formatMonthlySchedules(monthlyPlan)}

${thisQuarterSchedule}
${formatQuarterlySchedules(quarterlyPlan)}
${historySection}
${responseGuidelines}

${userQuestion}`;
  }

  // 날짜 키 생성 헬퍼 (로컬 타임존 기준)
  getLocalDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

