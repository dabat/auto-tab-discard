/* global log, storage, query */

function enable() {
  log('trash.install is called');
  storage({
    'trash.interval': 30 // in minutes
  }).then(prefs => chrome.alarms.create('trash.check', {
    when: Date.now(),
    periodInMinutes: prefs['trash.interval']
  }));
}
function disable() {
  log('trash.disable is called');
  chrome.alarms.clear('trash.check');
  chrome.storage.local.remove('trash.keys');
}

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'trash.check') {
    log('alarm fire', 'trash.check', alarm.name);

    storage({
      'trash.period': 24, // in hours
      'trash.keys': {},
      'trash.unloaded': true
    }).then(async prefs => {
      const tbs = await query({discarded: true});

      // https://github.com/rNeomy/auto-tab-discard/issues/243
      if (prefs['trash.unloaded']) {
        const ids = new Set(tbs.map(t => t.id));
        for (const tb of await query({status: 'unloaded'})) {
          if (ids.has(tb.id) === false) {
            tbs.push(tb);
          }
        }
      }

      const keys = tbs.map(t => t.url);
      const now = Date.now();
      const removed = [];

      for (const [key, value] of Object.entries(prefs['trash.keys'])) {
        // remove removed keys
        if (keys.indexOf(key) === -1) {
          delete prefs['trash.keys'][key];
        }
        // remove old tabs
        else if (now - value > prefs['trash.period'] * 60 * 60 * 1000) {
          delete prefs['trash.keys'][key];
          removed.push(key);
          for (const tb of tbs.filter(t => t.url === key)) {
            log('trash', 'removing', tb.title);
            chrome.tabs.remove(tb.id, () => chrome.runtime.lastError);
          }
        }
      }
      // add new keys
      for (const key of keys) {
        if (prefs['trash.keys'][key] === undefined && removed.indexOf(key) === -1) {
          prefs['trash.keys'][key] = now;
        }
      }

      chrome.storage.local.set(prefs);
    });
  }
});

export {
  enable,
  disable
};
