import React, { useCallback, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { ArabesqueMark } from '@/components/ArabesqueMark';
import { AskMessageBubble } from '@/components/AskMessageBubble';
import { askIslamicAi, IslamicAiError, type AskTurn, type AskMsg } from '@/lib/islamicAi';
import { useAppStore } from '@/store/appStore';

// Minimum gap between two accepted sends. Prevents accidental double-taps
// and keeps the Gemini free-tier RPM limit comfortable.
const SEND_COOLDOWN_MS = 1200;

export default function AskScreen() {
  const t = useTheme();
  const s = useStrings();
  const messages       = useAppStore(st => st.askHistory);
  const sending        = useAppStore(st => st.askSending);
  const lastSendAt     = useAppStore(st => st.askLastSendAt);
  const appendAsk      = useAppStore(st => st.appendAskMessages);
  const updateAsk      = useAppStore(st => st.updateAskMessage);
  const clearAsk       = useAppStore(st => st.clearAskHistory);
  const setAskSending  = useAppStore(st => st.setAskSending);
  const setAskLastAt   = useAppStore(st => st.setAskLastSendAt);

  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const examples = [s.askExample1, s.askExample2, s.askExample3, s.askExample4];
  const labels = {
    references: s.askReferences,
    opinions: s.askDifferingOpinions,
    outOfScope: s.askOutOfScope,
    copy: s.askCopy,
    copied: s.askCopied,
    retry: s.askRetry,
  };

  // Rebuild the API conversation history from `messages` + the new user turn.
  // Skip pending/errored model bubbles so the model never sees an incomplete
  // previous turn. Also skip the user bubble we're about to re-send when
  // `excludeId` is provided (used by the retry flow).
  const buildHistory = useCallback((newUser: string, existing: AskMsg[], excludeId?: string): AskTurn[] => {
    const turns: AskTurn[] = [];
    for (const m of existing) {
      if (m.id === excludeId) continue;
      if (m.role === 'user' && m.text) turns.push({ role: 'user', text: m.text });
      else if (m.role === 'model' && m.answer) turns.push({ role: 'model', text: m.answer.answer });
    }
    turns.push({ role: 'user', text: newUser });
    return turns;
  }, []);

  // Resolve a model message id by running the Gemini request and writing the
  // result (or error) back into the store. Shared by `send` and `retry`.
  const runQuery = useCallback(async (history: AskTurn[], modelId: string, prompt: string) => {
    setAskSending(true);
    setAskLastAt(Date.now());
    try {
      const answer = await askIslamicAi(history);
      updateAsk(modelId, { pending: false, answer, error: undefined, errorDetail: undefined, prompt });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      const code = e instanceof IslamicAiError ? e.code : 'http';
      const rawMsg = (e as Error)?.message ?? '';
      const errorText = code === 'no-key' ? s.askApiKeyMissing : s.askError;
      // Translate the internal error code into a human, localised subtitle.
      // We never surface the raw provider message (which may include HTTP
      // status text, truncated JSON snippets, or other developer noise).
      let detail: string | undefined;
      if (code === 'no-key') {
        detail = undefined;
      } else if (code === 'network') {
        detail = s.askErrorNetwork;
      } else if (code === 'blocked') {
        detail = s.askErrorBlocked;
      } else if (code === 'parse') {
        detail = /MAX_TOKENS|truncat/i.test(rawMsg) ? s.askErrorTruncated : s.askErrorParse;
      } else {
        // 'http' \u2014 server-side (5xx) and quota (429) are transient; everything
        // else (400/401/403/404) means the request itself was rejected.
        const m = rawMsg.match(/HTTP (\d+)/);
        const status = m ? parseInt(m[1], 10) : 0;
        detail = status >= 500 || status === 429 ? s.askErrorServerBusy : s.askErrorBadRequest;
      }
      if (__DEV__ && code !== 'no-key') console.warn('[askIslamicAi]', code, rawMsg);
      updateAsk(modelId, { pending: false, error: errorText, errorDetail: detail, prompt });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } finally {
      setAskSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [setAskSending, setAskLastAt, updateAsk, s]);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || sending) return;
    if (Date.now() - lastSendAt < SEND_COOLDOWN_MS) return;
    setInput('');
    void Haptics.selectionAsync();
    const stamp = Date.now();
    const uid = `u-${stamp}`;
    const mid = `m-${stamp}`;
    const history = buildHistory(text, messages);
    appendAsk([
      { id: uid, role: 'user', text },
      { id: mid, role: 'model', pending: true, prompt: text },
    ]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    await runQuery(history, mid, text);
  }, [sending, lastSendAt, buildHistory, messages, appendAsk, runQuery]);

  // Retry an errored model bubble in place: rebuild the history excluding the
  // failed bubble pair, flip the existing model message back to pending, and
  // re-issue the request.
  const retry = useCallback(async (errMsg: AskMsg) => {
    if (sending || !errMsg.prompt) return;
    if (Date.now() - lastSendAt < SEND_COOLDOWN_MS) return;
    void Haptics.selectionAsync();
    updateAsk(errMsg.id, { pending: true, error: undefined });
    const history = buildHistory(errMsg.prompt, messages, errMsg.id);
    await runQuery(history, errMsg.id, errMsg.prompt);
  }, [sending, lastSendAt, updateAsk, buildHistory, messages, runQuery]);

  const reset = () => {
    if (messages.length === 0) return;
    Alert.alert(
      s.askClearConfirmTitle,
      s.askClearConfirmBody,
      [
        { text: s.askCancel, style: 'cancel' },
        { text: s.askClearConfirmOk, style: 'destructive', onPress: () => { clearAsk(); void Haptics.selectionAsync(); } },
      ],
    );
  };
  const canSend = !!input.trim() && !sending;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top']}>
      {/* With android.softwareKeyboardLayoutMode='resize' the OS already shrinks
          the window when the keyboard appears, so KeyboardAvoidingView is a
          no-op on Android (anything else double-counts and pushes the input
          off-screen). iOS still needs explicit 'padding' since it has no
          adjustResize equivalent. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(3), paddingHorizontal: t.spacing(4), paddingTop: t.spacing(2), paddingBottom: t.spacing(3) }}>
          {/* Brass-rimmed sparkle medallion echoes the accent style used on
              the home/reader to anchor the screen identity. */}
          <View style={{
            width: 40, height: 40, borderRadius: 20,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: t.accent.primarySoft,
            borderWidth: 1, borderColor: t.colors.brass,
          }}>
            <Ionicons name="sparkles" size={18} color={t.accent.primary} />
          </View>
          <View style={{ gap: 3, flex: 1 }}>
            <Text style={{ color: t.colors.text, fontWeight: '800', fontSize: 20 }}>{s.askTitle}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.colors.brass }} />
              <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>{s.askSourcesBadge}</Text>
            </View>
          </View>
          {messages.length > 0 ? (
            <Pressable
              onPress={reset}
              hitSlop={8}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 4,
                paddingHorizontal: t.spacing(3), paddingVertical: t.spacing(2),
                borderRadius: t.radius.pill,
                borderWidth: 0.75, borderColor: t.colors.hairline,
                opacity: pressed ? 0.65 : 1,
              })}
            >
              <Ionicons name="add" size={14} color={t.colors.textMuted} />
              <Text style={{ color: t.colors.textMuted, fontWeight: '600', fontSize: 12 }}>{s.askClear}</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={{ marginHorizontal: t.spacing(4), marginBottom: t.spacing(2), padding: t.spacing(3), borderRadius: t.radius.md, backgroundColor: t.colors.surfaceMuted, borderLeftWidth: 3, borderLeftColor: t.colors.brass, flexDirection: 'row', gap: t.spacing(2), alignItems: 'flex-start' }}>
          <Ionicons name="information-circle-outline" size={16} color={t.colors.brass} style={{ marginTop: 1 }} />
          <Text style={{ color: t.colors.textMuted, fontSize: 12, flex: 1, lineHeight: 17 }}>{s.askDisclaimer}</Text>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: t.spacing(4), gap: t.spacing(3), flexGrow: 1, paddingBottom: t.spacing(6) }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            // Auto-stick to the bottom as new bubbles arrive. Cheap and
            // matches the conversational expectation; user can still
            // scroll up freely between messages.
            if (messages.length > 0) scrollRef.current?.scrollToEnd({ animated: true });
          }}
        >
          {messages.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing(4), paddingVertical: t.spacing(4) }}>
              {/* Watermark medallion + Bismillah salutation. The arabesque
                  sits behind a centered sparkle so the empty state feels
                  generous without leaning on stock illustration. */}
              <View style={{ width: 140, height: 140, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ position: 'absolute', opacity: t.mode === 'dark' ? 0.22 : 0.18 }}>
                  <ArabesqueMark size={140} color={t.colors.brass} />
                </View>
                <View style={{
                  width: 64, height: 64, borderRadius: 32,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: t.accent.primary,
                }}>
                  <Ionicons name="sparkles" size={26} color={t.accent.onPrimary} />
                </View>
              </View>
              <View style={{ gap: t.spacing(1), alignItems: 'center' }}>
                <Text style={{ color: t.colors.brass, fontSize: 18, fontWeight: '700', letterSpacing: 0.5 }}>
                  {'\u0628\u0650\u0633\u0652\u0645\u0650 \u0671\u0644\u0644\u0651\u064e\u0647\u0650'}
                </Text>
                <Text style={{ color: t.colors.textMuted, textAlign: 'center', maxWidth: 320, lineHeight: 20, fontSize: 13 }}>
                  {s.askEmptyHint}
                </Text>
              </View>
              <View style={{ gap: t.spacing(2), alignSelf: 'stretch' }}>
                {examples.map((ex, i) => (
                  <Pressable
                    key={i}
                    onPress={() => send(ex)}
                    style={({ pressed }) => ({
                      padding: t.spacing(3), borderRadius: t.radius.md,
                      backgroundColor: t.colors.surface,
                      borderWidth: 0.75, borderColor: t.colors.hairline,
                      flexDirection: 'row', alignItems: 'center', gap: t.spacing(2),
                      transform: [{ scale: pressed ? 0.985 : 1 }],
                    })}
                  >
                    <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: t.accent.primarySoft }}>
                      <Ionicons name="sparkles" size={13} color={t.accent.primary} />
                    </View>
                    <Text style={{ color: t.colors.text, fontSize: 14, flex: 1, lineHeight: 19 }}>{ex}</Text>
                    <Ionicons name="arrow-forward" size={14} color={t.colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            messages.map(m => <AskMessageBubble key={m.id} msg={m} labels={labels} onRetry={retry} />)
          )}
        </ScrollView>

        <View style={{ paddingHorizontal: t.spacing(4), paddingBottom: t.spacing(3), paddingTop: t.spacing(2), borderTopWidth: 0.75, borderTopColor: t.colors.hairline, backgroundColor: t.colors.background, gap: t.spacing(1.5) }}>
          <View style={{ flexDirection: 'row', gap: t.spacing(2), alignItems: 'flex-end' }}>
            <View style={{ flex: 1, backgroundColor: t.colors.surface, borderRadius: t.radius.lg, borderWidth: 0.75, borderColor: t.colors.hairline, paddingHorizontal: t.spacing(3), paddingVertical: Platform.OS === 'ios' ? t.spacing(2.5) : t.spacing(1.5) }}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder={s.askPlaceholder}
                placeholderTextColor={t.colors.textMuted}
                multiline
                style={{ color: t.colors.text, fontSize: 15, lineHeight: 20, maxHeight: 110 }}
                editable={!sending}
              />
            </View>
            <Pressable
              onPress={() => send(input)}
              disabled={!canSend}
              style={({ pressed }) => ({
                width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
                backgroundColor: canSend ? t.accent.primary : t.colors.border,
                transform: [{ scale: pressed && canSend ? 0.94 : 1 }],
              })}
            >
              {sending ? <ActivityIndicator size="small" color={t.accent.onPrimary} /> : <Ionicons name="arrow-up" size={20} color={t.accent.onPrimary} />}
            </Pressable>
          </View>
          <Text style={{ color: t.colors.textMuted, fontSize: 10, textAlign: 'center', opacity: 0.7 }}>
            {s.askPoweredBy}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
