/**
 * Content Script - Detects text selection and communicates with side panel
 */

(function() {
  'use strict';

  let selectedText = '';
  let isExtensionActive = false;

  // Helper function to check if extension context is valid
  function isExtensionContextValid() {
    try {
      // If chrome.runtime.id is undefined, the extension context is invalidated
      return chrome && chrome.runtime && chrome.runtime.id !== undefined;
    } catch (e) {
      return false;
    }
  }

  // Helper function to safely send message
  function safeSendMessage(message, callback) {
    if (!isExtensionContextValid()) {
      console.warn('Extension context invalidated. Please reload the page.');
      if (callback) callback(false);
      return;
    }

    try {
      chrome.runtime.sendMessage(message, (response) => {
        // Check for runtime errors
        if (chrome.runtime.lastError) {
          console.warn('Runtime error:', chrome.runtime.lastError.message);
          if (callback) callback(false);
          return;
        }
        if (callback) callback(response);
      });
    } catch (error) {
      console.error('Error sending message:', error);
      if (callback) callback(false);
    }
  }

  // Helper function to safely use storage
  function safeStorageSet(data, callback) {
    if (!isExtensionContextValid()) {
      console.warn('Extension context invalidated. Please reload the page.');
      if (callback) callback(false);
      return;
    }

    try {
      chrome.storage.local.set(data, () => {
        // Check if context is still valid after async operation
        if (!isExtensionContextValid()) {
          if (callback) callback(false);
          return;
        }
        if (chrome.runtime.lastError) {
          console.warn('Storage error:', chrome.runtime.lastError.message);
          if (callback) callback(false);
          return;
        }
        if (callback) callback(true);
      });
    } catch (error) {
      console.error('Error setting storage:', error);
      if (callback) callback(false);
    }
  }

  // Helper function to safely get from storage
  function safeStorageGet(keys, callback) {
    if (!isExtensionContextValid()) {
      console.warn('Extension context invalidated. Please reload the page.');
      if (callback) callback(null);
      return;
    }

    try {
      chrome.storage.local.get(keys, (result) => {
        // Check if context is still valid after async operation
        if (!isExtensionContextValid()) {
          if (callback) callback(null);
          return;
        }
        if (chrome.runtime.lastError) {
          console.warn('Storage error:', chrome.runtime.lastError.message);
          if (callback) callback(null);
          return;
        }
        if (callback) callback(result);
      });
    } catch (error) {
      console.error('Error getting storage:', error);
      if (callback) callback(null);
    }
  }

  // Check if side panel is open
  // Wrap in try-catch to handle context invalidation
  try {
    if (isExtensionContextValid()) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        // Check validity inside listener as well
        if (!isExtensionContextValid()) {
          return false;
        }
        
        try {
          if (message.type === 'check-active') {
            sendResponse({ active: isExtensionActive });
          } else if (message.type === 'set-active') {
            isExtensionActive = message.active;
          }
          return true; // Keep channel open for async response
        } catch (e) {
          console.warn('Error in message listener:', e);
          return false;
        }
      });
    }
  } catch (e) {
    console.warn('Failed to register message listener:', e);
  }

  // Listen for text selection with delay to ensure selection is complete
  let selectionTimeout;
  document.addEventListener('mouseup', () => {
    clearTimeout(selectionTimeout);
    selectionTimeout = setTimeout(handleTextSelection, 100);
  });
  document.addEventListener('keyup', (e) => {
    // Only handle if Shift/Ctrl/Cmd is used for selection
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      clearTimeout(selectionTimeout);
      selectionTimeout = setTimeout(handleTextSelection, 100);
    }
  });

  function handleTextSelection() {
    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (text && text.length > 0 && text.length < 1000) { // Limit to reasonable length
      selectedText = text;
      showAddTaskButton(selection);
    } else {
      hideAddTaskButton();
    }
  }

  function showAddTaskButton(selection) {
    // Remove existing button if any
    hideAddTaskButton();

    // Check if extension context is valid before proceeding
    if (!isExtensionContextValid()) {
      console.warn('Extension context invalidated. Cannot show add task button.');
      return;
    }

    // Get selection range
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Get language from storage or detect from browser
    let buttonText = '할 일로 추가'; // Default Korean
    
    // Create floating button first
    const button = document.createElement('div');
    button.id = 'daily-planner-add-btn';
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="16"></line>
        <line x1="8" y1="12" x2="16" y2="12"></line>
      </svg>
      <span>${buttonText}</span>
    `;
    
    // Helper function to update button text
    function updateButtonText(text) {
      try {
        const span = button.querySelector('span');
        if (span && button.parentNode) {
          span.textContent = text;
        }
      } catch (e) {
        // Button may have been removed, ignore
      }
    }
    
    // Try to get language from storage safely
    safeStorageGet(['language', 'settings'], (result) => {
      if (!isExtensionContextValid()) {
        // Context invalidated, don't update
        return;
      }
      
      if (result) {
        const lang = result.settings?.language || result.language || (navigator.language.startsWith('ko') ? 'ko' : 'en');
        buttonText = lang === 'en' ? 'Add as Task' : '할 일로 추가';
        updateButtonText(buttonText);
      } else {
        // Fallback to browser language
        const lang = navigator.language.startsWith('ko') ? 'ko' : 'en';
        buttonText = lang === 'en' ? 'Add as Task' : '할 일로 추가';
        updateButtonText(buttonText);
      }
    });
    
    // Style the button
    Object.assign(button.style, {
      position: 'fixed',
      top: `${rect.top + window.scrollY - 40}px`,
      left: `${rect.left + window.scrollX + rect.width / 2}px`,
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 16px',
      backgroundColor: 'rgba(18, 18, 20, 0.95)',
      backdropFilter: 'blur(16px) saturate(180%)',
      color: '#ffffff',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
      fontSize: '13px',
      fontWeight: '500',
      cursor: 'pointer',
      zIndex: '999999',
      boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.3), 0px 0px 0px 1px rgba(255, 255, 255, 0.1), 0px 0px 15px rgba(100, 100, 255, 0.15)',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      pointerEvents: 'auto'
    });

    // Hover effect
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'translateX(-50%) translateY(-2px)';
      button.style.boxShadow = '0px 6px 16px rgba(0, 0, 0, 0.4), 0px 0px 0px 1px rgba(255, 255, 255, 0.1), 0px 0px 20px rgba(100, 100, 255, 0.25)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translateX(-50%)';
      button.style.boxShadow = '0px 4px 12px rgba(0, 0, 0, 0.3), 0px 0px 0px 1px rgba(255, 255, 255, 0.1), 0px 0px 15px rgba(100, 100, 255, 0.15)';
    });

    // Click handler
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      // Check if extension context is still valid
      if (!isExtensionContextValid()) {
        console.warn('Extension context invalidated. Please reload the page.');
        hideAddTaskButton();
        if (selection.rangeCount > 0) {
          selection.removeAllRanges();
        }
        return;
      }

      // Get current language from storage
      const getLanguage = (callback) => {
        safeStorageGet(['language', 'settings'], (result) => {
          if (result) {
            const lang = result.settings?.language || result.language || (navigator.language.startsWith('ko') ? 'ko' : 'en');
            callback(lang);
          } else {
            callback(navigator.language.startsWith('ko') ? 'ko' : 'en');
          }
        });
      };

      // Store selected text and open side panel
      getLanguage((lang) => {
        // Store selected text in storage for side panel to read
        safeStorageSet({
          selectedText: selectedText,
          selectedTextUrl: window.location.href,
          selectedTextTitle: document.title,
          language: lang
        }, (success) => {
          if (success) {
            // Send message to background script to open side panel
            safeSendMessage({
              type: 'open-side-panel-with-text',
              selectedText: selectedText,
              selectedTextUrl: window.location.href,
              selectedTextTitle: document.title,
              language: lang
            });
          } else {
            // Fallback: try sending message directly with data
            safeSendMessage({
              type: 'open-side-panel-with-text',
              selectedText: selectedText,
              selectedTextUrl: window.location.href,
              selectedTextTitle: document.title,
              language: lang
            });
          }
        });
      });

      // Hide button
      hideAddTaskButton();
      
      // Clear selection
      if (selection.rangeCount > 0) {
        selection.removeAllRanges();
      }
    });

    document.body.appendChild(button);

    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (document.getElementById('daily-planner-add-btn')) {
        hideAddTaskButton();
      }
    }, 5000);
  }

  function hideAddTaskButton() {
    const button = document.getElementById('daily-planner-add-btn');
    if (button) {
      button.remove();
    }
  }

  // Hide button when clicking elsewhere
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#daily-planner-add-btn')) {
      hideAddTaskButton();
    }
  });

  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    hideAddTaskButton();
  });
})();

