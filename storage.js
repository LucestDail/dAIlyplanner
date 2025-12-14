/**
 * Storage Manager - Local Storage wrapper for user data
 */

export class StorageManager {
  constructor() {
    this.STORAGE_KEYS = {
      SETTINGS: 'dailyplanner_settings',
      SCHEDULES: 'dailyplanner_schedules',
      TASKS: 'dailyplanner_tasks'
    };
  }

  async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.STORAGE_KEYS.SETTINGS], (result) => {
        resolve(result[this.STORAGE_KEYS.SETTINGS] || {});
      });
    });
  }

  async saveSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.STORAGE_KEYS.SETTINGS]: settings }, () => {
        resolve();
      });
    });
  }

  async getSchedules() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.STORAGE_KEYS.SCHEDULES], (result) => {
        resolve(result[this.STORAGE_KEYS.SCHEDULES] || {});
      });
    });
  }

  async saveSchedules(schedules) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.STORAGE_KEYS.SCHEDULES]: schedules }, () => {
        resolve();
      });
    });
  }

  async getTasks() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.STORAGE_KEYS.TASKS], (result) => {
        resolve(result[this.STORAGE_KEYS.TASKS] || []);
      });
    });
  }

  async saveTasks(tasks) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.STORAGE_KEYS.TASKS]: tasks }, () => {
        resolve();
      });
    });
  }

  async clearAll() {
    return new Promise((resolve) => {
      chrome.storage.local.clear(() => {
        resolve();
      });
    });
  }
}

