/**
 * dAIly Planner - Main UI Controller
 * ES6 Class-based architecture with Shadow DOM
 */

import { StorageManager } from './storage.js';
import { GeminiAPI } from './gemini.js';
import { i18n } from './i18n.js';

class ExtensionUI {
  constructor() {
    this.root = null;
    this.shadowRoot = null;
    this.storage = new StorageManager();
    this.gemini = null;
    this.currentView = 'daily'; // daily, weekly, monthly, quarterly, summary
    this.selectedText = null;
    this.draggedItem = null;
    this.currentDate = new Date(); // Current date for navigation
    this.currentWeekStart = null;
    this.currentMonth = null;
    this.currentQuarter = null; // 1, 2, 3, 4
    this.currentQuarterYear = null;
    this.chatMessages = []; // 채팅 메시지 히스토리
    this.isChatLoading = false; // 채팅 로딩 상태
    
    this.init();
  }

  async init() {
    console.log('Initializing ExtensionUI...');
    
    // Initialize i18n first
    await i18n.init();
    
    // Listen for language changes
    window.addEventListener('languageChanged', (e) => {
      // Update GeminiAPI language when language changes
      if (this.gemini) {
        this.gemini.language = i18n.getCurrentLanguage();
      }
      this.render();
      this.setupEventListeners();
      this.loadData();
    });
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      await new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', resolve);
      });
    }

    // Create Shadow DOM
    const appRoot = document.getElementById('app-root');
    if (!appRoot) {
      console.error('app-root element not found');
      return;
    }
    
    console.log('Creating Shadow DOM...');
    this.shadowRoot = appRoot.attachShadow({ mode: 'open' });
    
    // Load styles
    await this.loadStyles();
    console.log('Styles loaded');
    
    // Initialize Gemini API
    const settings = await this.storage.getSettings();
    if (settings.geminiApiKey) {
      this.gemini = new GeminiAPI(settings.geminiApiKey, settings.geminiModel, i18n.getCurrentLanguage());
    }
    
    // Render UI
    console.log('Rendering UI...');
    this.render();
    console.log('UI rendered');
    
    // Wait a bit for DOM to be fully rendered
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Setup event listeners
    console.log('Setting up event listeners...');
    this.setupEventListeners();
    
    // Load initial data
    await this.loadData();
    console.log('Initial data loaded');
    
    // Check for selected text on init
    this.checkForSelectedText();

    // Listen for storage changes (selected text from content script)
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.selectedText && changes.selectedText.newValue) {
        this.showAddTaskModal(changes.selectedText.newValue);
        chrome.storage.local.remove('selectedText');
      }
    });
    
    console.log('ExtensionUI initialized');
  }

  async checkForSelectedText() {
    const result = await chrome.storage.local.get('selectedText');
    if (result.selectedText) {
      this.showAddTaskModal(result.selectedText);
      chrome.storage.local.remove('selectedText');
    }
  }

  async loadStyles() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('styles.css');
    this.shadowRoot.appendChild(link);
  }

  render() {
    const container = document.createElement('div');
    container.className = 'container';
    
    container.innerHTML = `
      <div class="header">
        <h1 class="header-title">${i18n.t('app.title')}</h1>
        <div class="header-actions">
          <button class="btn btn-icon" id="settings-btn" title="${i18n.t('header.settings')}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"></path>
            </svg>
          </button>
        </div>
      </div>
      
      <div class="tabs">
        <button class="tab active" data-view="daily">${i18n.t('tabs.daily')}</button>
        <button class="tab" data-view="weekly">${i18n.t('tabs.weekly')}</button>
        <button class="tab" data-view="monthly">${i18n.t('tabs.monthly')}</button>
        <button class="tab" data-view="quarterly">${i18n.t('tabs.quarterly')}</button>
        <button class="tab" data-view="summary">${i18n.t('tabs.summary')}</button>
        <button class="tab" data-view="chat">${i18n.t('tabs.chat')}</button>
      </div>
      
      <div class="content" id="content-area">
        ${this.renderDailyView()}
      </div>
      
      <div class="modal-overlay" id="settings-modal">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">${i18n.t('settings.title')}</h2>
            <button class="modal-close" id="close-settings">${i18n.t('common.close')}</button>
          </div>
          <div class="modal-content" id="settings-content">
            ${this.renderSettingsForm()}
          </div>
        </div>
      </div>
      
      <div class="modal-overlay" id="add-task-modal">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">${i18n.t('task.add')}</h2>
            <button class="modal-close" id="close-add-task">${i18n.t('common.close')}</button>
          </div>
          <div class="modal-content" id="add-task-content">
            ${this.renderAddTaskForm()}
          </div>
        </div>
      </div>
      
      <div class="progress-overlay" id="progress-overlay">
        <div class="progress-content">
          <div class="progress-spinner"></div>
          <div class="progress-message-container">
            <div class="progress-message" id="progress-message">${i18n.t('progress.analyzing')}</div>
          </div>
        </div>
      </div>
      
      <div class="modal-overlay" id="confirm-modal">
        <div class="modal" style="max-width: 320px;">
          <div class="modal-header">
            <h2 class="modal-title" id="confirm-modal-title">확인</h2>
          </div>
          <div class="modal-content">
            <p id="confirm-modal-message" style="margin-bottom: var(--spacing-lg); color: var(--color-text-secondary);"></p>
            <div style="display: flex; gap: var(--spacing-md);">
              <button class="btn" id="confirm-cancel-btn" style="flex: 1;">취소</button>
              <button class="btn" id="confirm-ok-btn" style="flex: 1; background: var(--color-error); color: white;">삭제</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    this.shadowRoot.appendChild(container);
    this.root = container;
  }

  getProgressMessages() {
    return [
      i18n.t('progress.checkingSchedule'),
      i18n.t('progress.reviewingCarefully'),
      i18n.t('progress.comparingToday'),
      i18n.t('progress.findingOptimalTime'),
      i18n.t('progress.organizingNotes'),
      i18n.t('progress.reflectingWeekly'),
      i18n.t('progress.reviewingWeek'),
      i18n.t('progress.balancingWork'),
      i18n.t('progress.coordinatingWeekly'),
      i18n.t('progress.weeklyReviewAlmostDone'),
      i18n.t('progress.comparingMonthly'),
      i18n.t('progress.adjustingPriority'),
      i18n.t('progress.checkingResource'),
      i18n.t('progress.updatingQuarterly'),
      i18n.t('progress.checkingQuarterly'),
      i18n.t('progress.organizingFinal'),
      i18n.t('progress.finishingUp'),
      i18n.t('progress.almostDone'),
      i18n.t('progress.completed')
    ];
  }

  renderDailyView() {
    const today = new Date();
    const lang = i18n.getCurrentLanguage();
    const locale = lang === 'ko' ? 'ko-KR' : 'en-US';
    const dateStr = today.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    
    return `
      <div class="card">
        <div class="card-header">
          <div style="display: flex; align-items: center; gap: var(--spacing-md); flex: 1;">
            <button class="btn btn-icon" id="prev-day-btn" title="${i18n.t('buttons.prevDay')}">←</button>
            <div>
              <h2 class="card-title">${i18n.t('daily.title')}</h2>
              <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-top: var(--spacing-xs);" id="current-date-display">${dateStr}</div>
            </div>
            <button class="btn btn-icon" id="next-day-btn" title="${i18n.t('buttons.nextDay')}">→</button>
          </div>
          <button class="btn btn-primary" id="add-schedule-btn">${i18n.t('buttons.addSchedule')}</button>
        </div>
        <div id="schedule-loading" style="display: none; padding: var(--spacing-lg); text-align: center;">
          <div class="loading-spinner" style="margin: 0 auto var(--spacing-md);"></div>
          <div style="color: var(--color-text-secondary);">${i18n.t('progress.reviewing')}</div>
        </div>
        <div class="schedule-list" id="daily-schedule-list">
          <!-- Schedule items will be rendered here -->
        </div>
      </div>
      
      <div class="modal-overlay" id="schedule-detail-modal">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title" id="schedule-detail-title">${i18n.t('modals.scheduleDetail')}</h2>
            <button class="modal-close" id="close-schedule-detail">✕</button>
          </div>
          <div class="modal-content" id="schedule-detail-content">
            <!-- Schedule details will be rendered here -->
          </div>
        </div>
      </div>
      
    `;
  }

  renderWeeklyView() {
    const today = new Date();
    const weekStart = this.currentWeekStart || (() => {
      const start = new Date(today);
      start.setDate(today.getDate() - today.getDay());
      return start;
    })();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    // Calculate week number in month
    const lang = i18n.getCurrentLanguage();
    const locale = lang === 'ko' ? 'ko-KR' : 'en-US';
    const monthName = weekStart.toLocaleDateString(locale, { month: 'long' });
    const weekOfMonth = Math.ceil((weekStart.getDate() + new Date(weekStart.getFullYear(), weekStart.getMonth(), 1).getDay()) / 7);
    const weekOfMonthText = i18n.t('dates.weekOfMonth');
    const weekTitle = lang === 'ko' ? `${monthName} ${weekOfMonth}${weekOfMonthText}` : `${weekOfMonthText} ${weekOfMonth}, ${monthName}`;
    const dateRange = `${weekStart.getMonth() + 1}/${weekStart.getDate()} ~ ${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;
    
    return `
      <div class="card">
        <div class="card-header">
          <div style="display: flex; align-items: center; gap: var(--spacing-md); flex: 1;">
            <button class="btn btn-icon" id="prev-week-btn" title="${i18n.t('buttons.prevWeek')}">←</button>
            <div>
              <h2 class="card-title">${i18n.t('weekly.title')}</h2>
              <div id="current-week-display" style="margin-top: var(--spacing-xs);">
                <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">${weekTitle}</div>
                <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); font-style: italic;">${dateRange}</div>
              </div>
            </div>
            <button class="btn btn-icon" id="next-week-btn" title="${i18n.t('buttons.nextWeek')}">→</button>
          </div>
        </div>
        <div class="weekly-plan" id="weekly-plan">
          <div style="padding: var(--spacing-xl); text-align: center; color: var(--color-text-secondary);">
            ${i18n.t('weekly.noPlan')}
          </div>
        </div>
      </div>
    `;
  }

  renderMonthlyView() {
    const today = this.currentMonth || new Date();
    const lang = i18n.getCurrentLanguage();
    const locale = lang === 'ko' ? 'ko-KR' : 'en-US';
    const monthStr = today.toLocaleDateString(locale, { year: 'numeric', month: 'long' });
    
    return `
      <div class="card">
        <div class="card-header">
          <div style="display: flex; align-items: center; gap: var(--spacing-md); flex: 1;">
            <button class="btn btn-icon" id="prev-month-btn" title="${i18n.t('buttons.prevMonth')}">←</button>
            <div>
              <h2 class="card-title">${i18n.t('monthly.title')}</h2>
              <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-top: var(--spacing-xs);" id="current-month-display">${monthStr}</div>
            </div>
            <button class="btn btn-icon" id="next-month-btn" title="${i18n.t('buttons.nextMonth')}">→</button>
          </div>
        </div>
        <div class="monthly-plan" id="monthly-plan">
          <div style="padding: var(--spacing-xl); text-align: center; color: var(--color-text-secondary);">
            ${i18n.t('monthly.noPlan')}
          </div>
        </div>
      </div>
    `;
  }

  renderQuarterlyView() {
    const today = new Date();
    const currentQuarter = this.currentQuarter || Math.ceil((today.getMonth() + 1) / 3);
    const currentYear = this.currentQuarterYear || today.getFullYear();
    const quarterStr = i18n.t('quarterly.quarter', { year: currentYear, quarter: currentQuarter });
    
    // Calculate quarter date range
    const quarterStartMonth = (currentQuarter - 1) * 3;
    const quarterEndMonth = quarterStartMonth + 2;
    const monthNamesStr = i18n.t('dates.months');
    const monthNames = monthNamesStr.split(',');
    const dateRange = `${monthNames[quarterStartMonth]} ~ ${monthNames[quarterEndMonth]}`;
    
    return `
      <div class="card">
        <div class="card-header">
          <div style="display: flex; align-items: center; gap: var(--spacing-md); flex: 1;">
            <button class="btn btn-icon" id="prev-quarter-btn" title="${i18n.t('buttons.prevQuarter')}">←</button>
            <div>
              <h2 class="card-title">${i18n.t('quarterly.title')}</h2>
              <div id="current-quarter-display" style="margin-top: var(--spacing-xs);">
                <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">${quarterStr}</div>
                <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); font-style: italic;">${dateRange}</div>
              </div>
            </div>
            <button class="btn btn-icon" id="next-quarter-btn" title="${i18n.t('buttons.nextQuarter')}">→</button>
          </div>
        </div>
        <div class="quarterly-plan" id="quarterly-plan">
          <div style="padding: var(--spacing-xl); text-align: center; color: var(--color-text-secondary);">
            ${i18n.t('quarterly.noPlan')}
          </div>
        </div>
      </div>
    `;
  }

  renderSummaryView() {
    const today = new Date();
    const dateStr = today.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    
    return `
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">${i18n.t('summary.title')}</h2>
            <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-top: var(--spacing-xs);">${dateStr}</div>
          </div>
        </div>
        <div class="summary-content" id="summary-content">
          <div style="padding: var(--spacing-xl); text-align: center; color: var(--color-text-secondary);">
            데이터를 불러오는 중...
          </div>
        </div>
      </div>
    `;
  }

  renderChatView() {
    return `
      <div class="chat-container">
        <div class="chat-header">
          <div class="chat-header-icon">💬</div>
          <div class="chat-header-content">
            <h2 class="chat-header-title">${i18n.t('chat.title')}</h2>
            <p class="chat-header-subtitle">${i18n.t('chat.subtitle')}</p>
          </div>
        </div>
        
        <div class="chat-messages" id="chat-messages">
          ${this.renderChatMessages()}
        </div>
        
        <div class="chat-input-container">
          <div class="chat-input-wrapper">
            <textarea 
              class="chat-input" 
              id="chat-input" 
              placeholder="${i18n.t('chat.placeholder')}"
              rows="1"
            ></textarea>
            <button class="chat-send-btn" id="chat-send-btn" title="${i18n.t('chat.send')}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
          <div class="chat-input-hint">
            ${i18n.t('chat.hint')}
          </div>
        </div>
      </div>
    `;
  }

  renderChatMessages() {
    if (this.chatMessages.length === 0) {
      return `
        <div class="chat-welcome">
          <div class="chat-welcome-icon">🤖</div>
          <h3 class="chat-welcome-title">${i18n.t('chat.welcome.title')}</h3>
          <p class="chat-welcome-text">
            ${i18n.t('chat.welcome.text')}
          </p>
          <div class="chat-suggestions">
            <button class="chat-suggestion-btn" data-suggestion="${i18n.t('chat.welcome.suggestions.today').replace('📅 ', '')}">${i18n.t('chat.welcome.suggestions.today')}</button>
            <button class="chat-suggestion-btn" data-suggestion="${i18n.t('chat.welcome.suggestions.busy').replace('📊 ', '')}">${i18n.t('chat.welcome.suggestions.busy')}</button>
            <button class="chat-suggestion-btn" data-suggestion="${i18n.t('chat.welcome.suggestions.tips').replace('💡 ', '')}">${i18n.t('chat.welcome.suggestions.tips')}</button>
            <button class="chat-suggestion-btn" data-suggestion="${i18n.t('chat.welcome.suggestions.monthly').replace('📆 ', '')}">${i18n.t('chat.welcome.suggestions.monthly')}</button>
          </div>
        </div>
      `;
    }

    return this.chatMessages.map((msg, index) => {
      if (msg.role === 'user') {
        return `
          <div class="chat-message chat-message-user" data-index="${index}">
            <div class="chat-message-content">
              <div class="chat-message-text">${this.escapeHtml(msg.content)}</div>
              <div class="chat-message-time">${msg.time}</div>
            </div>
            <div class="chat-message-avatar chat-avatar-user">👤</div>
          </div>
        `;
      } else {
        return `
          <div class="chat-message chat-message-assistant" data-index="${index}">
            <div class="chat-message-avatar chat-avatar-assistant">🤖</div>
            <div class="chat-message-content">
              <div class="chat-message-text">${this.formatChatResponse(msg.content)}</div>
              <div class="chat-message-time">${msg.time}</div>
            </div>
          </div>
        `;
      }
    }).join('');
  }

  formatChatResponse(text) {
    // 마크다운 스타일 포맷팅
    let formatted = this.escapeHtml(text);
    
    // 줄바꿈 처리
    formatted = formatted.replace(/\n/g, '<br>');
    
    // 볼드 처리 (**text**)
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // 리스트 항목 처리 (- item)
    formatted = formatted.replace(/^- (.+)$/gm, '<span class="chat-list-item">• $1</span>');
    
    return formatted;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  renderSettingsForm() {
    return `
      <form id="settings-form">
        <div style="display: flex; gap: var(--spacing-md);">
          <div class="input-group" style="flex: 1;">
          <label class="input-label">${i18n.t('settings.name')}</label>
          <input type="text" class="input" id="setting-name" placeholder="${i18n.t('settings.name')}">
          </div>
          <div class="input-group" style="flex: 1;">
            <label class="input-label">${i18n.t('settings.birthdate')}</label>
            <input type="date" class="input" id="setting-birthdate">
          </div>
        </div>
        
        <div style="display: flex; gap: var(--spacing-md);">
          <div class="input-group" style="flex: 1;">
          <label class="input-label">${i18n.t('settings.gender')}</label>
          <select class="input" id="setting-gender">
            <option value="">${i18n.t('settings.genderSelect')}</option>
            <option value="male">${i18n.t('settings.genderMale')}</option>
            <option value="female">${i18n.t('settings.genderFemale')}</option>
            <option value="other">${i18n.t('settings.genderOther')}</option>
          </select>
          </div>
          <div class="input-group" style="flex: 1;">
          <label class="input-label">${i18n.t('settings.job')}</label>
          <input type="text" class="input" id="setting-job" placeholder="${i18n.t('settings.job')}">
          </div>
        </div>
        
        <div class="input-group">
          <label class="input-label">${i18n.t('settings.personality')}</label>
          <textarea class="input input-textarea" id="setting-personality" placeholder="${i18n.t('settings.personalityPlaceholder')}" style="min-height: 60px;"></textarea>
        </div>
        
        <div class="input-group">
          <label class="input-label">${i18n.t('settings.apiKey')}</label>
          <input type="password" class="input" id="setting-api-key" placeholder="${i18n.t('settings.apiKeyPlaceholder')}">
          <small style="color: var(--color-text-tertiary); margin-top: var(--spacing-xs);">
            ${i18n.t('settings.apiKeyNote')}
          </small>
        </div>
        
        <div class="input-group">
          <label class="input-label">Gemini 모델</label>
          <select class="input" id="setting-model">
            <option value="gemini-2.5-flash">${i18n.t('settings.models.flash')}</option>
            <option value="gemini-2.5-pro">${i18n.t('settings.models.pro')}</option>
            <option value="gemini-2.5-flash-lite">${i18n.t('settings.models.flashLite')}</option>
            <option value="gemini-3-pro-preview">${i18n.t('settings.models.proPreview')}</option>
            <option value="gemini-2.0-flash">${i18n.t('settings.models.flash20')}</option>
            <option value="gemini-2.0-flash-lite">${i18n.t('settings.models.flashLite20')}</option>
          </select>
          <small style="color: var(--color-text-tertiary); margin-top: var(--spacing-xs);">
            ${i18n.t('settings.modelNote')}
          </small>
        </div>
        
        <div class="input-group">
          <label class="input-label">${i18n.t('settings.language')}</label>
          <select class="input" id="setting-language">
            <option value="ko" ${i18n.getCurrentLanguage() === 'ko' ? 'selected' : ''}>${i18n.t('settings.languageKo')}</option>
            <option value="en" ${i18n.getCurrentLanguage() === 'en' ? 'selected' : ''}>${i18n.t('settings.languageEn')}</option>
          </select>
        </div>
        
        <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: var(--spacing-lg);">
          ${i18n.t('settings.save')}
        </button>
      </form>
    `;
  }

  renderAddTaskForm() {
    const selectedTextSection = this.selectedText ? `
        <div class="input-group" id="selected-text-group">
          <label class="input-label">${i18n.t('task.selectedText')}</label>
          <div class="card" style="padding: var(--spacing-md); background: var(--color-bg-elevated);">
            <div id="selected-text-preview" style="color: var(--color-text-secondary); font-style: italic;">
              ${this.selectedText}
            </div>
          </div>
        </div>
    ` : '';

    return `
      <form id="add-task-form">
        ${selectedTextSection}
        
        <div class="input-group">
          <label class="input-label">${i18n.t('task.title')}</label>
          <input type="text" class="input" id="task-title" placeholder="${i18n.t('task.titlePlaceholder')}" required>
        </div>
        
        <div class="input-group">
          <label class="input-label">${i18n.t('task.description')}</label>
          <textarea class="input input-textarea" id="task-description" style="min-height: 150px;" placeholder="${i18n.t('task.descriptionPlaceholder')}"></textarea>
        </div>
        
        <div style="display: flex; gap: var(--spacing-md);">
          <div class="input-group" style="flex: 1;">
            <label class="input-label">${i18n.t('task.priority')}</label>
            <select class="input" id="task-priority">
              <option value="low">${i18n.t('task.priorityLow')}</option>
              <option value="medium" selected>${i18n.t('task.priorityMedium')}</option>
              <option value="high">${i18n.t('task.priorityHigh')}</option>
            </select>
          </div>
          
          <div class="input-group" style="flex: 1;">
            <label class="input-label">${i18n.t('task.duration')}</label>
            <input type="number" class="input" id="task-duration" placeholder="${i18n.t('task.durationPlaceholder')}" min="0.5" step="0.5">
          </div>
        </div>
        
        <button type="submit" class="btn btn-primary" id="submit-task-btn" style="width: 100%; margin-top: var(--spacing-lg);">
          <span id="submit-task-text">${i18n.t('task.submit')}</span>
          <span id="submit-task-spinner" class="loading-spinner" style="display: none; margin-left: var(--spacing-sm);"></span>
        </button>
      </form>
    `;
  }

  setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Use event delegation for dynamically created elements (like complete buttons)
    this.shadowRoot.addEventListener('click', (e) => {
      // Handle complete schedule button clicks
      const completeBtn = e.target.closest('.schedule-complete-btn');
      if (completeBtn) {
        e.preventDefault();
        e.stopPropagation();
        const id = completeBtn.dataset.id;
        console.log('Complete button clicked, id:', id);
        if (id) {
          this.toggleScheduleComplete(id);
        }
        return;
      }
      
      // Handle close schedule detail modal
      const closeScheduleDetail = e.target.closest('#close-schedule-detail');
      if (closeScheduleDetail) {
        e.preventDefault();
        e.stopPropagation();
        const modal = this.shadowRoot.getElementById('schedule-detail-modal');
        if (modal) {
          modal.classList.remove('active');
        }
        return;
      }
      
      // Handle date navigation
      const prevDayBtn = e.target.closest('#prev-day-btn');
      if (prevDayBtn) {
        e.preventDefault();
        e.stopPropagation();
        this.navigateDate(-1);
        return;
      }
      
      const nextDayBtn = e.target.closest('#next-day-btn');
      if (nextDayBtn) {
        e.preventDefault();
        e.stopPropagation();
        this.navigateDate(1);
        return;
      }
      
      // Handle week navigation
      const prevWeekBtn = e.target.closest('#prev-week-btn');
      if (prevWeekBtn) {
        e.preventDefault();
        e.stopPropagation();
        this.navigateWeek(-1);
        return;
      }
      
      const nextWeekBtn = e.target.closest('#next-week-btn');
      if (nextWeekBtn) {
        e.preventDefault();
        e.stopPropagation();
        this.navigateWeek(1);
        return;
      }
      
      // Handle month navigation
      const prevMonthBtn = e.target.closest('#prev-month-btn');
      if (prevMonthBtn) {
        e.preventDefault();
        e.stopPropagation();
        this.navigateMonth(-1);
        return;
      }
      
      const nextMonthBtn = e.target.closest('#next-month-btn');
      if (nextMonthBtn) {
        e.preventDefault();
        e.stopPropagation();
        this.navigateMonth(1);
        return;
      }
      
      // Handle quarter navigation
      const prevQuarterBtn = e.target.closest('#prev-quarter-btn');
      if (prevQuarterBtn) {
        e.preventDefault();
        e.stopPropagation();
        this.navigateQuarter(-1);
        return;
      }
      
      const nextQuarterBtn = e.target.closest('#next-quarter-btn');
      if (nextQuarterBtn) {
        e.preventDefault();
        e.stopPropagation();
        this.navigateQuarter(1);
        return;
      }
      
      // Handle refresh summary
      const refreshSummaryBtn = e.target.closest('#refresh-summary');
      if (refreshSummaryBtn) {
        e.preventDefault();
        e.stopPropagation();
        this.loadSummaryData();
        return;
      }
    });
    
    // Direct event listeners for each element
    // Tabs
    const tabs = this.shadowRoot.querySelectorAll('.tab');
    console.log('Found tabs:', tabs.length);
    tabs.forEach((tab, index) => {
      console.log(`Setting up tab ${index}:`, tab, 'view:', tab.dataset.view);
      tab.addEventListener('click', (e) => {
        console.log('Tab click event fired!', tab.dataset.view);
        e.preventDefault();
        e.stopPropagation();
        const view = tab.dataset.view;
        if (view) {
          console.log('Calling switchView with:', view);
          this.switchView(view);
        } else {
          console.warn('No view data attribute found on tab');
        }
      }, true); // Use capture phase
      
      // Also try mousedown as fallback
      tab.addEventListener('mousedown', (e) => {
        console.log('Tab mousedown event fired!', tab.dataset.view);
        e.preventDefault();
      });
    });

    // Settings button
    const settingsBtn = this.shadowRoot.getElementById('settings-btn');
    if (settingsBtn) {
      console.log('Settings button found', settingsBtn);
      settingsBtn.addEventListener('click', (e) => {
        console.log('Settings button click event fired!');
        e.preventDefault();
        e.stopPropagation();
        const settingsModal = this.shadowRoot.getElementById('settings-modal');
        if (settingsModal) {
          settingsModal.classList.add('active');
          this.loadSettingsForm();
        }
      }, true); // Use capture phase
      
      // Also try mousedown
      settingsBtn.addEventListener('mousedown', (e) => {
        console.log('Settings button mousedown event fired!');
        e.preventDefault();
      });
    } else {
      console.warn('Settings button not found');
    }

    // Close settings button
    const closeSettings = this.shadowRoot.getElementById('close-settings');
    if (closeSettings) {
      closeSettings.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Close settings clicked');
        const settingsModal = this.shadowRoot.getElementById('settings-modal');
        if (settingsModal) {
          settingsModal.classList.remove('active');
        }
      });
    }

    // Add schedule button
    const addScheduleBtn = this.shadowRoot.getElementById('add-schedule-btn');
    if (addScheduleBtn) {
      console.log('Add schedule button found', addScheduleBtn);
      addScheduleBtn.addEventListener('click', (e) => {
        console.log('Add schedule button click event fired!');
        e.preventDefault();
        e.stopPropagation();
        this.showAddTaskModal();
      }, true); // Use capture phase
      
      // Also try mousedown
      addScheduleBtn.addEventListener('mousedown', (e) => {
        console.log('Add schedule button mousedown event fired!');
        e.preventDefault();
      });
    } else {
      console.warn('Add schedule button not found');
    }

    // Close add task modal
    const closeAddTask = this.shadowRoot.getElementById('close-add-task');
    if (closeAddTask) {
      closeAddTask.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Close add task clicked');
        const addTaskModal = this.shadowRoot.getElementById('add-task-modal');
        if (addTaskModal) {
          addTaskModal.classList.remove('active');
        }
      });
    }

    // Modal overlay click to close
    const settingsModal = this.shadowRoot.getElementById('settings-modal');
    if (settingsModal) {
      settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
          settingsModal.classList.remove('active');
        }
      });
    }

    const addTaskModal = this.shadowRoot.getElementById('add-task-modal');
    if (addTaskModal) {
      addTaskModal.addEventListener('click', (e) => {
        if (e.target === addTaskModal) {
          addTaskModal.classList.remove('active');
        }
      });
    }

    // Settings form submit
    const settingsForm = this.shadowRoot.getElementById('settings-form');
    if (settingsForm) {
      console.log('Settings form found');
      settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        console.log('Settings form submitted');
        this.saveSettings();
      });
    } else {
      console.warn('Settings form not found');
    }

    // Add task form submit
    const addTaskForm = this.shadowRoot.getElementById('add-task-form');
    if (addTaskForm) {
      console.log('Add task form found');
      addTaskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        console.log('Add task form submitted');
        this.processAddTask();
      });
    } else {
      console.warn('Add task form not found');
    }

    // Drag and drop for schedule items
    this.setupDragAndDrop();
    
    console.log('Event listeners setup complete');
  }

  setupDragAndDrop() {
    // This will be called after schedule items are rendered
    const scheduleList = this.shadowRoot.getElementById('daily-schedule-list');
    if (!scheduleList) return;

    scheduleList.addEventListener('dragstart', (e) => {
      if (e.target.closest('.schedule-item')) {
        this.draggedItem = e.target.closest('.schedule-item');
        this.draggedItem.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      }
    });

    scheduleList.addEventListener('dragend', (e) => {
      if (this.draggedItem) {
        this.draggedItem.classList.remove('dragging');
        this.draggedItem = null;
      }
    });

    scheduleList.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      const afterElement = this.getDragAfterElement(scheduleList, e.clientY);
      const dragging = this.shadowRoot.querySelector('.dragging');
      
      if (afterElement == null) {
        scheduleList.appendChild(dragging);
      } else {
        scheduleList.insertBefore(dragging, afterElement);
      }
    });

    scheduleList.addEventListener('drop', async (e) => {
      e.preventDefault();
      if (this.draggedItem) {
        await this.saveScheduleOrder();
      }
    });
  }

  getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.schedule-item:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  switchView(view) {
    console.log('Switching view to:', view);
    
    // 문의 탭을 다시 클릭한 경우 상태 초기화
    if (view === 'chat' && this.currentView === 'chat') {
      this.chatMessages = [];
      this.isChatLoading = false;
      // 로딩 인디케이터가 있다면 제거
      const loadingIndicator = this.shadowRoot.querySelector('.chat-loading');
      if (loadingIndicator) {
        loadingIndicator.remove();
      }
    }
    
    this.currentView = view;
    
    // Update tabs
    const tabs = this.shadowRoot.querySelectorAll('.tab');
    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.view === view);
    });
    
    // Update content with fade transition
    const contentArea = this.shadowRoot.getElementById('content-area');
    if (!contentArea) {
      console.error('Content area not found');
      return;
    }
    
    // Fade out current content
    contentArea.style.opacity = '0';
    contentArea.style.transform = 'translateY(8px)';
    
    setTimeout(() => {
      switch(view) {
        case 'daily':
          contentArea.innerHTML = this.renderDailyView();
          break;
        case 'weekly':
          contentArea.innerHTML = this.renderWeeklyView();
          break;
        case 'monthly':
          contentArea.innerHTML = this.renderMonthlyView();
          break;
        case 'quarterly':
          contentArea.innerHTML = this.renderQuarterlyView();
          break;
        case 'summary':
          contentArea.innerHTML = this.renderSummaryView();
          break;
        case 'chat':
          contentArea.innerHTML = this.renderChatView();
          break;
      }
      
      // Fade in new content
      requestAnimationFrame(() => {
        contentArea.style.opacity = '1';
        contentArea.style.transform = 'translateY(0)';
      });
      
      // Re-setup event listeners for new content
      const addScheduleBtn = this.shadowRoot.getElementById('add-schedule-btn');
      if (addScheduleBtn) {
        addScheduleBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.showAddTaskModal();
        });
      }
      
      // Load data based on view
      if (view === 'daily') {
        this.loadData();
      } else if (view === 'weekly') {
        this.loadWeeklyData();
      } else if (view === 'monthly') {
        this.loadMonthlyData();
      } else if (view === 'quarterly') {
        this.loadQuarterlyData();
      } else if (view === 'summary') {
        this.loadSummaryData();
      } else if (view === 'chat') {
        this.setupChatEventListeners();
      }
    }, 150);
  }

  async loadSettingsForm() {
    const settings = await this.storage.getSettings();
    
    const nameInput = this.shadowRoot.getElementById('setting-name');
    const birthdateInput = this.shadowRoot.getElementById('setting-birthdate');
    const genderInput = this.shadowRoot.getElementById('setting-gender');
    const jobInput = this.shadowRoot.getElementById('setting-job');
    const personalityInput = this.shadowRoot.getElementById('setting-personality');
    const apiKeyInput = this.shadowRoot.getElementById('setting-api-key');
    const modelInput = this.shadowRoot.getElementById('setting-model');
    
    if (nameInput) nameInput.value = settings.name || '';
    if (birthdateInput) birthdateInput.value = settings.birthdate || '';
    if (genderInput) genderInput.value = settings.gender || '';
    if (jobInput) jobInput.value = settings.job || '';
    if (personalityInput) personalityInput.value = settings.personality || '';
    if (apiKeyInput) apiKeyInput.value = settings.geminiApiKey || '';
    if (modelInput) modelInput.value = settings.geminiModel || 'gemini-2.5-flash';
  }

  async saveSettings() {
    const settings = {
      name: this.shadowRoot.getElementById('setting-name').value,
      birthdate: this.shadowRoot.getElementById('setting-birthdate').value,
      gender: this.shadowRoot.getElementById('setting-gender').value,
      job: this.shadowRoot.getElementById('setting-job').value,
      personality: this.shadowRoot.getElementById('setting-personality').value,
      geminiApiKey: this.shadowRoot.getElementById('setting-api-key').value,
      geminiModel: this.shadowRoot.getElementById('setting-model').value
    };
    
    // Handle language change
    const languageSelect = this.shadowRoot.getElementById('setting-language');
    if (languageSelect && languageSelect.value !== i18n.getCurrentLanguage()) {
      await i18n.setLanguage(languageSelect.value);
    }
    
    await this.storage.saveSettings(settings);
    
    // Reinitialize Gemini API if key or model changed
    if (settings.geminiApiKey) {
      this.gemini = new GeminiAPI(settings.geminiApiKey, settings.geminiModel, i18n.getCurrentLanguage());
    }
    
    // Close modal
    this.shadowRoot.getElementById('settings-modal').classList.remove('active');
    
    // Show success toast
    this.showToast(i18n.t('settings.saved'), 'success');
  }

  showAddTaskModal(selectedText = null) {
    this.selectedText = selectedText;
    const modal = this.shadowRoot.getElementById('add-task-modal');
    const addTaskContent = this.shadowRoot.getElementById('add-task-content');
    
    // Re-render the form to show/hide selected text section
    if (addTaskContent) {
      addTaskContent.innerHTML = this.renderAddTaskForm();
      
      // Re-attach form submit listener
      const addTaskForm = this.shadowRoot.getElementById('add-task-form');
      if (addTaskForm) {
        addTaskForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.processAddTask();
        });
      }
    }
    
    modal.classList.add('active');
  }


  navigateDate(days) {
    if (!this.currentDate) {
      this.currentDate = new Date();
    }
    this.currentDate = new Date(this.currentDate);
    this.currentDate.setDate(this.currentDate.getDate() + days);
    this.loadData();
  }

  navigateWeek(weeks) {
    if (this.currentView === 'weekly') {
      const currentWeek = this.currentWeekStart || (() => {
        const today = new Date();
        const start = new Date(today);
        start.setDate(today.getDate() - today.getDay());
        return start;
      })();
      const newWeekStart = new Date(currentWeek);
      newWeekStart.setDate(currentWeek.getDate() + (weeks * 7));
      this.currentWeekStart = newWeekStart;
      this.loadWeeklyData();
    }
  }

  navigateMonth(months) {
    if (this.currentView === 'monthly') {
      const currentMonth = this.currentMonth || new Date();
      const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + months, 1);
      this.currentMonth = newMonth;
      this.loadMonthlyData();
    }
  }

  navigateQuarter(quarters) {
    if (this.currentView === 'quarterly') {
      const today = new Date();
      let currentQuarter = this.currentQuarter || Math.ceil((today.getMonth() + 1) / 3);
      let currentYear = this.currentQuarterYear || today.getFullYear();
      
      currentQuarter += quarters;
      
      // Handle year change
      if (currentQuarter > 4) {
        currentQuarter = 1;
        currentYear++;
      } else if (currentQuarter < 1) {
        currentQuarter = 4;
        currentYear--;
      }
      
      this.currentQuarter = currentQuarter;
      this.currentQuarterYear = currentYear;
      this.loadQuarterlyData();
    }
  }

  async loadWeeklyData() {
    // Load weekly plan data
    const weekStart = this.currentWeekStart || (() => {
      const today = new Date();
      const start = new Date(today);
      start.setDate(today.getDate() - today.getDay());
      start.setHours(0, 0, 0, 0);
      return start;
    })();
    const weekKey = `${weekStart.getFullYear()}-W${this.getWeekNumber(weekStart)}`;
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const weeklyPlans = await chrome.storage.local.get('weeklyPlans') || {};
    const planData = weeklyPlans.weeklyPlans?.[weekKey];
    
    // Always load daily schedules for the week
    const schedules = await this.storage.getSchedules();
    const weekSchedules = [];
    
    // Loop through 7 days of the week
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      // Use local date format for dateKey
      const dateKey = this.getLocalDateKey(d);
      if (schedules[dateKey] && Array.isArray(schedules[dateKey])) {
        const dayName = d.toLocaleDateString('ko-KR', { weekday: 'short' });
        const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
        schedules[dateKey].forEach(s => {
          weekSchedules.push({
            ...s,
            date: dateKey,
            day: `${dayName} (${dateStr})`
          });
        });
      }
    }
    
    const weeklyPlanDiv = this.shadowRoot.getElementById('weekly-plan');
    
    if (planData && planData.summary) {
      this.renderWeeklyPlanData(planData);
    } else if (weekSchedules.length > 0) {
      // Show daily schedules if no AI summary yet
      this.renderWeeklyPlanData({
        schedules: weekSchedules,
        summary: i18n.t('summary.weekSummary', { count: weekSchedules.length })
      });
    } else {
      if (weeklyPlanDiv) {
        weeklyPlanDiv.innerHTML = `
          <div style="padding: var(--spacing-xl); text-align: center; color: var(--color-text-secondary);">
            ${i18n.t('summary.noWeekSchedule')}
          </div>
        `;
      }
    }
    
    // Update week display with language-specific format
    const weekDisplay = this.shadowRoot.getElementById('current-week-display');
    if (weekDisplay) {
      const lang = i18n.getCurrentLanguage();
      const locale = lang === 'ko' ? 'ko-KR' : 'en-US';
      const monthName = weekStart.toLocaleDateString(locale, { month: 'long' });
      const weekOfMonth = Math.ceil((weekStart.getDate() + new Date(weekStart.getFullYear(), weekStart.getMonth(), 1).getDay()) / 7);
      const weekOfMonthText = i18n.t('dates.weekOfMonth');
      const weekTitle = lang === 'ko' ? `${monthName} ${weekOfMonth}${weekOfMonthText}` : `${weekOfMonthText} ${weekOfMonth}, ${monthName}`;
      const dateRange = `${weekStart.getMonth() + 1}/${weekStart.getDate()} ~ ${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;
      
      weekDisplay.innerHTML = `
        <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">${weekTitle}</div>
        <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); font-style: italic;">${dateRange}</div>
      `;
    }
  }

  async loadMonthlyData() {
    // Load monthly plan data
    const today = this.currentMonth || new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    
    const monthlyPlans = await chrome.storage.local.get('monthlyPlans') || {};
    const planData = monthlyPlans.monthlyPlans?.[monthKey];
    
    // Load daily schedules for the month
    const schedules = await this.storage.getSchedules();
    const monthSchedules = [];
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    
    // 월의 일수 계산 후 순회
    const daysInMonth = monthEnd.getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const dateKey = this.getLocalDateKey(d);
      if (schedules[dateKey] && Array.isArray(schedules[dateKey])) {
        const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
        schedules[dateKey].forEach(s => {
          monthSchedules.push({
            ...s,
            date: dateKey,
            displayDate: dateStr
          });
        });
      }
    }
    
    const monthlyPlanDiv = this.shadowRoot.getElementById('monthly-plan');
    
    if (planData && planData.summary) {
      this.renderMonthlyPlanData(planData);
    } else if (monthSchedules.length > 0) {
      // Show daily schedules if no AI summary yet
      this.renderMonthlyPlanData({
        schedules: monthSchedules,
        summary: i18n.t('summary.monthSummary', { count: monthSchedules.length })
      });
    } else {
      if (monthlyPlanDiv) {
        monthlyPlanDiv.innerHTML = `
          <div style="padding: var(--spacing-xl); text-align: center; color: var(--color-text-secondary);">
            ${i18n.t('summary.noMonthSchedule')}
          </div>
        `;
      }
    }
    
    // Update month display
    const monthDisplay = this.shadowRoot.getElementById('current-month-display');
    if (monthDisplay) {
      const monthStr = today.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
      monthDisplay.textContent = monthStr;
    }
  }

  async loadQuarterlyData() {
    // Load quarterly plan data
    const today = new Date();
    const currentQuarter = this.currentQuarter || Math.ceil((today.getMonth() + 1) / 3);
    const currentYear = this.currentQuarterYear || today.getFullYear();
    const quarterKey = `${currentYear}-Q${currentQuarter}`;
    
    const quarterlyPlans = await chrome.storage.local.get('quarterlyPlans') || {};
    const planData = quarterlyPlans.quarterlyPlans?.[quarterKey];
    
    // Load daily schedules for the quarter
    const schedules = await this.storage.getSchedules();
    const quarterSchedules = [];
    const quarterStartMonth = (currentQuarter - 1) * 3;
    const quarterEndMonth = quarterStartMonth + 2;
    const quarterStart = new Date(currentYear, quarterStartMonth, 1);
    const quarterEnd = new Date(currentYear, quarterEndMonth + 1, 0);
    
    // 분기 동안 모든 날짜 순회
    for (let m = quarterStartMonth; m <= quarterEndMonth; m++) {
      const daysInMonth = new Date(currentYear, m + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(currentYear, m, day);
        const dateKey = this.getLocalDateKey(d);
        if (schedules[dateKey] && Array.isArray(schedules[dateKey])) {
          const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
          const monthName = d.toLocaleDateString('ko-KR', { month: 'short' });
          schedules[dateKey].forEach(s => {
            quarterSchedules.push({
              ...s,
              date: dateKey,
              month: monthName,
              displayDate: dateStr
            });
          });
        }
      }
    }
    
    const quarterlyPlanDiv = this.shadowRoot.getElementById('quarterly-plan');
    
    if (planData && planData.summary) {
      this.renderQuarterlyPlanData(planData);
    } else if (quarterSchedules.length > 0) {
      // Show daily schedules if no AI summary yet
      this.renderQuarterlyPlanData({
        schedules: quarterSchedules,
        summary: i18n.t('summary.quarterSummary', { quarter: currentQuarter, count: quarterSchedules.length })
      });
    } else {
      if (quarterlyPlanDiv) {
        quarterlyPlanDiv.innerHTML = `
          <div style="padding: var(--spacing-xl); text-align: center; color: var(--color-text-secondary);">
            ${i18n.t('summary.noQuarterSchedule', { quarter: currentQuarter })}
          </div>
        `;
      }
    }
    
    // Update quarter display
    const quarterDisplay = this.shadowRoot.getElementById('current-quarter-display');
    if (quarterDisplay) {
      const quarterStr = i18n.t('quarterly.quarter', { year: currentYear, quarter: currentQuarter });
      const monthNamesStr = i18n.t('dates.months');
      const monthNames = monthNamesStr.split(',');
      const dateRange = `${monthNames[quarterStartMonth]} ~ ${monthNames[quarterEndMonth]}`;
      
      quarterDisplay.innerHTML = `
        <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">${quarterStr}</div>
        <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); font-style: italic;">${dateRange}</div>
      `;
    }
  }

  async loadSummaryData() {
    const summaryContent = this.shadowRoot.getElementById('summary-content');
    if (!summaryContent) return;
    
    summaryContent.innerHTML = `
      <div style="padding: var(--spacing-xl); text-align: center;">
        <div class="loading-spinner" style="margin: 0 auto var(--spacing-md);"></div>
        <div style="color: var(--color-text-secondary);">모든 계획을 불러오는 중...</div>
      </div>
    `;
    
    try {
      // Load all schedules
      const schedules = await this.storage.getSchedules();
      const weeklyPlans = await chrome.storage.local.get('weeklyPlans') || {};
      const monthlyPlans = await chrome.storage.local.get('monthlyPlans') || {};
      const quarterlyPlans = await chrome.storage.local.get('quarterlyPlans') || {};
      
      this.renderSummaryContent(schedules, weeklyPlans.weeklyPlans || {}, monthlyPlans.monthlyPlans || {}, quarterlyPlans.quarterlyPlans || {});
    } catch (error) {
      console.error('Failed to load summary data:', error);
      summaryContent.innerHTML = `
        <div style="padding: var(--spacing-xl); text-align: center; color: var(--color-text-secondary);">
          데이터를 불러오는 데 실패했습니다.
        </div>
      `;
    }
  }

  renderSummaryContent(schedules, weeklyPlans, monthlyPlans, quarterlyPlans) {
    const summaryContent = this.shadowRoot.getElementById('summary-content');
    if (!summaryContent) return;
    
    const today = new Date();
    const dateKey = this.getLocalDateKey(today);
    const todaySchedules = schedules[dateKey] || [];
    
    console.log('Summary - dateKey:', dateKey);
    console.log('Summary - schedules keys:', Object.keys(schedules));
    console.log('Summary - todaySchedules:', todaySchedules);
    
    // Sort schedules by time (handle undefined time)
    const sortedSchedules = [...todaySchedules].sort((a, b) => {
      const timeA = (a.time || '00:00').split(':').map(Number);
      const timeB = (b.time || '00:00').split(':').map(Number);
      return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
    });
    
    // Get current week key
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekKey = `${weekStart.getFullYear()}-W${this.getWeekNumber(weekStart)}`;
    const currentWeekPlan = weeklyPlans[weekKey];
    
    // Get current month key
    const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const currentMonthPlan = monthlyPlans[monthKey];
    
    // Get current quarter key
    const currentQuarter = Math.ceil((today.getMonth() + 1) / 3);
    const quarterKey = `${today.getFullYear()}-Q${currentQuarter}`;
    const currentQuarterPlan = quarterlyPlans[quarterKey];
    
    // Count completed schedules
    const completedCount = sortedSchedules.filter(s => s.completed).length;
    const totalCount = sortedSchedules.length;
    
    // Format today's date based on language
    const lang = i18n.getCurrentLanguage();
    const locale = lang === 'ko' ? 'ko-KR' : 'en-US';
    const todayStr = today.toLocaleDateString(locale, { month: 'long', day: 'numeric', weekday: 'short' });
    const completedText = i18n.t('prompts.complete');
    const urgentText = i18n.t('prompts.urgent');
    const undecidedText = i18n.t('prompts.undecided');
    
    summaryContent.innerHTML = `
      <div class="summary-sections">
        <!-- 일간 일정 섹션 -->
        <div class="summary-section" style="margin-bottom: var(--spacing-xl);">
          <h3 style="font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold); color: var(--color-text-accent); margin-bottom: var(--spacing-md);">
            ${i18n.t('summary.todaySchedule')} <span style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">(${todayStr})</span>
            ${totalCount > 0 ? `<span style="font-size: var(--font-size-sm); color: var(--color-success); margin-left: var(--spacing-sm);">${completedCount}/${totalCount} ${completedText}</span>` : ''}
          </h3>
          <div style="background: var(--color-bg-elevated); border-radius: var(--radius-md); padding: var(--spacing-md);">
            ${sortedSchedules.length > 0 
              ? sortedSchedules.map(s => {
                  const isCompleted = s.completed || false;
                  const completedStyle = isCompleted ? 'opacity: 0.6; text-decoration: line-through;' : '';
                  const checkMark = isCompleted ? '✓' : '○';
                  const checkColor = isCompleted ? 'var(--color-success)' : 'var(--color-text-tertiary)';
                  const duration = s.duration || 60;
                  const endTime = this.calculateEndTime(s.time || '09:00', duration);
                  return `
                    <div style="padding: var(--spacing-sm) 0; border-bottom: 1px solid var(--color-border); display: flex; align-items: center; gap: var(--spacing-sm);">
                      <span style="color: ${checkColor}; font-size: 14px;">${checkMark}</span>
                      <span style="color: var(--color-text-accent); font-weight: var(--font-weight-medium); min-width: 80px; ${completedStyle}">${s.time || undecidedText} - ${endTime}</span>
                      <span style="${completedStyle}">${s.title}</span>
                      ${s.priority === 'high' ? `<span style="color: var(--color-error); font-size: var(--font-size-xs); margin-left: auto;">${urgentText}</span>` : ''}
                    </div>
                  `;
                }).join('')
              : `<div style="color: var(--color-text-tertiary); text-align: center; padding: var(--spacing-md);">${i18n.t('summary.noTodaySchedule')}</div>`
            }
          </div>
        </div>
        
        <!-- 주간 계획 섹션 -->
        <div class="summary-section" style="margin-bottom: var(--spacing-xl);">
          <h3 style="font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold); color: var(--color-text-accent); margin-bottom: var(--spacing-md);">${i18n.t('summary.weeklyPlan')}</h3>
          <div style="background: var(--color-bg-elevated); border-radius: var(--radius-md); padding: var(--spacing-md);">
            ${currentWeekPlan && currentWeekPlan.summary 
              ? `<div style="color: var(--color-text-secondary); line-height: 1.6;">${currentWeekPlan.summary}</div>`
              : `<div style="color: var(--color-text-tertiary); text-align: center; padding: var(--spacing-md);">${i18n.t('summary.noWeeklyPlan')}</div>`
            }
          </div>
        </div>
        
        <!-- 월간 계획 섹션 -->
        <div class="summary-section" style="margin-bottom: var(--spacing-xl);">
          <h3 style="font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold); color: var(--color-text-accent); margin-bottom: var(--spacing-md);">${i18n.t('summary.monthlyPlan')}</h3>
          <div style="background: var(--color-bg-elevated); border-radius: var(--radius-md); padding: var(--spacing-md);">
            ${currentMonthPlan && currentMonthPlan.summary 
              ? `<div style="color: var(--color-text-secondary); line-height: 1.6;">${currentMonthPlan.summary}</div>`
              : `<div style="color: var(--color-text-tertiary); text-align: center; padding: var(--spacing-md);">${i18n.t('summary.noMonthlyPlan')}</div>`
            }
          </div>
        </div>
        
        <!-- 분기 계획 섹션 -->
        <div class="summary-section" style="margin-bottom: var(--spacing-xl);">
          <h3 style="font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold); color: var(--color-text-accent); margin-bottom: var(--spacing-md);">${i18n.t('summary.quarterlyPlan', { quarter: currentQuarter })}</h3>
          <div style="background: var(--color-bg-elevated); border-radius: var(--radius-md); padding: var(--spacing-md);">
            ${currentQuarterPlan && currentQuarterPlan.summary 
              ? `<div style="color: var(--color-text-secondary); line-height: 1.6;">${currentQuarterPlan.summary}</div>`
              : `<div style="color: var(--color-text-tertiary); text-align: center; padding: var(--spacing-md);">${i18n.t('summary.noQuarterlyPlan')}</div>`
            }
          </div>
        </div>
      </div>
    `;
  }

  calculateEndTime(startTime, durationMinutes) {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  }

  // ============================================
  // 채팅 기능 관련 메서드
  // ============================================

  setupChatEventListeners() {
    const chatInput = this.shadowRoot.getElementById('chat-input');
    const chatSendBtn = this.shadowRoot.getElementById('chat-send-btn');
    const chatMessages = this.shadowRoot.getElementById('chat-messages');
    
    if (!chatInput || !chatSendBtn) return;

    // Enter 키로 메시지 전송 (Shift+Enter는 줄바꿈)
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendChatMessage();
      }
    });

    // 전송 버튼 클릭
    chatSendBtn.addEventListener('click', () => {
      this.sendChatMessage();
    });

    // textarea 자동 높이 조절
    chatInput.addEventListener('input', () => {
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    });

    // 제안 버튼 클릭 이벤트
    if (chatMessages) {
      chatMessages.addEventListener('click', (e) => {
        const suggestionBtn = e.target.closest('.chat-suggestion-btn');
        if (suggestionBtn) {
          const suggestion = suggestionBtn.dataset.suggestion;
          if (suggestion) {
            chatInput.value = suggestion;
            this.sendChatMessage();
          }
        }
      });
    }
  }

  async sendChatMessage() {
    const chatInput = this.shadowRoot.getElementById('chat-input');
    const chatMessagesContainer = this.shadowRoot.getElementById('chat-messages');
    
    if (!chatInput || !chatMessagesContainer) return;
    
    const message = chatInput.value.trim();
    if (!message || this.isChatLoading) return;

    // 사용자 메시지 추가
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    
    this.chatMessages.push({
      role: 'user',
      content: message,
      time: timeStr
    });

    // 입력창 초기화
    chatInput.value = '';
    chatInput.style.height = 'auto';

    // UI 업데이트
    this.updateChatUI();
    this.scrollChatToBottom();

    // 로딩 표시
    this.isChatLoading = true;
    this.showChatLoadingIndicator();

    try {
      // 채팅 컨텍스트 수집
      const scheduleContext = await this.collectScheduleContext();
      const settings = await this.storage.getSettings();
      
      const userInfo = {
        name: settings.name || '',
        job: settings.job || '',
        personality: settings.personality || ''
      };

      // Gemini API 호출
      if (!this.gemini) {
        throw new Error('Gemini API가 설정되지 않았어요. 설정에서 API 키를 입력해주세요.');
      }

      const response = await this.gemini.chat({
        message,
        userInfo,
        scheduleContext,
        clientLocalTime: new Date().toISOString(),
        chatHistory: this.chatMessages.slice(0, -1) // 현재 메시지 제외
      });

      // AI 응답 추가
      const responseTime = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      this.chatMessages.push({
        role: 'assistant',
        content: response,
        time: responseTime
      });

    } catch (error) {
      console.error('Chat error:', error);
      
      // 에러 메시지 추가
      const errorTime = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      this.chatMessages.push({
        role: 'assistant',
        content: `죄송해요, 응답을 생성하는 중에 문제가 발생했어요. 😢\n\n${error.message || '잠시 후 다시 시도해 주세요.'}`,
        time: errorTime
      });
    } finally {
      this.isChatLoading = false;
      this.hideChatLoadingIndicator();
      this.updateChatUI();
      this.scrollChatToBottom();
    }
  }

  async collectScheduleContext() {
    const today = new Date();
    const dateKey = this.getLocalDateKey(today);
    
    // 일간 일정
    const schedules = await this.storage.getSchedules();
    const dailySchedules = schedules[dateKey] || [];

    // 주간 계획
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekKey = `${weekStart.getFullYear()}-W${this.getWeekNumber(weekStart)}`;
    const weeklyPlansResult = await chrome.storage.local.get('weeklyPlans');
    const weeklyPlan = (weeklyPlansResult.weeklyPlans || {})[weekKey] || null;

    // 월간 계획
    const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const monthlyPlansResult = await chrome.storage.local.get('monthlyPlans');
    const monthlyPlan = (monthlyPlansResult.monthlyPlans || {})[monthKey] || null;

    // 분기 계획
    const currentQuarter = Math.ceil((today.getMonth() + 1) / 3);
    const quarterKey = `${today.getFullYear()}-Q${currentQuarter}`;
    const quarterlyPlansResult = await chrome.storage.local.get('quarterlyPlans');
    const quarterlyPlan = (quarterlyPlansResult.quarterlyPlans || {})[quarterKey] || null;

    return {
      dailySchedules,
      weeklyPlan,
      monthlyPlan,
      quarterlyPlan
    };
  }

  updateChatUI() {
    const chatMessagesContainer = this.shadowRoot.getElementById('chat-messages');
    if (chatMessagesContainer) {
      chatMessagesContainer.innerHTML = this.renderChatMessages();
    }
  }

  showChatLoadingIndicator() {
    const chatMessagesContainer = this.shadowRoot.getElementById('chat-messages');
    if (!chatMessagesContainer) return;

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'chat-message chat-message-assistant chat-loading';
    loadingDiv.innerHTML = `
      <div class="chat-message-avatar chat-avatar-assistant">🤖</div>
      <div class="chat-message-content">
        <div class="chat-typing-indicator">
          <span class="chat-typing-dot"></span>
          <span class="chat-typing-dot"></span>
          <span class="chat-typing-dot"></span>
        </div>
      </div>
    `;
    chatMessagesContainer.appendChild(loadingDiv);
    this.scrollChatToBottom();
  }

  hideChatLoadingIndicator() {
    const loadingIndicator = this.shadowRoot.querySelector('.chat-loading');
    if (loadingIndicator) {
      loadingIndicator.remove();
    }
  }

  scrollChatToBottom() {
    const chatMessagesContainer = this.shadowRoot.getElementById('chat-messages');
    if (chatMessagesContainer) {
      setTimeout(() => {
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
      }, 50);
    }
  }

  async processAddTask() {
    const title = this.shadowRoot.getElementById('task-title').value.trim();
    const description = this.shadowRoot.getElementById('task-description').value.trim();
    const priority = this.shadowRoot.getElementById('task-priority').value;
    const durationHours = parseFloat(this.shadowRoot.getElementById('task-duration').value) || 2;
    const duration = Math.round(durationHours * 60); // 시간을 분으로 변환
    
    if (!title) {
      this.showToast('제목을 입력해주세요.', 'warning');
      return;
    }
    
    if (!description) {
      this.showToast(i18n.t('messages.descriptionRequired'), 'warning');
      return;
    }
    
    // duration 유효성 검사
    if (durationHours < 0.5) {
      this.showToast(i18n.t('messages.durationMin'), 'warning');
      return;
    }
    
    if (durationHours > 24) {
      this.showToast(i18n.t('messages.durationMax'), 'warning');
      return;
    }
    
    // Get user settings for AI prompt
    const settings = await this.storage.getSettings();
    
    // 현재 일간 뷰에서 선택된 날짜를 고정으로 사용 (날짜 옆 추가 버튼이므로 해당 일자)
    const targetDate = this.currentDate || new Date();
    const dateKey = this.getLocalDateKey(targetDate);
    
    // Get existing schedules for the target date
    const schedules = await this.storage.getSchedules();
    const existingSchedules = schedules[dateKey] || [];
    
    // 완료되지 않은 일정만 필터링 (시간 배분 시 완료된 일정은 제외)
    const activeSchedules = existingSchedules.filter(s => !s.completed);
    
    // If Gemini API is available, use it to analyze and schedule
    if (this.gemini) {
      // Show progress overlay
      this.showProgressOverlay();
      
      // Start progress animation
      const progressPromise = this.animateProgress();
      
      try {
        // 일간 매니저에게 해당 날짜의 컨텍스트만 전달하여 시간 배분 요청
        const aiResponse = await this.gemini.analyzeDailyTask({
          title,
          description,
          priority,
          duration,
          targetDate: dateKey,
          userInfo: settings,
          existingSchedules: activeSchedules.map(s => ({
            time: s.time,
            title: s.title,
            duration: s.duration || 60,
            priority: s.priority || 'medium',
            completed: s.completed || false
          })),
          clientLocalTime: new Date().toISOString()
        });
        
        // AI 응답에서 분할이 필요한 경우 처리
        if (aiResponse.splitRequired && aiResponse.scheduleArray && aiResponse.scheduleArray.length > 0) {
          // 분할된 일정들을 해당 날짜에 등록
          for (const splitSchedule of aiResponse.scheduleArray) {
            await this.addTaskToScheduleForDate({
              title: splitSchedule.title || aiResponse.suggestedTitle || title,
              originalTitle: title,
              description,
              priority,
              duration: splitSchedule.duration || 240,
              time: splitSchedule.time,
              aiAnalysis: {
                ...aiResponse,
                isSplitSchedule: true
              }
            }, dateKey);
          }
        } else {
          // 단일 일정 등록
          await this.addTaskToScheduleForDate({
            title: aiResponse.suggestedTitle || title,
            originalTitle: title,
            description,
            priority,
            duration,
            time: aiResponse.suggestedTime || '09:00',
            aiAnalysis: aiResponse
          }, dateKey);
        }
        
        // Wait for progress animation to complete, then show completion
        await progressPromise;
        await this.showProgressComplete();
        
        // Hide progress overlay
        this.hideProgressOverlay();
        
        // Show success toast
        this.showSuccessToast(title);
        
        // Close modal
        this.shadowRoot.getElementById('add-task-modal').classList.remove('active');
        
        // Reset form and clear selected text
        const addTaskForm = this.shadowRoot.getElementById('add-task-form');
        if (addTaskForm) {
          addTaskForm.reset();
        }
        this.selectedText = null;
        
        // Reload daily data to show new schedule
        await this.loadData();
        
      } catch (error) {
        console.error('AI 분석 실패:', error);
        
        // Stop progress and show error
        this.stopProgressAnimation = true;
        this.hideProgressOverlay();
        
        this.showToast(i18n.t('messages.aiAnalysisError'), 'warning');
        
        // Add task without AI analysis
        await this.addTaskToSchedule({
          title,
          description,
          priority,
          duration
        });
        
        // Close modal and reset form
        this.shadowRoot.getElementById('add-task-modal').classList.remove('active');
        const form = this.shadowRoot.getElementById('add-task-form');
        if (form) {
          form.reset();
        }
        this.selectedText = null;
        
        // Reload daily data
        await this.loadData();
      }
    } else {
      // Add task without AI analysis
      await this.addTaskToSchedule({
        title,
        description,
        priority,
        duration
      });
      
      this.showSuccessToast(title);
      
      // Close modal and reset form
      this.shadowRoot.getElementById('add-task-modal').classList.remove('active');
      const form = this.shadowRoot.getElementById('add-task-form');
      if (form) {
        form.reset();
      }
      this.selectedText = null;
      
      // Reload daily data
      await this.loadData();
    }
  }

  showProgressOverlay() {
    const overlay = this.shadowRoot.getElementById('progress-overlay');
    if (overlay) {
      overlay.classList.add('active');
    }
    this.stopProgressAnimation = false;
  }

  hideProgressOverlay() {
    const overlay = this.shadowRoot.getElementById('progress-overlay');
    if (overlay) {
      overlay.classList.remove('active');
    }
  }

  async animateProgress() {
    const messages = this.getProgressMessages();
    const messageEl = this.shadowRoot.getElementById('progress-message');
    
    for (let i = 0; i < messages.length; i++) {
      if (this.stopProgressAnimation) break;
      
      if (messageEl) {
        // Fade out
        messageEl.classList.add('fade-out');
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Change text
        messageEl.textContent = messages[i];
        
        // Fade in
        messageEl.classList.remove('fade-out');
        messageEl.classList.add('fade-in');
        await new Promise(resolve => setTimeout(resolve, 300));
        messageEl.classList.remove('fade-in');
      }
      
      await new Promise(resolve => setTimeout(resolve, 2400)); // 3초 - 0.6초 (애니메이션)
    }
    
    // If still animating after all messages, show waiting message
    if (!this.stopProgressAnimation && messageEl) {
      messageEl.classList.add('fade-out');
      await new Promise(resolve => setTimeout(resolve, 300));
      messageEl.textContent = "⏳ 마무리하고 있어요...";
      messageEl.classList.remove('fade-out');
      messageEl.classList.add('fade-in');
      await new Promise(resolve => setTimeout(resolve, 300));
      messageEl.classList.remove('fade-in');
    }
  }

  async showProgressComplete() {
    const messageEl = this.shadowRoot.getElementById('progress-message');
    
    if (messageEl) {
      // Fade out current message
      messageEl.classList.add('fade-out');
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Show completion message
      messageEl.textContent = i18n.t('summary.scheduleRegistered');
      messageEl.classList.remove('fade-out');
      messageEl.classList.add('fade-in');
      await new Promise(resolve => setTimeout(resolve, 300));
      messageEl.classList.remove('fade-in');
    }
    
    // Wait 2 seconds before hiding
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  showSuccessToast(title) {
    // Remove existing toast if any
    const existingToast = this.shadowRoot.getElementById('toast-notification');
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.className = 'toast toast-success';
    toast.innerHTML = `
      <div class="toast-title">${title}</div>
      <div class="toast-message">계획 등록 성공!</div>
    `;
    
    this.shadowRoot.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 300);
    }, 3000);
  }

  showToast(message, type = 'info') {
    // Remove existing toast if any
    const existingToast = this.shadowRoot.getElementById('toast-notification');
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    this.shadowRoot.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 300);
    }, 3000);
  }

  showConfirmModal(title, message, onConfirm) {
    const modal = this.shadowRoot.getElementById('confirm-modal');
    const titleEl = this.shadowRoot.getElementById('confirm-modal-title');
    const messageEl = this.shadowRoot.getElementById('confirm-modal-message');
    const cancelBtn = this.shadowRoot.getElementById('confirm-cancel-btn');
    const okBtn = this.shadowRoot.getElementById('confirm-ok-btn');
    
    if (!modal || !titleEl || !messageEl || !cancelBtn || !okBtn) return;
    
    titleEl.textContent = title;
    messageEl.textContent = message;
    
    // Remove existing event listeners by cloning
    const newCancelBtn = cancelBtn.cloneNode(true);
    const newOkBtn = okBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    
    newCancelBtn.addEventListener('click', () => {
      modal.classList.remove('active');
    });
    
    newOkBtn.addEventListener('click', () => {
      modal.classList.remove('active');
      if (onConfirm) onConfirm();
    });
    
    modal.classList.add('active');
  }

  checkAndResolveConflicts(aiResponse, existingSchedules, duration) {
    if (!aiResponse.suggestedTime) {
      return { finalTime: null, resolved: false };
    }

    const suggestedTime = aiResponse.suggestedTime;
    const [suggestedHour, suggestedMinute] = suggestedTime.split(':').map(Number);
    const suggestedMinutes = suggestedHour * 60 + suggestedMinute;
    const endMinutes = suggestedMinutes + duration;

    // Check for conflicts
    const conflicts = existingSchedules.filter(schedule => {
      const [scheduleHour, scheduleMinute] = schedule.time.split(':').map(Number);
      const scheduleStart = scheduleHour * 60 + scheduleMinute;
      const scheduleDuration = schedule.duration || 60;
      const scheduleEnd = scheduleStart + scheduleDuration;

      // Check if time ranges overlap
      return (suggestedMinutes < scheduleEnd && endMinutes > scheduleStart);
    });

    if (conflicts.length === 0) {
      return { finalTime: suggestedTime, resolved: false };
    }

    // Resolve conflict by finding next available slot
    const allSchedules = [...existingSchedules].sort((a, b) => {
      const [aHour, aMin] = a.time.split(':').map(Number);
      const [bHour, bMin] = b.time.split(':').map(Number);
      return (aHour * 60 + aMin) - (bHour * 60 + bMin);
    });

    // Find next available slot after the last schedule
    let lastEndTime = 9 * 60; // Start from 9:00 AM
    for (const schedule of allSchedules) {
      const [hour, min] = schedule.time.split(':').map(Number);
      const start = hour * 60 + min;
      const scheduleDuration = schedule.duration || 60;
      const end = start + scheduleDuration;

      if (lastEndTime + duration <= start) {
        // Found a gap
        const finalHour = Math.floor(lastEndTime / 60);
        const finalMin = lastEndTime % 60;
        return {
          finalTime: `${finalHour.toString().padStart(2, '0')}:${finalMin.toString().padStart(2, '0')}`,
          resolved: true
        };
      }

      lastEndTime = Math.max(lastEndTime, end);
    }

    // If no gap found, place after the last schedule
    const finalHour = Math.floor(lastEndTime / 60);
    const finalMin = lastEndTime % 60;
    return {
      finalTime: `${finalHour.toString().padStart(2, '0')}:${finalMin.toString().padStart(2, '0')}`,
      resolved: true
    };
  }

  parseLongTermSchedule(description, title) {
    if (!description) return null;
    
    const dates = [];
    const desc = description.toLowerCase();
    
    // Parse date patterns like "12월 15일~18일", "12/15-18", "12월 15일부터 18일까지"
    const monthDayRange = desc.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일?\s*(?:~|부터|-|~)\s*(\d{1,2})\s*일/);
    if (monthDayRange) {
      const month = parseInt(monthDayRange[1]);
      const startDay = parseInt(monthDayRange[2]);
      const endDay = parseInt(monthDayRange[3]);
      const year = new Date().getFullYear();
      
      for (let day = startDay; day <= endDay; day++) {
        const date = new Date(year, month - 1, day);
        dates.push(this.getLocalDateKey(date));
      }
      return dates;
    }
    
    // Parse patterns like "내년 1월~3월", "2025년 1월부터 3월까지"
    const yearMonthRange = desc.match(/(?:내년|(\d{4})\s*년)\s*(\d{1,2})\s*월\s*(?:~|부터|-|~)\s*(\d{1,2})\s*월/);
    if (yearMonthRange) {
      const year = yearMonthRange[1] ? parseInt(yearMonthRange[1]) : new Date().getFullYear() + 1;
      const startMonth = parseInt(yearMonthRange[2]);
      const endMonth = parseInt(yearMonthRange[3]);
      
      for (let month = startMonth; month <= endMonth; month++) {
        const daysInMonth = new Date(year, month, 0).getDate();
        // Add first day of each month as placeholder
        dates.push(this.getLocalDateKey(new Date(year, month - 1, 1)));
        // Optionally add last day too
        if (month === endMonth) {
          dates.push(this.getLocalDateKey(new Date(year, month - 1, daysInMonth)));
        }
      }
      return dates;
    }
    
    // Parse single date patterns like "12월 15일", "12/15"
    const singleDate = desc.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
    if (singleDate) {
      const month = parseInt(singleDate[1]);
      const day = parseInt(singleDate[2]);
      const year = new Date().getFullYear();
      const date = new Date(year, month - 1, day);
      return [this.getLocalDateKey(date)];
    }
    
    return null;
  }

  async addTaskToSchedule(task) {
    const dateKey = this.getLocalDateKey(this.currentDate || new Date());
    return this.addTaskToScheduleForDate(task, dateKey);
  }

  generateRepeatDates(repeatPattern, scope) {
    const dates = [];
    const today = new Date();
    let startDate = new Date(today);
    
    // Determine start date based on scope
    if (scope === 'weekly') {
      startDate.setDate(today.getDate() - today.getDay()); // Start of week
    } else if (scope === 'monthly') {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (scope === 'yearly') {
      startDate = new Date(today.getFullYear(), 0, 1);
    }
    
    const endDate = repeatPattern.endDate 
      ? new Date(repeatPattern.endDate) 
      : (() => {
          const end = new Date(startDate);
          if (scope === 'weekly') {
            end.setDate(startDate.getDate() + 6);
          } else if (scope === 'monthly') {
            end = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
          } else if (scope === 'yearly') {
            end = new Date(startDate.getFullYear(), 11, 31);
          }
          return end;
        })();
    
    const interval = repeatPattern.interval || 1;
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      dates.push({
        date: this.getLocalDateKey(currentDate),
        time: null,
        duration: null
      });
      
      if (repeatPattern.type === 'daily') {
        currentDate.setDate(currentDate.getDate() + interval);
      } else if (repeatPattern.type === 'weekly') {
        currentDate.setDate(currentDate.getDate() + (7 * interval));
      } else if (repeatPattern.type === 'monthly') {
        currentDate.setMonth(currentDate.getMonth() + interval);
      }
    }
    
    return dates;
  }

  async processSchedulesFromIntent({ title, description, priority, duration, scheduleDates, intentResponse, settings, existingSchedules }) {
    let addedCount = 0;
    
    for (const scheduleDate of scheduleDates) {
      // 방어 코드: date가 없으면 오늘 날짜 사용
      const dateKey = scheduleDate.date || this.getLocalDateKey(new Date());
      const schedules = await this.storage.getSchedules();
      const daySchedules = schedules[dateKey] || [];
      
      // Get AI analysis for this specific date
      const aiResponse = await this.gemini.analyzeTask({
        title,
        description,
        priority,
        duration: scheduleDate.duration || duration,
        selectedText: null,
        userInfo: settings,
        existingSchedules: daySchedules.map(s => ({
          time: s.time,
          title: s.title,
          duration: s.duration || 60,
          priority: s.priority || 'medium'
        })),
        clientLocalTime: new Date().toISOString()
      });
      
      // AI가 분할을 권장하고 scheduleArray가 있는 경우
      if (aiResponse.splitRequired && aiResponse.scheduleArray && aiResponse.scheduleArray.length > 0) {
        // 분할된 일정들을 각각 등록
        for (const splitSchedule of aiResponse.scheduleArray) {
          const splitDateKey = splitSchedule.date || dateKey;
          const splitSchedules = await this.storage.getSchedules();
          const splitDaySchedules = splitSchedules[splitDateKey] || [];
          
          // 분할된 일정에 대해 충돌 확인
          const splitConflictResult = this.checkAndResolveConflicts(
            { suggestedTime: splitSchedule.time },
            splitDaySchedules,
            splitSchedule.duration || 240
          );
          
          const splitFinalTime = splitSchedule.time || splitConflictResult.finalTime || '09:00';
          
          await this.addTaskToScheduleForDate({
            title: splitSchedule.title || `${aiResponse.suggestedTitle || title}`,
            originalTitle: title,
            description,
            priority,
            duration: splitSchedule.duration || 240,
            aiAnalysis: {
              ...aiResponse,
              suggestedTime: splitFinalTime,
              conflictResolved: splitConflictResult.resolved,
              isSplitSchedule: true
            }
          }, splitDateKey);
          
          addedCount++;
        }
      } else {
        // 일반 일정 등록 (분할 불필요)
        // Check for conflicts
        const conflictResult = this.checkAndResolveConflicts(aiResponse, daySchedules, scheduleDate.duration || duration);
        
        // Use time from scheduleArray if available, otherwise use AI suggestion
        const finalTime = scheduleDate.time || conflictResult.finalTime || aiResponse.suggestedTime || '09:00';
        
        // Use AI suggested title if available (more concise)
        const finalTitle = aiResponse.suggestedTitle || title;
        
        await this.addTaskToScheduleForDate({
          title: finalTitle,
          originalTitle: title,
          description,
          priority,
          duration: scheduleDate.duration || duration,
          aiAnalysis: {
            ...aiResponse,
            suggestedTime: finalTime,
            conflictResolved: conflictResult.resolved
          }
        }, dateKey);
        
        addedCount++;
      }
    }
    
    return addedCount;
  }

  async addTaskToScheduleForDate(task, dateKey) {
    // 방어 코드: dateKey가 없거나 undefined인 경우 오늘 날짜 사용
    if (!dateKey || dateKey === 'undefined') {
      dateKey = this.getLocalDateKey(new Date());
      console.warn('dateKey was undefined, using today:', dateKey);
    }
    
    const schedules = await this.storage.getSchedules();
    
    // 기존 undefined 키 정리
    if (schedules['undefined']) {
      delete schedules['undefined'];
      await this.storage.saveSchedules(schedules);
    }
    
    if (!schedules[dateKey]) {
      schedules[dateKey] = [];
    }
    
    // task에 time이 있으면 사용, 없으면 자동 배정
    const timeSlot = task.time || (task.aiAnalysis?.suggestedTime) || this.suggestTimeSlot(task, schedules[dateKey]);
    
    const newSchedule = {
      id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
      ...task,
      time: timeSlot,
      date: dateKey
    };
    
    schedules[dateKey].push(newSchedule);
    await this.storage.saveSchedules(schedules);
    
    // Sync to weekly/monthly/yearly plans if AI is available
    if (this.gemini) {
      try {
        const settings = await this.storage.getSettings();
        await this.syncScheduleToPlans(newSchedule, schedules, settings);
      } catch (error) {
        console.error('Failed to sync schedule to plans:', error);
      }
    }
    
    if (dateKey === this.getLocalDateKey(this.currentDate || new Date())) {
      await this.loadData();
    }
  }

  async syncScheduleToPlans(newSchedule, allSchedules, userInfo) {
    if (!this.gemini) return;
    
    try {
      // Get current week, month, quarter using local timezone
      const today = new Date(this.currentDate);
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      const weekKey = `${weekStart.getFullYear()}-W${this.getWeekNumber(weekStart)}`;
      
      const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      const currentQuarter = Math.ceil((today.getMonth() + 1) / 3);
      const quarterKey = `${today.getFullYear()}-Q${currentQuarter}`;
      
      // Use AI to sync to weekly/monthly/quarterly plans with JSON response
      const syncResponse = await this.gemini.syncScheduleToPlans(newSchedule, allSchedules, userInfo, {
        weekKey,
        monthKey,
        quarterKey,
        weekStart: this.getLocalDateKey(weekStart),
        weekEnd: this.getLocalDateKey(weekEnd)
      });
      
      // Parse and store the JSON response
      if (syncResponse) {
        await this.storePlanData(syncResponse, weekKey, monthKey, quarterKey);
      }
    } catch (error) {
      console.error('Failed to sync schedule to plans:', error);
    }
  }

  getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  // 로컬 시간대 기준 날짜 키 생성 (YYYY-MM-DD)
  getLocalDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async storePlanData(planData, weekKey, monthKey, quarterKey) {
    // Store weekly plan
    if (planData.weekly) {
      const weeklyPlans = await chrome.storage.local.get('weeklyPlans') || {};
      if (!weeklyPlans.weeklyPlans) {
        weeklyPlans.weeklyPlans = {};
      }
      weeklyPlans.weeklyPlans[weekKey] = planData.weekly;
      await chrome.storage.local.set(weeklyPlans);
    }
    
    // Store monthly plan
    if (planData.monthly) {
      const monthlyPlans = await chrome.storage.local.get('monthlyPlans') || {};
      if (!monthlyPlans.monthlyPlans) {
        monthlyPlans.monthlyPlans = {};
      }
      monthlyPlans.monthlyPlans[monthKey] = planData.monthly;
      await chrome.storage.local.set(monthlyPlans);
    }
    
    // Store quarterly plan
    if (planData.quarterly) {
      const quarterlyPlans = await chrome.storage.local.get('quarterlyPlans') || {};
      if (!quarterlyPlans.quarterlyPlans) {
        quarterlyPlans.quarterlyPlans = {};
      }
      quarterlyPlans.quarterlyPlans[quarterKey] = planData.quarterly;
      await chrome.storage.local.set(quarterlyPlans);
    }
  }

  suggestTimeSlot(task, existingSchedules) {
    // Use AI suggestion if available (already conflict-resolved)
    if (task.aiAnalysis && task.aiAnalysis.suggestedTime) {
      return task.aiAnalysis.suggestedTime;
    }
    
    // Smart time slot suggestion considering existing schedules and duration
    // Support minute-based time slots (not just hour-based)
    const startHour = 9;
    const endHour = 18;
    const duration = task.duration || 60; // Duration in minutes
    
    // Sort existing schedules by time
    const sortedSchedules = [...existingSchedules].sort((a, b) => {
      const [aHour, aMin] = a.time.split(':').map(Number);
      const [bHour, bMin] = b.time.split(':').map(Number);
      return (aHour * 60 + aMin) - (bHour * 60 + bMin);
    });
    
    // Find gaps between schedules (in minutes)
    let currentTime = startHour * 60; // Start from 9:00 AM in minutes
    
    for (const schedule of sortedSchedules) {
      const [scheduleHour, scheduleMin] = schedule.time.split(':').map(Number);
      const scheduleStart = scheduleHour * 60 + scheduleMin;
      const scheduleDuration = schedule.duration || 60;
      const scheduleEnd = scheduleStart + scheduleDuration;
      
      // Check if there's enough time before this schedule
      if (currentTime + duration <= scheduleStart) {
        const hour = Math.floor(currentTime / 60);
        const min = currentTime % 60;
        return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      }
      
      // Move current time to after this schedule
      currentTime = Math.max(currentTime, scheduleEnd);
    }
    
    // If no gap found, place after the last schedule or at end of day
    if (currentTime + duration <= endHour * 60) {
      const hour = Math.floor(currentTime / 60);
      const min = currentTime % 60;
      return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
    }
    
    // Default to next available time (in minutes)
    const hour = Math.floor(currentTime / 60);
    const min = currentTime % 60;
    return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
  }

  async loadData() {
    // Initialize currentDate if not set
    if (!this.currentDate) {
      this.currentDate = new Date();
    }
    
    // Use currentDate instead of today for navigation
    const dateKey = this.getLocalDateKey(this.currentDate);
    const schedules = await this.storage.getSchedules();
    const todaySchedules = schedules[dateKey] || [];
    
    // Update date display
    const dateDisplay = this.shadowRoot.getElementById('current-date-display');
    if (dateDisplay) {
      const lang = i18n.getCurrentLanguage();
      const locale = lang === 'ko' ? 'ko-KR' : 'en-US';
      const dateStr = this.currentDate.toLocaleDateString(locale, { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        weekday: 'long' 
      });
      dateDisplay.textContent = dateStr;
    }
    
    // Render schedule list
    const scheduleList = this.shadowRoot.getElementById('daily-schedule-list');
    if (scheduleList) {
      if (todaySchedules.length === 0) {
        scheduleList.innerHTML = `
          <div style="padding: var(--spacing-xl); text-align: center; color: var(--color-text-tertiary);">
            ${i18n.t('summary.noScheduleMessage')}
          </div>
        `;
      } else {
        scheduleList.innerHTML = todaySchedules.map(schedule => {
          const scheduleId = schedule.id || String(Date.now());
          // Format time to show hours and minutes
          const [hours, minutes] = schedule.time.split(':').map(Number);
          const timeStr = minutes > 0 ? `${hours}:${minutes.toString().padStart(2, '0')}` : `${hours}:00`;
          const isCompleted = schedule.completed || false;
          const completedClass = isCompleted ? 'schedule-item-completed' : '';
          
          return `
          <div class="schedule-item ${completedClass}" draggable="${!isCompleted}" data-id="${scheduleId}" data-schedule='${JSON.stringify(schedule).replace(/'/g, "&#39;")}'>
            <div class="schedule-item-time">${timeStr}</div>
            <div class="schedule-item-content" style="cursor: pointer;">
              <strong class="schedule-item-title">${schedule.title}</strong>
            </div>
            <div class="schedule-item-actions" style="opacity: 1;">
              <button class="btn btn-icon schedule-complete-btn ${isCompleted ? 'completed' : ''}" data-id="${scheduleId}" type="button" title="${isCompleted ? i18n.t('prompts.completed') : i18n.t('prompts.completeAction')}">
                ${isCompleted ? '✓' : '○'}
              </button>
            </div>
          </div>
        `;
        }).join('');
        
        // Add click listeners to schedule items
        scheduleList.querySelectorAll('.schedule-item-content').forEach(item => {
          item.addEventListener('click', (e) => {
            const scheduleItem = e.target.closest('.schedule-item');
            const scheduleData = scheduleItem.dataset.schedule;
            if (scheduleData) {
              try {
                const schedule = JSON.parse(scheduleData.replace(/&#39;/g, "'"));
                this.showScheduleDetail(schedule);
              } catch (error) {
                console.error('Failed to parse schedule data:', error);
              }
            }
          });
        });
      }
      
      // Re-setup drag and drop
      this.setupDragAndDrop();
    }
    
  }

  async toggleScheduleComplete(id) {
    console.log('toggleScheduleComplete called with id:', id);
    
    const schedules = await this.storage.getSchedules();
    const dateKey = this.getLocalDateKey(this.currentDate);
    
    if (schedules[dateKey]) {
      const schedule = schedules[dateKey].find(s => s.id === id || s.id === String(id));
      if (schedule) {
        schedule.completed = !schedule.completed;
        await this.storage.saveSchedules(schedules);
        await this.loadData();
        
        if (schedule.completed) {
          this.showToast(i18n.t('messages.scheduleCompleted'), 'success');
        }
      }
    }
  }

  async deleteSchedule(id) {
    console.log('deleteSchedule called with id:', id);
    
    // Show progress overlay with blur
    this.showProgressOverlay();
    const progressPromise = this.animateProgress();
    
    const schedules = await this.storage.getSchedules();
    const dateKey = this.getLocalDateKey(this.currentDate);
    
    if (schedules[dateKey]) {
      schedules[dateKey] = schedules[dateKey].filter(s => {
        const match = s.id === id || s.id === String(id);
        return !match;
      });
      
      await this.storage.saveSchedules(schedules);
      
      // Regenerate plans based on updated schedules
      if (this.gemini) {
        try {
          const settings = await this.storage.getSettings();
          await this.regeneratePlans(schedules, settings);
        } catch (error) {
          console.error('Plan regeneration failed:', error);
        }
      }
      
      // Wait for progress animation to complete
      await progressPromise;
      
      await this.loadData();
      this.hideProgressOverlay();
      this.showToast(i18n.t('messages.scheduleDeleted'), 'success');
    } else {
      this.hideProgressOverlay();
      console.warn('No schedules found for date');
    }
  }

  async regeneratePlans(schedules, settings) {
    // Get current week, month, quarter keys
    const today = new Date(this.currentDate);
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    const weekKey = `${weekStart.getFullYear()}-W${this.getWeekNumber(weekStart)}`;
    
    const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const currentQuarter = Math.ceil((today.getMonth() + 1) / 3);
    const quarterKey = `${today.getFullYear()}-Q${currentQuarter}`;
    
    // Generate plans based on all schedules using syncScheduleToPlans
    try {
      // Create a dummy schedule to trigger plan regeneration
      const dummySchedule = {
        title: '계획 재생성',
        time: '00:00',
        duration: 0,
        priority: 'medium',
        date: this.getLocalDateKey(today)
      };
      
      const syncResponse = await this.gemini.syncScheduleToPlans(dummySchedule, schedules, settings, {
        weekKey,
        monthKey,
        quarterKey,
        weekStart: this.getLocalDateKey(weekStart),
        weekEnd: this.getLocalDateKey(weekEnd)
      });
      
      if (syncResponse) {
        await this.storePlanData(syncResponse, weekKey, monthKey, quarterKey);
      }
    } catch (error) {
      console.error('Failed to regenerate plans:', error);
    }
  }

  async generateWeeklyPlan() {
    if (!this.gemini) {
      this.showToast(i18n.t('messages.apiKeyRequired'), 'warning');
      return;
    }

    const schedules = await this.storage.getSchedules();
    const settings = await this.storage.getSettings();
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekKey = `${weekStart.getFullYear()}-W${this.getWeekNumber(weekStart)}`;
    
    const weeklyPlanDiv = this.shadowRoot.getElementById('weekly-plan');
    if (weeklyPlanDiv) {
      weeklyPlanDiv.innerHTML = `
        <div style="padding: var(--spacing-xl); text-align: center;">
          <div class="loading-spinner" style="margin: 0 auto var(--spacing-md);"></div>
          <div style="color: var(--color-text-secondary);">${i18n.t('summary.organizingWeekly')}</div>
        </div>
      `;
    }
    
    try {
      const planData = await this.gemini.generateWeeklyPlan(schedules, settings, weekKey);
      if (planData && weeklyPlanDiv) {
        await this.storePlanData({ weekly: planData }, weekKey, null, null);
        this.renderWeeklyPlanData(planData);
      }
    } catch (error) {
      console.error('주간 계획 생성 실패:', error);
      this.showToast(i18n.t('messages.weeklyPlanError'), 'error');
      if (weeklyPlanDiv) {
        weeklyPlanDiv.innerHTML = `
          <div style="padding: var(--spacing-xl); text-align: center; color: var(--color-text-secondary);">
            계획 정리에 실패했습니다. 다시 시도해주세요.
          </div>
        `;
      }
    }
  }

  async generateMonthlyPlan() {
    if (!this.gemini) {
      this.showToast(i18n.t('messages.apiKeyRequired'), 'warning');
      return;
    }

    const schedules = await this.storage.getSchedules();
    const settings = await this.storage.getSettings();
    const today = new Date();
    const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    
    const monthlyPlanDiv = this.shadowRoot.getElementById('monthly-plan');
    if (monthlyPlanDiv) {
      monthlyPlanDiv.innerHTML = `
        <div style="padding: var(--spacing-xl); text-align: center;">
          <div class="loading-spinner" style="margin: 0 auto var(--spacing-md);"></div>
          <div style="color: var(--color-text-secondary);">${i18n.t('summary.generatingMonthly')}</div>
        </div>
      `;
    }
    
    try {
      const planData = await this.gemini.generateMonthlyPlan(schedules, settings, monthKey);
      if (planData && monthlyPlanDiv) {
        await this.storePlanData({ monthly: planData }, null, monthKey, null);
        this.renderMonthlyPlanData(planData);
      }
    } catch (error) {
      console.error('월간 계획 생성 실패:', error);
      this.showToast(i18n.t('messages.monthlyPlanError'), 'error');
      if (monthlyPlanDiv) {
        monthlyPlanDiv.innerHTML = `
          <div style="padding: var(--spacing-xl); text-align: center; color: var(--color-text-secondary);">
            계획 정리에 실패했습니다. 다시 시도해주세요.
          </div>
        `;
      }
    }
  }

  async generateQuarterlyPlan() {
    if (!this.gemini) {
      this.showToast(i18n.t('messages.apiKeyRequired'), 'warning');
      return;
    }

    const schedules = await this.storage.getSchedules();
    const settings = await this.storage.getSettings();
    const today = new Date();
    const currentQuarter = this.currentQuarter || Math.ceil((today.getMonth() + 1) / 3);
    const currentYear = this.currentQuarterYear || today.getFullYear();
    const quarterKey = `${currentYear}-Q${currentQuarter}`;
    
    const quarterlyPlanDiv = this.shadowRoot.getElementById('quarterly-plan');
    if (quarterlyPlanDiv) {
      quarterlyPlanDiv.innerHTML = `
        <div style="padding: var(--spacing-xl); text-align: center;">
          <div class="loading-spinner" style="margin: 0 auto var(--spacing-md);"></div>
          <div style="color: var(--color-text-secondary);">${i18n.t('summary.generatingQuarterly')}</div>
        </div>
      `;
    }
    
    try {
      const planData = await this.gemini.generateQuarterlyPlan(schedules, settings, quarterKey, currentQuarter, currentYear);
      if (planData && quarterlyPlanDiv) {
        await this.storeQuarterlyPlanData(planData, quarterKey);
        this.renderQuarterlyPlanData(planData);
      }
    } catch (error) {
      console.error('분기 계획 생성 실패:', error);
      this.showToast(i18n.t('messages.quarterlyPlanError'), 'error');
      if (quarterlyPlanDiv) {
        quarterlyPlanDiv.innerHTML = `
          <div style="padding: var(--spacing-xl); text-align: center; color: var(--color-text-secondary);">
            계획 생성에 실패했습니다. 다시 시도해주세요.
          </div>
        `;
      }
    }
  }

  async storeQuarterlyPlanData(planData, quarterKey) {
    const quarterlyPlans = await chrome.storage.local.get('quarterlyPlans') || {};
    if (!quarterlyPlans.quarterlyPlans) {
      quarterlyPlans.quarterlyPlans = {};
    }
    quarterlyPlans.quarterlyPlans[quarterKey] = planData;
    await chrome.storage.local.set(quarterlyPlans);
  }

  renderWeeklyPlanData(planData) {
    const weeklyPlanDiv = this.shadowRoot.getElementById('weekly-plan');
    if (!weeklyPlanDiv) return;
    
    const schedules = planData.schedules || [];
    
    // Group schedules by day
    const schedulesByDay = {};
    schedules.forEach(schedule => {
      const day = schedule.day || '미지정';
      if (!schedulesByDay[day]) {
        schedulesByDay[day] = [];
      }
      schedulesByDay[day].push(schedule);
    });
    
    const scheduleHtml = Object.entries(schedulesByDay).map(([day, items]) => {
      const itemsHtml = items.map(schedule => {
        // task와 title 둘 다 지원 (AI 응답 호환)
        const displayTitle = schedule.title || schedule.task || i18n.t('prompts.titleNone');
        const rawDuration = typeof schedule.duration === 'number' ? schedule.duration : parseInt(schedule.duration) || null;
        const displayDuration = rawDuration ? (rawDuration / 60).toFixed(1) : null;
        return `
        <div style="padding: var(--spacing-xs) 0; margin-left: var(--spacing-md);">
          <span style="color: var(--color-text-accent);">${schedule.time || ''}</span>
          <span style="margin-left: var(--spacing-sm);">${displayTitle}</span>
          ${displayDuration ? `<span style="color: var(--color-text-tertiary); font-size: var(--font-size-xs);"> (${displayDuration}${i18n.t('prompts.hours')})</span>` : ''}
        </div>
      `;
      }).join('');
      
      return `
        <div style="margin-bottom: var(--spacing-sm); padding: var(--spacing-sm) 0; border-bottom: 1px solid var(--color-border);">
          <div style="font-weight: var(--font-weight-medium); color: var(--color-text-secondary); margin-bottom: var(--spacing-xs);">${day}</div>
          ${itemsHtml}
        </div>
      `;
    }).join('');
    
    weeklyPlanDiv.innerHTML = `
      ${planData.summary ? `<div style="margin-bottom: var(--spacing-lg); padding: var(--spacing-md); background: var(--color-bg-elevated); border-radius: var(--radius-md); line-height: 1.6;">${planData.summary}</div>` : ''}
      ${schedules.length > 0 ? `<div class="schedule-list">${scheduleHtml}</div>` : ''}
    `;
  }

  renderMonthlyPlanData(planData) {
    const monthlyPlanDiv = this.shadowRoot.getElementById('monthly-plan');
    if (!monthlyPlanDiv) return;
    
    const schedules = planData.schedules || [];
    
    // Group schedules by date
    const schedulesByDate = {};
    schedules.forEach(schedule => {
      const dateKey = schedule.displayDate || schedule.date || '미지정';
      if (!schedulesByDate[dateKey]) {
        schedulesByDate[dateKey] = [];
      }
      schedulesByDate[dateKey].push(schedule);
    });
    
    const scheduleHtml = Object.entries(schedulesByDate).map(([date, items]) => {
      const itemsHtml = items.map(schedule => {
        // task와 title 둘 다 지원 (AI 응답 호환)
        const displayTitle = schedule.title || schedule.task || i18n.t('prompts.titleNone');
        const rawDuration = typeof schedule.duration === 'number' ? schedule.duration : parseInt(schedule.duration) || null;
        const displayDuration = rawDuration ? (rawDuration / 60).toFixed(1) : null;
        return `
        <div style="padding: var(--spacing-xs) 0; margin-left: var(--spacing-md);">
          <span style="color: var(--color-text-accent);">${schedule.time || ''}</span>
          <span style="margin-left: var(--spacing-sm);">${displayTitle}</span>
          ${displayDuration ? `<span style="color: var(--color-text-tertiary); font-size: var(--font-size-xs);"> (${displayDuration}${i18n.t('prompts.hours')})</span>` : ''}
        </div>
      `;
      }).join('');
      
      return `
        <div style="margin-bottom: var(--spacing-sm); padding: var(--spacing-sm) 0; border-bottom: 1px solid var(--color-border);">
          <div style="font-weight: var(--font-weight-medium); color: var(--color-text-secondary); margin-bottom: var(--spacing-xs);">${date}</div>
          ${itemsHtml}
        </div>
      `;
    }).join('');
    
    monthlyPlanDiv.innerHTML = `
      ${planData.summary ? `<div style="margin-bottom: var(--spacing-lg); padding: var(--spacing-md); background: var(--color-bg-elevated); border-radius: var(--radius-md); line-height: 1.6;">${planData.summary}</div>` : ''}
      ${schedules.length > 0 ? `<div class="schedule-list">${scheduleHtml}</div>` : ''}
    `;
  }

  renderQuarterlyPlanData(planData) {
    const quarterlyPlanDiv = this.shadowRoot.getElementById('quarterly-plan');
    if (!quarterlyPlanDiv) return;
    
    const schedules = planData.schedules || [];
    
    // Group schedules by month
    const schedulesByMonth = {};
    schedules.forEach(schedule => {
      const month = schedule.month || '미지정';
      if (!schedulesByMonth[month]) {
        schedulesByMonth[month] = [];
      }
      schedulesByMonth[month].push(schedule);
    });
    
    const scheduleHtml = Object.entries(schedulesByMonth).map(([month, items]) => {
      const itemsHtml = items.map(schedule => {
        const dateStr = schedule.displayDate || schedule.date || '';
        // task와 title 둘 다 지원 (AI 응답 호환)
        const displayTitle = schedule.title || schedule.task || i18n.t('prompts.titleNone');
        const rawDuration = typeof schedule.duration === 'number' ? schedule.duration : parseInt(schedule.duration) || null;
        const displayDuration = rawDuration ? (rawDuration / 60).toFixed(1) : null;
        return `
        <div style="padding: var(--spacing-xs) 0; margin-left: var(--spacing-md);">
          <span style="color: var(--color-text-tertiary); min-width: 40px; display: inline-block;">${dateStr}</span>
          <span style="color: var(--color-text-accent);">${schedule.time || ''}</span>
          <span style="margin-left: var(--spacing-sm);">${displayTitle}</span>
          ${displayDuration ? `<span style="color: var(--color-text-tertiary); font-size: var(--font-size-xs);"> (${displayDuration}${i18n.t('prompts.hours')})</span>` : ''}
        </div>
      `;
      }).join('');
      
      return `
        <div style="margin-bottom: var(--spacing-md); padding: var(--spacing-sm) 0; border-bottom: 1px solid var(--color-border);">
          <div style="font-weight: var(--font-weight-semibold); color: var(--color-text-accent); margin-bottom: var(--spacing-xs);">${month}</div>
          ${itemsHtml}
        </div>
      `;
    }).join('');
    
    quarterlyPlanDiv.innerHTML = `
      ${planData.summary ? `<div style="margin-bottom: var(--spacing-lg); padding: var(--spacing-md); background: var(--color-bg-elevated); border-radius: var(--radius-md); line-height: 1.6;">${planData.summary}</div>` : ''}
      ${schedules.length > 0 ? `<div class="schedule-list">${scheduleHtml}</div>` : ''}
    `;
  }

  async saveScheduleOrder() {
    const scheduleList = this.shadowRoot.getElementById('daily-schedule-list');
    if (!scheduleList) return;
    
    // Show loading spinner
    this.showScheduleLoading(true);
    
    const items = Array.from(scheduleList.querySelectorAll('.schedule-item'));
    const schedules = await this.storage.getSchedules();
    const dateKey = this.getLocalDateKey(this.currentDate);
    
    if (!schedules[dateKey]) {
      schedules[dateKey] = [];
    }
    
    // Reorder schedules based on DOM order
    const reorderedSchedules = items.map(item => {
      const id = item.dataset.id;
      return schedules[dateKey].find(s => s.id === id || s.id === String(id));
    }).filter(Boolean);
    
    // Update times based on new order (minute-based)
    const updatedSchedules = reorderedSchedules.map((schedule, index) => {
      const startHour = 9;
      const baseMinutes = startHour * 60;
      const duration = schedule.duration || 60;
      const previousEnd = index > 0 
        ? (() => {
            const prev = reorderedSchedules[index - 1];
            const [prevHour, prevMin] = prev.time.split(':').map(Number);
            return (prevHour * 60 + prevMin) + (prev.duration || 60);
          })()
        : baseMinutes;
      
      const newHour = Math.floor(previousEnd / 60);
      const newMin = previousEnd % 60;
      const newTime = `${newHour.toString().padStart(2, '0')}:${newMin.toString().padStart(2, '0')}`;
      
      return {
        ...schedule,
        time: newTime
      };
    });
    
    schedules[dateKey] = updatedSchedules;
    await this.storage.saveSchedules(schedules);
    
    // If AI is available, review and optimize the reordered schedule
    if (this.gemini) {
      try {
        const settings = await this.storage.getSettings();
        const optimizedSchedules = await this.gemini.optimizeScheduleOrder(updatedSchedules, settings);
        if (optimizedSchedules && optimizedSchedules.length > 0) {
          schedules[dateKey] = optimizedSchedules;
          await this.storage.saveSchedules(schedules);
          await this.loadData();
          this.showScheduleLoading(false);
          this.showToast(i18n.t('messages.scheduleOptimized'), 'success');
        } else {
          await this.loadData();
          this.showScheduleLoading(false);
        }
      } catch (error) {
        console.error('Schedule optimization failed:', error);
        await this.loadData();
        this.showScheduleLoading(false);
      }
    } else {
      await this.loadData();
      this.showScheduleLoading(false);
    }
  }

  showScheduleLoading(show) {
    const loadingEl = this.shadowRoot.getElementById('schedule-loading');
    const scheduleList = this.shadowRoot.getElementById('daily-schedule-list');
    
    if (loadingEl && scheduleList) {
      if (show) {
        loadingEl.style.display = 'block';
        scheduleList.style.opacity = '0.5';
      } else {
        loadingEl.style.display = 'none';
        scheduleList.style.opacity = '1';
      }
    }
  }

  showScheduleDetail(schedule) {
    const modal = this.shadowRoot.getElementById('schedule-detail-modal');
    const titleEl = this.shadowRoot.getElementById('schedule-detail-title');
    const contentEl = this.shadowRoot.getElementById('schedule-detail-content');
    
    if (!modal || !titleEl || !contentEl) return;
    
    this.currentEditingSchedule = schedule;
    titleEl.textContent = schedule.title;
    
    const [hours, minutes] = schedule.time.split(':').map(Number);
    const timeStr = minutes > 0 ? `${hours}:${minutes.toString().padStart(2, '0')}` : `${hours}:00`;
    const duration = schedule.duration || 60;
    const durationHours = (duration / 60).toFixed(1);
    const endTime = new Date(0, 0, 0, hours, minutes + duration);
    const endTimeStr = `${endTime.getHours()}:${endTime.getMinutes().toString().padStart(2, '0')}`;
    
    contentEl.innerHTML = `
      <div class="input-group">
        <label class="input-label">${i18n.t('prompts.hours')}</label>
        <div class="card" style="padding: var(--spacing-md);">
          ${timeStr} - ${endTimeStr} (${durationHours}${i18n.t('prompts.hours')})
        </div>
      </div>
      
      ${schedule.description ? `
        <div class="input-group">
          <label class="input-label">설명</label>
          <div class="card" style="padding: var(--spacing-md);">
            ${schedule.description}
          </div>
        </div>
      ` : ''}
      
      <div class="input-group">
        <label class="input-label">우선순위</label>
        <div class="card" style="padding: var(--spacing-md);">
          ${schedule.priority === 'high' ? '높음' : schedule.priority === 'low' ? '낮음' : '보통'}
        </div>
      </div>
      
      ${schedule.aiAnalysis ? `
        <div class="input-group">
          <label class="input-label">AI 분석 및 가이드라인</label>
          <div class="card" style="padding: var(--spacing-md); background: var(--color-bg-elevated);">
            ${schedule.aiAnalysis.recommendations ? `
              <div style="margin-bottom: var(--spacing-md);">
                <strong style="color: var(--color-text-accent);">💡 추천 사항:</strong>
                <div style="margin-top: var(--spacing-xs); color: var(--color-text-secondary);">
                  ${schedule.aiAnalysis.recommendations}
                </div>
              </div>
            ` : ''}
            ${schedule.aiAnalysis.reasoning ? `
              <div style="margin-bottom: var(--spacing-md);">
                <strong style="color: var(--color-text-accent);">📊 분석 근거:</strong>
                <div style="margin-top: var(--spacing-xs); color: var(--color-text-secondary);">
                  ${schedule.aiAnalysis.reasoning}
                </div>
              </div>
            ` : ''}
            ${schedule.aiAnalysis.category ? `
              <div style="margin-bottom: var(--spacing-md);">
                <strong style="color: var(--color-text-accent);">🏷️ 카테고리:</strong>
                <span style="margin-left: var(--spacing-xs); color: var(--color-text-secondary);">
                  ${schedule.aiAnalysis.category}
                </span>
              </div>
            ` : ''}
            ${schedule.aiAnalysis.energyLevel ? `
              <div>
                <strong style="color: var(--color-text-accent);">⚡ 에너지 레벨:</strong>
                <span style="margin-left: var(--spacing-xs); color: var(--color-text-secondary);">
                  ${schedule.aiAnalysis.energyLevel === 'high' ? '높음' : schedule.aiAnalysis.energyLevel === 'low' ? '낮음' : '보통'}
                </span>
              </div>
            ` : ''}
          </div>
        </div>
      ` : ''}
      
      <div style="display: flex; gap: var(--spacing-md); margin-top: var(--spacing-lg);">
        <button class="btn" id="edit-schedule-btn" style="flex: 1;">수정</button>
        <button class="btn" id="delete-schedule-btn" style="flex: 1; color: var(--color-error);">삭제</button>
      </div>
    `;
    
    // Add event listeners for edit and delete buttons
    const editBtn = contentEl.querySelector('#edit-schedule-btn');
    const deleteBtn = contentEl.querySelector('#delete-schedule-btn');
    
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        this.showEditScheduleForm(schedule);
      });
    }
    
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        this.showConfirmModal(
          i18n.t('modals.deleteSchedule'),
          i18n.t('modals.deleteConfirm'),
          () => {
            modal.classList.remove('active');
            this.deleteSchedule(schedule.id);
          }
        );
      });
    }
    
    modal.classList.add('active');
  }

  showEditScheduleForm(schedule) {
    const contentEl = this.shadowRoot.getElementById('schedule-detail-content');
    const titleEl = this.shadowRoot.getElementById('schedule-detail-title');
    
    if (!contentEl || !titleEl) return;
    
    titleEl.textContent = i18n.t('modals.editSchedule');
    
    const [hours, minutes] = schedule.time.split(':').map(Number);
    const timeValue = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    
    contentEl.innerHTML = `
      <form id="edit-schedule-form">
        <div class="input-group">
          <label class="input-label">제목</label>
          <input type="text" class="input" id="edit-title" value="${schedule.title}" required>
        </div>
        
        <div class="input-group">
          <label class="input-label">설명</label>
          <textarea class="input input-textarea" id="edit-description" style="min-height: 80px;">${schedule.description || ''}</textarea>
        </div>
        
        <div style="display: flex; gap: var(--spacing-md);">
          <div class="input-group" style="flex: 1;">
            <label class="input-label">시간</label>
            <input type="time" class="input" id="edit-time" value="${timeValue}">
          </div>
          <div class="input-group" style="flex: 1;">
            <label class="input-label">소요시간 (시간)</label>
            <input type="number" class="input" id="edit-duration" value="${((schedule.duration || 60) / 60).toFixed(1)}" min="0.5" step="0.5">
          </div>
        </div>
        
        <div class="input-group">
          <label class="input-label">우선순위</label>
          <select class="input" id="edit-priority">
            <option value="low" ${schedule.priority === 'low' ? 'selected' : ''}>낮음</option>
            <option value="medium" ${schedule.priority === 'medium' || !schedule.priority ? 'selected' : ''}>보통</option>
            <option value="high" ${schedule.priority === 'high' ? 'selected' : ''}>높음</option>
          </select>
        </div>
        
        <div style="display: flex; gap: var(--spacing-md); margin-top: var(--spacing-lg);">
          <button type="button" class="btn" id="cancel-edit-btn" style="flex: 1;">취소</button>
          <button type="submit" class="btn btn-primary" style="flex: 1;">저장</button>
        </div>
      </form>
    `;
    
    // Add event listeners
    const form = contentEl.querySelector('#edit-schedule-form');
    const cancelBtn = contentEl.querySelector('#cancel-edit-btn');
    
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.showScheduleDetail(schedule);
      });
    }
    
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveScheduleEdit(schedule.id);
      });
    }
  }

  async saveScheduleEdit(scheduleId) {
    const title = this.shadowRoot.getElementById('edit-title').value;
    const description = this.shadowRoot.getElementById('edit-description').value;
    const time = this.shadowRoot.getElementById('edit-time').value;
    const durationHours = parseFloat(this.shadowRoot.getElementById('edit-duration').value) || 1;
    const duration = Math.round(durationHours * 60); // 시간을 분으로 변환
    const priority = this.shadowRoot.getElementById('edit-priority').value;
    
    if (!title) {
      this.showToast(i18n.t('messages.titleRequired'), 'warning');
      return;
    }
    
    // Close modal first
    const modal = this.shadowRoot.getElementById('schedule-detail-modal');
    if (modal) {
      modal.classList.remove('active');
    }
    
    // Show progress overlay with blur
    this.showProgressOverlay();
    const progressPromise = this.animateProgress();
    
    const schedules = await this.storage.getSchedules();
    const dateKey = this.getLocalDateKey(this.currentDate);
    
    if (schedules[dateKey]) {
      const schedule = schedules[dateKey].find(s => s.id === scheduleId || s.id === String(scheduleId));
      if (schedule) {
        schedule.title = title;
        schedule.description = description;
        schedule.time = time;
        schedule.duration = duration;
        schedule.priority = priority;
        
        await this.storage.saveSchedules(schedules);
        
        // Regenerate plans
        if (this.gemini) {
          try {
            const settings = await this.storage.getSettings();
            await this.regeneratePlans(schedules, settings);
          } catch (error) {
            console.error('Plan regeneration failed:', error);
          }
        }
        
        // Wait for progress animation to complete
        await progressPromise;
        
        await this.loadData();
        this.hideProgressOverlay();
        this.showToast(i18n.t('messages.scheduleUpdated'), 'success');
      } else {
        this.hideProgressOverlay();
      }
    } else {
      this.hideProgressOverlay();
    }
  }
}

// Initialize UI when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.extensionUI = new ExtensionUI();
  });
} else {
  window.extensionUI = new ExtensionUI();
}

export { ExtensionUI };

