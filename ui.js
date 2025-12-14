/**
 * dAIly Planner - Main UI Controller
 * ES6 Class-based architecture with Shadow DOM
 */

import { StorageManager } from './storage.js';
import { GeminiAPI } from './gemini.js';

class ExtensionUI {
  constructor() {
    this.root = null;
    this.shadowRoot = null;
    this.storage = new StorageManager();
    this.gemini = null;
    this.currentView = 'daily'; // daily, weekly, monthly, yearly
    this.selectedText = null;
    this.draggedItem = null;
    this.currentDate = new Date(); // Current date for navigation
    this.currentWeekStart = null;
    this.currentMonth = null;
    this.currentYear = null;
    
    this.init();
  }

  async init() {
    console.log('Initializing ExtensionUI...');
    
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
      this.gemini = new GeminiAPI(settings.geminiApiKey, settings.geminiModel);
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
        <h1 class="header-title">dAIly Planner</h1>
        <div class="header-actions">
          <button class="btn btn-icon" id="settings-btn" title="Settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"></path>
            </svg>
          </button>
        </div>
      </div>
      
      <div class="tabs">
        <button class="tab active" data-view="daily">일간</button>
        <button class="tab" data-view="weekly">주간</button>
        <button class="tab" data-view="monthly">월간</button>
        <button class="tab" data-view="yearly">연간</button>
      </div>
      
      <div class="content" id="content-area">
        ${this.renderDailyView()}
      </div>
      
      <div class="modal-overlay" id="settings-modal">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">설정</h2>
            <button class="modal-close" id="close-settings">✕</button>
          </div>
          <div class="modal-content" id="settings-content">
            ${this.renderSettingsForm()}
          </div>
        </div>
      </div>
      
      <div class="modal-overlay" id="add-task-modal">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">할 일 추가</h2>
            <button class="modal-close" id="close-add-task">✕</button>
          </div>
          <div class="modal-content" id="add-task-content">
            ${this.renderAddTaskForm()}
          </div>
        </div>
      </div>
    `;
    
    this.shadowRoot.appendChild(container);
    this.root = container;
  }

  renderDailyView() {
    const today = new Date();
    const dateStr = today.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    
    return `
      <div class="card">
        <div class="card-header">
          <div style="display: flex; align-items: center; gap: var(--spacing-md); flex: 1;">
            <button class="btn btn-icon" id="prev-day-btn" title="이전 날">←</button>
            <div>
              <h2 class="card-title">일간 일정</h2>
              <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-top: var(--spacing-xs);" id="current-date-display">${dateStr}</div>
            </div>
            <button class="btn btn-icon" id="next-day-btn" title="다음 날">→</button>
          </div>
          <button class="btn btn-primary" id="add-schedule-btn">일정 추가</button>
        </div>
        <div id="schedule-loading" style="display: none; padding: var(--spacing-lg); text-align: center;">
          <div class="loading-spinner" style="margin: 0 auto var(--spacing-md);"></div>
          <div style="color: var(--color-text-secondary);">AI가 일정을 검토 중입니다...</div>
        </div>
        <div class="schedule-list" id="daily-schedule-list">
          <!-- Schedule items will be rendered here -->
        </div>
      </div>
      
      <div class="modal-overlay" id="schedule-detail-modal">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title" id="schedule-detail-title">일정 상세</h2>
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
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekStr = `${weekStart.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} ~ ${new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}`;
    
    return `
      <div class="card">
        <div class="card-header">
          <div style="display: flex; align-items: center; gap: var(--spacing-md); flex: 1;">
            <button class="btn btn-icon" id="prev-week-btn" title="이전 주">←</button>
            <div>
              <h2 class="card-title">주간 업무 계획</h2>
              <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-top: var(--spacing-xs);" id="current-week-display">${weekStr}</div>
            </div>
            <button class="btn btn-icon" id="next-week-btn" title="다음 주">→</button>
          </div>
          <button class="btn btn-primary" id="generate-weekly-plan">주간 계획 정리</button>
        </div>
        <div class="weekly-plan" id="weekly-plan">
          <div style="padding: var(--spacing-xl); text-align: center; color: var(--color-text-secondary);">
            주간 계획을 생성하려면 "주간 계획 생성" 버튼을 클릭하세요.
          </div>
        </div>
      </div>
    `;
  }

  renderMonthlyView() {
    const today = new Date();
    const monthStr = today.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
    
    return `
      <div class="card">
        <div class="card-header">
          <div style="display: flex; align-items: center; gap: var(--spacing-md); flex: 1;">
            <button class="btn btn-icon" id="prev-month-btn" title="이전 달">←</button>
            <div>
              <h2 class="card-title">월간 업무 계획</h2>
              <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-top: var(--spacing-xs);" id="current-month-display">${monthStr}</div>
            </div>
            <button class="btn btn-icon" id="next-month-btn" title="다음 달">→</button>
          </div>
          <button class="btn btn-primary" id="generate-monthly-plan">월간 계획 정리</button>
        </div>
        <div class="monthly-plan" id="monthly-plan">
          <div style="padding: var(--spacing-xl); text-align: center; color: var(--color-text-secondary);">
            월간 계획을 생성하려면 "월간 계획 생성" 버튼을 클릭하세요.
          </div>
        </div>
      </div>
    `;
  }

