import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import { useAppStore } from '@/store/appStore';
import { todayKey } from '@/lib/format';
import { getStrings } from '@/i18n/strings';

function fmt(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

// Stable identifiers so re-syncs replace (rather than duplicate) the same
// scheduled reminder. cancelScheduledNotificationAsync is safe when nothing
// is registered under the id, so we always cancel before scheduling.
const ID_DAILY_GOAL = 'ayahone-daily-goal';
const ID_FRIDAY_KAHF = 'ayahone-friday-kahf';

// Fallback trigger times used when the user has not customised their own.
// settings.goalReminderTime / kahfReminderTime override these (HH:MM 24h).
const GOAL_HOUR_DEFAULT = 20;   // 8 PM local
const KAHF_HOUR_DEFAULT = 9;    // 9 AM local
const KAHF_WEEKDAY = 5;         // Friday (JS getDay: 0=Sun … 5=Fri)
const KAHF_TOTAL_AYAH = 110;

// Parse a stored "HH:MM" string into hour/minute, falling back to the given
// defaults when the value is missing or malformed (e.g. legacy persisted
// settings predating this feature).
function parseHM(raw: string, fbHour: number, fbMin = 0): { h: number; m: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw ?? '');
  if (!m) return { h: fbHour, m: fbMin };
  const h = Math.max(0, Math.min(23, parseInt(m[1], 10)));
  const mn = Math.max(0, Math.min(59, parseInt(m[2], 10)));
  return { h, m: mn };
}

// One-time module init: how foreground notifications surface, plus the
// Android channel (mandatory for the OS to display anything on API 26+).
let handlerInstalled = false;
export async function initNotifications(): Promise<void> {
  if (!handlerInstalled) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    handlerInstalled = true;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0F6B5C',
    });
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  if (!existing.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

// Boot-time permission check. Because `notificationsEnabled` defaults to true,
// the OS prompt must appear on first launch — otherwise the toggle is "on"
// but nothing ever fires. Only prompts when status is undetermined; if the
// user denies, the in-app toggle is flipped to false so the UI reflects the
// OS truth and we don't keep pretending reminders are active.
export async function ensureBootPermission(): Promise<void> {
  const s = useAppStore.getState();
  if (!s.settings.notificationsEnabled) return;
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return;
  if (!existing.canAskAgain) {
    useAppStore.getState().setSetting('notificationsEnabled', false);
    return;
  }
  const next = await Notifications.requestPermissionsAsync();
  if (!next.granted) {
    useAppStore.getState().setSetting('notificationsEnabled', false);
  }
}

// Returns the next Date matching the given local hour:minute. If today's slot
// has already passed (or skip=true), advances by one day.
function nextDailyAt(hour: number, minute: number, skip = false): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  if (skip || d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d;
}

// Next occurrence of (weekday, hour:minute) in local time. If today is that
// weekday and the time has not yet passed (and skip=false), returns today.
function nextWeeklyAt(weekday: number, hour: number, minute: number, skip = false): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  const dow = d.getDay();
  let delta = (weekday - dow + 7) % 7;
  if (delta === 0 && (skip || d.getTime() <= Date.now())) delta = 7;
  d.setDate(d.getDate() + delta);
  return d;
}

async function safeCancel(id: string) {
  try { await Notifications.cancelScheduledNotificationAsync(id); } catch { /* noop */ }
}

