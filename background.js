/**
 * Background Service Worker
 * Handles extension lifecycle and message routing
 */

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Listen for messages from content script and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'open-side-panel') {
    // Store selected text if provided
    if (message.selectedText) {
      chrome.storage.local.set({
        selectedText: message.selectedText,
        selectedTextUrl: message.selectedTextUrl || '',
        selectedTextTitle: message.selectedTextTitle || ''
      }).catch(err => {
        console.error('Failed to store selected text:', err);
      });
    }
    
    // Open side panel
    chrome.sidePanel.open({ windowId: sender.tab?.windowId });
    sendResponse({ success: true });
  } else if (message.type === 'open-side-panel-with-text') {
    // Store selected text in storage for side panel to read
    chrome.storage.local.set({
      selectedText: message.selectedText,
      selectedTextUrl: message.selectedTextUrl || '',
      selectedTextTitle: message.selectedTextTitle || '',
      language: message.language || 'en'
    }).then(() => {
      chrome.sidePanel.open({ windowId: sender.tab?.windowId });
      sendResponse({ success: true });
    }).catch(error => {
      console.error('Error setting storage or opening side panel:', error);
      sendResponse({ success: false, error: error.message });
    });
    
    return true; // Keep message channel open for async response
  }
  
  return true; // Keep message channel open for async response
});

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('dAIly Planner extension installed');
});