  renderYearlyView() {
    const today = new Date();
    const yearStr = today.getFullYear() + '년';
    
    return `
      <div class="card">
        <div class="card-header">
          <div style="display: flex; align-items: center; gap: var(--spacing-md); flex: 1;">
            <button class="btn btn-icon" id="prev-year-btn" title="이전 년">←</button>
            <div>
              <h2 class="card-title">연간 계획</h2>
              <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-top: var(--spacing-xs);" id="current-year-display">${yearStr}</div>
            </div>
            <button class="btn btn-icon" id="next-year-btn" title="다음 년">→</button>
          </div>
          <button class="btn btn-primary" id="generate-yearly-plan">연간 계획 정리</button>
        </div>
        <div class="yearly-plan" id="yearly-plan">
          <div style="padding: var(--spacing-xl); text-align: center; color: var(--color-text-secondary);">
            연간 계획을 생성하려면 "연간 계획 생성" 버튼을 클릭하세요.
          </div>
        </div>
      </div>
    `;
  }

  renderSettingsForm() {
    return `
      <form id="settings-form">
        <div class="input-group">
          <label class="input-label">이름</label>
          <input type="text" class="input" id="setting-name" placeholder="이름을 입력하세요">
        </div>
        
        <div class="input-group">
          <label class="input-label">생년월일</label>
          <input type="date" class="input" id="setting-birthdate">
        </div>
        
        <div class="input-group">
          <label class="input-label">성별</label>
          <select class="input" id="setting-gender">
            <option value="">선택하세요</option>
            <option value="male">남성</option>
            <option value="female">여성</option>
            <option value="other">기타</option>
          </select>
        </div>
        
        <div class="input-group">
          <label class="input-label">직업</label>
          <input type="text" class="input" id="setting-job" placeholder="직업을 입력하세요">
        </div>
        
        <div class="input-group">
          <label class="input-label">성향</label>
          <textarea class="input input-textarea" id="setting-personality" placeholder="당신의 성향, 업무 스타일 등을 입력하세요"></textarea>
        </div>
        
        <div class="input-group">
          <label class="input-label">Gemini API Key</label>
          <input type="password" class="input" id="setting-api-key" placeholder="Google Gemini API 키를 입력하세요">
          <small style="color: var(--color-text-tertiary); margin-top: var(--spacing-xs);">
            API 키는 안전하게 로컬에 저장됩니다.
          </small>
        </div>
        
        <div class="input-group">
          <label class="input-label">Gemini 모델</label>
          <select class="input" id="setting-model">
            <option value="gemini-2.5-flash">Gemini 2.5 Flash (권장 - 빠르고 스마트함)</option>
            <option value="gemini-2.5-pro">Gemini 2.5 Pro (고급 사고 모델)</option>
            <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite (매우 빠름)</option>
            <option value="gemini-3-pro-preview">Gemini 3 Pro Preview (최고 지능)</option>
            <option value="gemini-2.0-flash">Gemini 2.0 Flash (2세대 워크호스)</option>
            <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash-Lite (2세대 고속)</option>
          </select>
          <small style="color: var(--color-text-tertiary); margin-top: var(--spacing-xs);">
            사용할 Gemini 모델을 선택하세요.
          </small>
        </div>
        
        <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: var(--spacing-lg);">
          저장
        </button>
      </form>
    `;
  }

