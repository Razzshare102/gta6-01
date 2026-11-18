// Save / load for Solmar City: cash, story progress and bests in localStorage.
// Written fresh for gta6-01.
const SAVE_KEY = 'solmar-city-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return {
      cash: typeof data.cash === 'number' ? data.cash : 0,
      missionIndex: typeof data.missionIndex === 'number' ? data.missionIndex : 0,
      storyDone: !!data.storyDone,
      pickups: Array.isArray(data.pickups) ? data.pickups : [],
    };
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: Math.round(state.player.cash),
      missionIndex: state.mission.index,
      storyDone: state.mission.storyDone,
      pickups: state.pickups.filter((p) => p.taken).map((p) => p.id),
    }));
  } catch {
    // Private mode: progress lasts the visit only.
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