// Reschedules both reminders against the current store state. Idempotent:
// callers should invoke it on app boot, on foreground, and after any state
// change that affects goal/Kahf completion (recordVerseRead, recordSurahProgress,
// setDailyGoal, toggling notificationsEnabled).
export async function syncReminders(): Promise<void> {
  const s = useAppStore.getState();
  await safeCancel(ID_DAILY_GOAL);
  await safeCancel(ID_FRIDAY_KAHF);
  if (!s.settings.notificationsEnabled) return;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;

  const t = getStrings();

  // Daily goal: skip today's slot only if user has already met today's goal.
  const todayVerses = s.stats.daily[todayKey()]?.verses ?? 0;
  const goalMet = todayVerses >= s.dailyGoalVerses;
  const remaining = Math.max(0, s.dailyGoalVerses - todayVerses);
  const goalHM = parseHM(s.settings.goalReminderTime, GOAL_HOUR_DEFAULT);
  const goalDate = nextDailyAt(goalHM.h, goalHM.m, goalMet);
  const goalBody = goalMet
    ? fmt(t.notifGoalMet, { goal: s.dailyGoalVerses })
    : remaining === s.dailyGoalVerses
      ? fmt(t.notifGoalNotStarted, { goal: s.dailyGoalVerses })
      : fmt(t.notifGoalRemaining, {
          n: remaining,
          label: remaining === 1 ? t.notifGoalVerseSingular : t.notifGoalVersePlural,
        });
  await Notifications.scheduleNotificationAsync({
    identifier: ID_DAILY_GOAL,
    content: {
      title: t.notifGoalTitle,
      body: goalBody,
      data: { url: '/(tabs)/reading' },
    },
    trigger: { type: SchedulableTriggerInputTypes.DATE, date: goalDate },
  });

  // Friday Al-Kahf: skip today only if Kahf is done for today's Friday.
  const isFridayToday = new Date().getDay() === KAHF_WEEKDAY;
  const kahfAyahToday = (s.kahfFriday?.date === todayKey() ? (s.kahfFriday?.ayah ?? 0) : 0);
  const kahfDoneToday = isFridayToday && kahfAyahToday >= KAHF_TOTAL_AYAH;
  const kahfHM = parseHM(s.settings.kahfReminderTime, KAHF_HOUR_DEFAULT);
  const kahfDate = nextWeeklyAt(KAHF_WEEKDAY, kahfHM.h, kahfHM.m, kahfDoneToday);
  const kahfBody = kahfDoneToday
    ? t.notifKahfDone
    : isFridayToday && kahfAyahToday > 0
      ? fmt(t.notifKahfInProgress, { n: kahfAyahToday, total: KAHF_TOTAL_AYAH })
      : t.notifKahfNotStarted;
  await Notifications.scheduleNotificationAsync({
    identifier: ID_FRIDAY_KAHF,
    content: {
      title: t.notifKahfTitle,
      body: kahfBody,
      data: { url: '/read/18' },
    },
    trigger: { type: SchedulableTriggerInputTypes.DATE, date: kahfDate },
  });
}

export async function cancelAllReminders(): Promise<void> {
  await safeCancel(ID_DAILY_GOAL);
  await safeCancel(ID_FRIDAY_KAHF);
}

// Subscribes to the store and re-syncs whenever a slice that affects the
// reminder bodies/timing changes. Returns an unsubscribe function. Idempotent:
// only call once at boot (the layout owns the subscription's lifetime).
export function attachReminderTriggers(): () => void {
  function signature(): string {
    const s = useAppStore.getState();
    const tk = todayKey();
    const todayVerses = s.stats.daily[tk]?.verses ?? 0;
    const kahf = s.kahfFriday?.date === tk ? (s.kahfFriday?.ayah ?? 0) : 0;
    return [
      s.settings.notificationsEnabled ? '1' : '0',
      s.settings.language,
      s.settings.goalReminderTime,
      s.settings.kahfReminderTime,
      s.dailyGoalVerses,
      todayVerses,
      kahf,
    ].join('|');
  }
  let last = signature();
  let timer: ReturnType<typeof setTimeout> | null = null;
  return useAppStore.subscribe(() => {
    const next = signature();
    if (next === last) return;
    last = next;
    if (timer) clearTimeout(timer);
    // Coalesce bursts (e.g. several recordVerseRead calls in a row) into a
    // single resync so we don't thrash the OS scheduler.
    timer = setTimeout(() => { void syncReminders(); }, 400);
  });
}