  renderAddTaskForm() {
    return `
      <form id="add-task-form">
        <div class="input-group">
          <label class="input-label">선택한 텍스트</label>
          <div class="card" style="padding: var(--spacing-md); background: var(--color-bg-elevated);">
            <div id="selected-text-preview" style="color: var(--color-text-secondary); font-style: italic;">
              ${this.selectedText || '텍스트가 선택되지 않았습니다.'}
            </div>
          </div>
        </div>
        
        <div class="input-group">
          <label class="input-label">할 일 제목</label>
          <input type="text" class="input" id="task-title" placeholder="할 일 제목을 입력하세요" required>
        </div>
        
          <div class="input-group">
            <label class="input-label">설명 및 계획 범위</label>
            <textarea class="input input-textarea" id="task-description" placeholder="예시: 약 3시간 소요 예정, 회의실 A에서 진행, 오피스에서 출발, 오후 3시경 종료 예상&#10;&#10;이 일정의 범위를 선택해주세요:&#10;- 일간: 오늘 하루만의 일정&#10;- 주간: 이번 주에 걸친 일정 (예: 월~금 프로젝트)&#10;- 월간: 이번 달에 걸친 일정 (예: 12월 15일~18일 출장)&#10;- 연간: 올해 또는 내년에 걸친 장기 일정 (예: 내년 1월~3월 로드쇼)&#10;&#10;위 정보를 바탕으로 상세하게 작성해주세요."></textarea>
          </div>
        
        <div class="input-group">
          <label class="input-label">우선순위</label>
          <select class="input" id="task-priority">
            <option value="low">낮음</option>
            <option value="medium" selected>보통</option>
            <option value="high">높음</option>
          </select>
        </div>
        
        <div class="input-group">
          <label class="input-label">예상 소요 시간</label>
          <input type="number" class="input" id="task-duration" placeholder="분 단위" min="1">
        </div>
        
        <button type="submit" class="btn btn-primary" id="submit-task-btn" style="width: 100%; margin-top: var(--spacing-lg);">
          <span id="submit-task-text">AI 분석 및 일정 추가</span>
          <span id="submit-task-spinner" class="loading-spinner" style="display: none; margin-left: var(--spacing-sm);"></span>
        </button>
      </form>
    `;
  }

  setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Use event delegation for dynamically created elements (like delete buttons)
    this.shadowRoot.addEventListener('click', (e) => {
      // Handle delete schedule button clicks
      const deleteBtn = e.target.closest('.schedule-delete-btn');
      if (deleteBtn) {
        e.preventDefault();
        e.stopPropagation();
        const id = deleteBtn.dataset.id;
        console.log('Delete button clicked, id:', id);
        if (id) {
          this.deleteSchedule(id);
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
      
      // Handle year navigation
      const prevYearBtn = e.target.closest('#prev-year-btn');
      if (prevYearBtn) {
        e.preventDefault();
        e.stopPropagation();
        this.navigateYear(-1);
        return;
      }
      
      const nextYearBtn = e.target.closest('#next-year-btn');
      if (nextYearBtn) {
        e.preventDefault();
        e.stopPropagation();
        this.navigateYear(1);
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

    // Generate plan buttons (will be set up when views are switched)
    this.setupPlanGenerationButtons();

    // Drag and drop for schedule items
    this.setupDragAndDrop();
    
    console.log('Event listeners setup complete');
  }

  setupPlanGenerationButtons() {
    // Generate weekly plan
    const generateWeeklyBtn = this.shadowRoot.getElementById('generate-weekly-plan');
    if (generateWeeklyBtn) {
      generateWeeklyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Generate weekly plan clicked');
        this.generateWeeklyPlan();
      });
    }

    // Generate monthly plan
    const generateMonthlyBtn = this.shadowRoot.getElementById('generate-monthly-plan');
    if (generateMonthlyBtn) {
      generateMonthlyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Generate monthly plan clicked');
        this.generateMonthlyPlan();
      });
    }

    // Generate yearly plan
    const generateYearlyBtn = this.shadowRoot.getElementById('generate-yearly-plan');
    if (generateYearlyBtn) {
      generateYearlyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Generate yearly plan clicked');
        this.generateYearlyPlan();
      });
    }
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
    this.currentView = view;
    
    // Update tabs
    const tabs = this.shadowRoot.querySelectorAll('.tab');
    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.view === view);
    });
    
    // Update content
    const contentArea = this.shadowRoot.getElementById('content-area');
    if (!contentArea) {
      console.error('Content area not found');
      return;
    }
    
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
      case 'yearly':
        contentArea.innerHTML = this.renderYearlyView();
        break;
    }
    
    // Wait for DOM update, then setup event listeners and load data
    setTimeout(() => {
      // Re-setup event listeners for new content
      const addScheduleBtn = this.shadowRoot.getElementById('add-schedule-btn');
      if (addScheduleBtn) {
        addScheduleBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.showAddTaskModal();
        });
      }
      
      // Setup plan generation buttons
      this.setupPlanGenerationButtons();
      
      // Load data based on view
      if (view === 'daily') {
        this.loadData();
      } else if (view === 'weekly') {
        this.loadWeeklyData();
      } else if (view === 'monthly') {
        this.loadMonthlyData();
      } else if (view === 'yearly') {
        this.loadYearlyData();
      }
    }, 50);
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
    
    await this.storage.saveSettings(settings);
    
    // Reinitialize Gemini API if key or model changed
    if (settings.geminiApiKey) {
      this.gemini = new GeminiAPI(settings.geminiApiKey, settings.geminiModel);
    }
    
    // Close modal
    this.shadowRoot.getElementById('settings-modal').classList.remove('active');
    
    // Show success message (you can add a toast notification here)
    alert('설정이 저장되었습니다.');
  }

  showAddTaskModal(selectedText = null) {
    this.selectedText = selectedText;
    const modal = this.shadowRoot.getElementById('add-task-modal');
    const preview = this.shadowRoot.getElementById('selected-text-preview');
    
    if (preview) {
      preview.textContent = selectedText || '텍스트가 선택되지 않았습니다.';
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

  navigateYear(years) {
    if (this.currentView === 'yearly') {
      const currentYear = this.currentYear || new Date();
      const newYear = new Date(currentYear.getFullYear() + years, 0, 1);
      this.currentYear = newYear;
      this.loadYearlyData();
    }
  }

  async loadWeeklyData() {
    // Load weekly plan data
    const weekStart = this.currentWeekStart || (() => {
      const today = new Date();
      const start = new Date(today);
      start.setDate(today.getDate() - today.getDay());
      return start;
    })();
    const weekKey = `${weekStart.getFullYear()}-W${this.getWeekNumber(weekStart)}`;
    
    const weeklyPlans = await chrome.storage.local.get('weeklyPlans') || {};
    const planData = weeklyPlans.weeklyPlans?.[weekKey];
    
    if (planData) {
      this.renderWeeklyPlanData(planData);
    } else {
      const weeklyPlanDiv = this.shadowRoot.getElementById('weekly-plan');
      if (weeklyPlanDiv) {
        weeklyPlanDiv.innerHTML = `
          <div style="padding: var(--spacing-xl); text-align: center; color: var(--color-text-secondary);">
            주간 계획을 생성하려면 "주간 계획 생성" 버튼을 클릭하세요.
          </div>
        `;
      }
    }
    
    // Update week display
    const weekDisplay = this.shadowRoot.getElementById('current-week-display');
    if (weekDisplay) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const weekStr = `${weekStart.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} ~ ${weekEnd.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}`;
      weekDisplay.textContent = weekStr;
    }
  }

  async loadMonthlyData() {
    // Load monthly plan data
    const today = this.currentMonth || new Date();
    const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    
    const monthlyPlans = await chrome.storage.local.get('monthlyPlans') || {};
    const planData = monthlyPlans.monthlyPlans?.[monthKey];
    
    if (planData) {
      this.renderMonthlyPlanData(planData);
    } else {
      const monthlyPlanDiv = this.shadowRoot.getElementById('monthly-plan');
      if (monthlyPlanDiv) {
        monthlyPlanDiv.innerHTML = `
          <div style="padding: var(--spacing-xl); text-align: center; color: var(--color-text-secondary);">
            월간 계획을 생성하려면 "월간 계획 생성" 버튼을 클릭하세요.
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

  async loadYearlyData() {
    // Load yearly plan data
    const today = this.currentYear || new Date();
    const yearKey = String(today.getFullYear());
    
    const yearlyPlans = await chrome.storage.local.get('yearlyPlans') || {};
    const planData = yearlyPlans.yearlyPlans?.[yearKey];
    
    if (planData) {
      this.renderYearlyPlanData(planData);
    } else {
      const yearlyPlanDiv = this.shadowRoot.getElementById('yearly-plan');
      if (yearlyPlanDiv) {
        yearlyPlanDiv.innerHTML = `
          <div style="padding: var(--spacing-xl); text-align: center; color: var(--color-text-secondary);">
            연간 계획을 생성하려면 "연간 계획 생성" 버튼을 클릭하세요.
          </div>
        `;
      }
    }
    
    // Update year display
    const yearDisplay = this.shadowRoot.getElementById('current-year-display');
    if (yearDisplay) {
      const yearStr = today.getFullYear() + '년';
      yearDisplay.textContent = yearStr;
    }
  }


  async processAddTask() {
    const title = this.shadowRoot.getElementById('task-title').value;
    const description = this.shadowRoot.getElementById('task-description').value;
    const priority = this.shadowRoot.getElementById('task-priority').value;
    const duration = parseInt(this.shadowRoot.getElementById('task-duration').value) || 60;
    
    if (!title) {
      alert('제목을 입력해주세요.');
      return;
    }
    
    // Get user settings for AI prompt
    const settings = await this.storage.getSettings();
    
    // Get existing schedules for conflict detection
    const schedules = await this.storage.getSchedules();
    const dateKey = (this.currentDate || new Date()).toISOString().split('T')[0];
    const existingSchedules = schedules[dateKey] || [];
    
    // If Gemini API is available, use it to analyze and schedule
    if (this.gemini) {
      try {
        // Show loading state
        const submitBtn = this.shadowRoot.getElementById('submit-task-btn');
        const submitText = this.shadowRoot.getElementById('submit-task-text');
        const submitSpinner = this.shadowRoot.getElementById('submit-task-spinner');
        
        if (submitBtn && submitText && submitSpinner) {
          submitText.textContent = 'AI 분석 중...';
          submitSpinner.style.display = 'inline-block';
          submitBtn.disabled = true;
        }
        
        // Step 1: Analyze schedule intent (scope and schedule type)
        const intentResponse = await this.gemini.analyzeScheduleIntent({
          title,
          description,
          priority,
          userInfo: settings
        });
        
        // Step 2: Process schedules based on intent
        let scheduleDates = [];
        
        if (intentResponse.scheduleType === 'array' && intentResponse.scheduleArray) {
          // Array format: specific dates and times
          scheduleDates = intentResponse.scheduleArray;
        } else if (intentResponse.scheduleType === 'repeat' && intentResponse.repeatPattern) {
          // Repeat pattern: generate dates based on pattern
          scheduleDates = this.generateRepeatDates(intentResponse.repeatPattern, intentResponse.scope);
        } else if (intentResponse.dates && intentResponse.dates.length > 0) {
          // Specific dates
          scheduleDates = intentResponse.dates.map(date => ({ date, time: null, duration }));
        } else {
          // Single date (daily)
          const dateKey = (this.currentDate || new Date()).toISOString().split('T')[0];
          scheduleDates = [{ date: dateKey, time: null, duration }];
        }
        
        // Step 3: Analyze task for each schedule
        const addedCount = await this.processSchedulesFromIntent({
          title,
          description,
          priority,
          duration,
          scheduleDates,
          intentResponse,
          settings,
          existingSchedules
        });
        
        // Hide loading state
        if (submitBtn && submitText && submitSpinner) {
          submitText.textContent = 'AI 분석 및 일정 추가';
          submitSpinner.style.display = 'none';
          submitBtn.disabled = false;
        }
        
        // Show success toast (simple format)
        this.showToast(`${title} 등록 성공`, 'success');
        
        // Close modal
        this.shadowRoot.getElementById('add-task-modal').classList.remove('active');
        
        // Reset form and clear selected text
        const addTaskForm = this.shadowRoot.getElementById('add-task-form');
        if (addTaskForm) {
          addTaskForm.reset();
        }
        this.selectedText = null;
        const textPreview = this.shadowRoot.getElementById('selected-text-preview');
        if (textPreview) {
          textPreview.textContent = '텍스트가 선택되지 않았습니다.';
        }
        
      } catch (error) {
        console.error('AI 분석 실패:', error);
        
        // Hide loading state
        const submitBtn = this.shadowRoot.getElementById('submit-task-btn');
        const submitText = this.shadowRoot.getElementById('submit-task-text');
        const submitSpinner = this.shadowRoot.getElementById('submit-task-spinner');
        
        if (submitBtn && submitText && submitSpinner) {
          submitText.textContent = 'AI 분석 및 일정 추가';
          submitSpinner.style.display = 'none';
          submitBtn.disabled = false;
        }
        
        this.showToast('AI 분석 중 오류가 발생했습니다. 일정은 추가되었습니다.', 'warning');
        
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
      }
    } else {
      // Add task without AI analysis
      await this.addTaskToSchedule({
        title,
        description,
        priority,
        duration
      });
      
      this.showToast('일정이 추가되었습니다.', 'success');
      
      // Close modal and reset form
      this.shadowRoot.getElementById('add-task-modal').classList.remove('active');
      const form = this.shadowRoot.getElementById('add-task-form');
      if (form) {
        form.reset();
      }
      this.selectedText = null;
    }
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
        dates.push(date.toISOString().split('T')[0]);
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
        dates.push(new Date(year, month - 1, 1).toISOString().split('T')[0]);
        // Optionally add last day too
        if (month === endMonth) {
          dates.push(new Date(year, month - 1, daysInMonth).toISOString().split('T')[0]);
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
      return [date.toISOString().split('T')[0]];
    }
    
    return null;
  }

  async addTaskToSchedule(task) {
    const dateKey = (this.currentDate || new Date()).toISOString().split('T')[0];
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
        date: currentDate.toISOString().split('T')[0],
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
      const dateKey = scheduleDate.date;
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
        }))
      });
      
      // Check for conflicts
      const conflictResult = this.checkAndResolveConflicts(aiResponse, daySchedules, scheduleDate.duration || duration);
      
      // Use time from scheduleArray if available, otherwise use AI suggestion
      const finalTime = scheduleDate.time || conflictResult.finalTime || aiResponse.suggestedTime || '09:00';
      
      await this.addTaskToScheduleForDate({
        title,
        description,
        priority,
        duration: scheduleDate.duration || duration,
        dateKey,
        aiAnalysis: {
          ...aiResponse,
          suggestedTime: finalTime,
          conflictResolved: conflictResult.resolved
        }
      });
      
      addedCount++;
    }
    
    return addedCount;
  }

  async addTaskToScheduleForDate(task, dateKey) {
    const schedules = await this.storage.getSchedules();
    
    if (!schedules[dateKey]) {
      schedules[dateKey] = [];
    }
    
    // Generate a time slot (you can improve this with AI suggestions)
    const timeSlot = this.suggestTimeSlot(task, schedules[dateKey]);
    
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
    
    if (dateKey === (this.currentDate || new Date()).toISOString().split('T')[0]) {
      await this.loadData();
    }
  }

  async syncScheduleToPlans(newSchedule, allSchedules, userInfo) {
    if (!this.gemini) return;
    
    try {
      // Get current week, month, year using local timezone
      const today = new Date(this.currentDate);
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekKey = `${weekStart.getFullYear()}-W${this.getWeekNumber(weekStart)}`;
      
      const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      const yearKey = String(today.getFullYear());
      
      // Use AI to sync to weekly/monthly/yearly plans with JSON response
      const syncResponse = await this.gemini.syncScheduleToPlans(newSchedule, allSchedules, userInfo, {
        weekKey,
        monthKey,
        yearKey
      });
      
      // Parse and store the JSON response
      if (syncResponse) {
        await this.storePlanData(syncResponse, weekKey, monthKey, yearKey);
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

  async storePlanData(planData, weekKey, monthKey, yearKey) {
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
    
    // Store yearly plan
    if (planData.yearly) {
      const yearlyPlans = await chrome.storage.local.get('yearlyPlans') || {};
      if (!yearlyPlans.yearlyPlans) {
        yearlyPlans.yearlyPlans = {};
      }
      yearlyPlans.yearlyPlans[yearKey] = planData.yearly;
      await chrome.storage.local.set(yearlyPlans);
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
    const dateKey = this.currentDate.toISOString().split('T')[0];
    const schedules = await this.storage.getSchedules();
    const todaySchedules = schedules[dateKey] || [];
    
    // Update date display
    const dateDisplay = this.shadowRoot.getElementById('current-date-display');
    if (dateDisplay) {
      const dateStr = this.currentDate.toLocaleDateString('ko-KR', { 
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
            오늘 일정이 없습니다. "일정 추가" 버튼을 클릭하여 일정을 추가하세요.
          </div>
        `;
      } else {
        scheduleList.innerHTML = todaySchedules.map(schedule => {
          const scheduleId = schedule.id || String(Date.now());
          // Format time to show hours and minutes
          const [hours, minutes] = schedule.time.split(':').map(Number);
          const timeStr = minutes > 0 ? `${hours}:${minutes.toString().padStart(2, '0')}` : `${hours}:00`;
          
          return `
          <div class="schedule-item" draggable="true" data-id="${scheduleId}" data-schedule='${JSON.stringify(schedule).replace(/'/g, "&#39;")}'>
            <div class="schedule-item-time">${timeStr}</div>
            <div class="schedule-item-content" style="cursor: pointer;">
              <strong class="schedule-item-title">${schedule.title}</strong>
            </div>
            <div class="schedule-item-actions">
              <button class="btn btn-icon schedule-delete-btn" data-id="${scheduleId}" type="button">✕</button>
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

  async deleteSchedule(id) {
    console.log('deleteSchedule called with id:', id);
    
    // Show loading spinner
    this.showScheduleLoading(true);
    
    const schedules = await this.storage.getSchedules();
    const dateKey = this.currentDate.toISOString().split('T')[0];
    
    if (schedules[dateKey]) {
      schedules[dateKey] = schedules[dateKey].filter(s => {
        const match = s.id === id || s.id === String(id);
        return !match;
      });
      
      await this.storage.saveSchedules(schedules);
      
      // If AI is available, review the updated schedule
      if (this.gemini && schedules[dateKey].length > 0) {
        try {
          const settings = await this.storage.getSettings();
          await this.gemini.reviewScheduleChanges(schedules[dateKey], settings, 'delete');
        } catch (error) {
          console.error('AI review failed:', error);
        }
      }
      
      await this.loadData();
      this.showScheduleLoading(false);
      this.showToast('일정이 삭제되었습니다.', 'success');
    } else {
      this.showScheduleLoading(false);
      console.warn('No schedules found for date');
    }
  }

  async generateWeeklyPlan() {
    if (!this.gemini) {
      this.showToast('Gemini API 키를 설정해주세요.', 'warning');
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
          <div style="color: var(--color-text-secondary);">주간 계획을 정리 중입니다...</div>
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
      this.showToast('주간 계획 정리 중 오류가 발생했습니다.', 'error');
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
      this.showToast('Gemini API 키를 설정해주세요.', 'warning');
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
          <div style="color: var(--color-text-secondary);">월간 계획을 생성 중입니다...</div>
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
      this.showToast('월간 계획 생성 중 오류가 발생했습니다.', 'error');
      if (monthlyPlanDiv) {
        monthlyPlanDiv.innerHTML = `
          <div style="padding: var(--spacing-xl); text-align: center; color: var(--color-text-secondary);">
            계획 정리에 실패했습니다. 다시 시도해주세요.
          </div>
        `;
      }
    }
  }

  async generateYearlyPlan() {
    if (!this.gemini) {
      this.showToast('Gemini API 키를 설정해주세요.', 'warning');
      return;
    }

    const schedules = await this.storage.getSchedules();
    const settings = await this.storage.getSettings();
    const yearKey = String(new Date().getFullYear());
    
    const yearlyPlanDiv = this.shadowRoot.getElementById('yearly-plan');
    if (yearlyPlanDiv) {
      yearlyPlanDiv.innerHTML = `
        <div style="padding: var(--spacing-xl); text-align: center;">
          <div class="loading-spinner" style="margin: 0 auto var(--spacing-md);"></div>
          <div style="color: var(--color-text-secondary);">연간 계획을 생성 중입니다...</div>
        </div>
      `;
    }
    
    try {
      const planData = await this.gemini.generateYearlyPlan(schedules, settings, yearKey);
      if (planData && yearlyPlanDiv) {
        await this.storePlanData({ yearly: planData }, null, null, yearKey);
        this.renderYearlyPlanData(planData);
      }
    } catch (error) {
      console.error('연간 계획 생성 실패:', error);
      this.showToast('연간 계획 생성 중 오류가 발생했습니다.', 'error');
      if (yearlyPlanDiv) {
        yearlyPlanDiv.innerHTML = `
          <div style="padding: var(--spacing-xl); text-align: center; color: var(--color-text-secondary);">
            계획 정리에 실패했습니다. 다시 시도해주세요.
          </div>
        `;
      }
    }
  }

  renderWeeklyPlanData(planData) {
    const weeklyPlanDiv = this.shadowRoot.getElementById('weekly-plan');
    if (!weeklyPlanDiv || !planData.schedules) return;
    
    // Group schedules by day to avoid duplicates
    const schedulesByDay = {};
    planData.schedules.forEach(schedule => {
      const day = schedule.day || '미지정';
      if (!schedulesByDay[day]) {
        schedulesByDay[day] = [];
      }
      schedulesByDay[day].push(schedule);
    });
    
    const scheduleHtml = Object.entries(schedulesByDay).map(([day, schedules]) => {
      const daySchedules = schedules.map(schedule => `
        <div class="schedule-item" style="margin-bottom: var(--spacing-sm); margin-left: var(--spacing-md);">
          <div class="schedule-item-content">
            <strong>${schedule.title}</strong>
            <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-top: var(--spacing-xs);">
              ${schedule.time || ''} ${schedule.time && schedule.duration ? `(${schedule.duration}분)` : schedule.duration ? `(${schedule.duration}분)` : ''} ${schedule.category ? `| ${schedule.category}` : ''}
            </div>
            ${schedule.notes ? `<div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-top: var(--spacing-xs);">${schedule.notes}</div>` : ''}
          </div>
        </div>
      `).join('');
      
      return `
        <div style="margin-bottom: var(--spacing-md);">
          <div style="font-weight: var(--font-weight-semibold); color: var(--color-text-accent); margin-bottom: var(--spacing-xs);">${day}</div>
          ${daySchedules}
        </div>
      `;
    }).join('');
    
    weeklyPlanDiv.innerHTML = `
      <div class="card" style="margin-top: var(--spacing-lg);">
        <div class="card-content">
          ${planData.summary ? `<div style="margin-bottom: var(--spacing-lg); padding: var(--spacing-md); background: var(--color-bg-elevated); border-radius: var(--radius-md);">${planData.summary}</div>` : ''}
          ${planData.evaluation ? `<div style="margin-bottom: var(--spacing-md); padding: var(--spacing-md); background: var(--color-bg-elevated); border-radius: var(--radius-md);">
            <strong>평가:</strong> 업무량: ${planData.evaluation.workload || 'N/A'}, 균형: ${planData.evaluation.balance || 'N/A'}, 효율성: ${planData.evaluation.efficiency || 'N/A'}
          </div>` : ''}
          <div class="schedule-list">
            ${scheduleHtml}
          </div>
        </div>
      </div>
    `;
  }

  renderMonthlyPlanData(planData) {
    const monthlyPlanDiv = this.shadowRoot.getElementById('monthly-plan');
    if (!monthlyPlanDiv || !planData.schedules) return;
    
    const scheduleHtml = planData.schedules.map(schedule => `
      <div class="schedule-item" style="margin-bottom: var(--spacing-sm);">
        <div class="schedule-item-time">${schedule.date}</div>
        <div class="schedule-item-content">
          <strong>${schedule.title}</strong>
          <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-top: var(--spacing-xs);">
            ${schedule.time} (${schedule.duration}분) | ${schedule.category || ''}
          </div>
          ${schedule.notes ? `<div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-top: var(--spacing-xs);">${schedule.notes}</div>` : ''}
        </div>
      </div>
    `).join('');
    
    monthlyPlanDiv.innerHTML = `
      <div class="card" style="margin-top: var(--spacing-lg);">
        <div class="card-content">
          ${planData.summary ? `<div style="margin-bottom: var(--spacing-lg); padding: var(--spacing-md); background: var(--color-bg-elevated); border-radius: var(--radius-md);">${planData.summary}</div>` : ''}
          <div class="schedule-list">
            ${scheduleHtml}
          </div>
        </div>
      </div>
    `;
  }

  renderYearlyPlanData(planData) {
    const yearlyPlanDiv = this.shadowRoot.getElementById('yearly-plan');
    if (!yearlyPlanDiv || !planData.schedules) return;
    
    // Group schedules by month to avoid duplicates
    const schedulesByMonth = {};
    planData.schedules.forEach(schedule => {
      const month = schedule.month || '미지정';
      if (!schedulesByMonth[month]) {
        schedulesByMonth[month] = [];
      }
      schedulesByMonth[month].push(schedule);
    });
    
    const scheduleHtml = Object.entries(schedulesByMonth).sort((a, b) => {
      const monthA = parseInt(a[0]) || 0;
      const monthB = parseInt(b[0]) || 0;
      return monthA - monthB;
    }).map(([month, schedules]) => {
      const monthStr = month !== '미지정' ? `${month}월` : month;
      const monthSchedules = schedules.map(schedule => {
        const dateStr = schedule.date ? `${schedule.date}일` : '';
        return `
        <div class="schedule-item" style="margin-bottom: var(--spacing-sm); margin-left: var(--spacing-md);">
          <div class="schedule-item-content">
            <strong>${schedule.title}</strong>
            <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-top: var(--spacing-xs);">
              ${dateStr} ${schedule.time || ''} ${schedule.time && schedule.duration ? `(${schedule.duration}분)` : schedule.duration ? `(${schedule.duration}분)` : ''} ${schedule.category ? `| ${schedule.category}` : ''}
            </div>
            ${schedule.notes ? `<div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-top: var(--spacing-xs);">${schedule.notes}</div>` : ''}
          </div>
        </div>
      `;
      }).join('');
      
      return `
        <div style="margin-bottom: var(--spacing-md);">
          <div style="font-weight: var(--font-weight-semibold); color: var(--color-text-accent); margin-bottom: var(--spacing-xs);">${monthStr}</div>
          ${monthSchedules}
        </div>
      `;
    }).join('');
    
    yearlyPlanDiv.innerHTML = `
      <div class="card" style="margin-top: var(--spacing-lg);">
        <div class="card-content">
          ${planData.summary ? `<div style="margin-bottom: var(--spacing-lg); padding: var(--spacing-md); background: var(--color-bg-elevated); border-radius: var(--radius-md);">${planData.summary}</div>` : ''}
          ${planData.evaluation ? `<div style="margin-bottom: var(--spacing-md); padding: var(--spacing-md); background: var(--color-bg-elevated); border-radius: var(--radius-md);">
            <strong>평가:</strong> 업무량: ${planData.evaluation.workload || 'N/A'}, 균형: ${planData.evaluation.balance || 'N/A'}, 효율성: ${planData.evaluation.efficiency || 'N/A'}, 진행도: ${planData.evaluation.progress || 'N/A'}, 성장: ${planData.evaluation.growth || 'N/A'}
          </div>` : ''}
          <div class="schedule-list">
            ${scheduleHtml}
          </div>
        </div>
      </div>
    `;
  }

  async saveScheduleOrder() {
    const scheduleList = this.shadowRoot.getElementById('daily-schedule-list');
    if (!scheduleList) return;
    
    // Show loading spinner
    this.showScheduleLoading(true);
    
    const items = Array.from(scheduleList.querySelectorAll('.schedule-item'));
    const schedules = await this.storage.getSchedules();
    const dateKey = this.currentDate.toISOString().split('T')[0];
    
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
          this.showToast('일정이 AI 검토 후 최적화되었습니다.', 'success');
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
    
    titleEl.textContent = schedule.title;
    
    const [hours, minutes] = schedule.time.split(':').map(Number);
    const timeStr = minutes > 0 ? `${hours}:${minutes.toString().padStart(2, '0')}` : `${hours}:00`;
    const duration = schedule.duration || 60;
    const endTime = new Date(0, 0, 0, hours, minutes + duration);
    const endTimeStr = `${endTime.getHours()}:${endTime.getMinutes().toString().padStart(2, '0')}`;
    
    contentEl.innerHTML = `
      <div class="input-group">
        <label class="input-label">시간</label>
        <div class="card" style="padding: var(--spacing-md);">
          ${timeStr} - ${endTimeStr} (${duration}분)
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
    `;
    
    modal.classList.add('active');
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

