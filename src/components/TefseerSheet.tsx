import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView, ActivityIndicator, Animated, Easing, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { ArabesqueMark } from '@/components/ArabesqueMark';
import type { TefseerResult } from '@/lib/islamicAi';

interface Props {
  visible: boolean;
  surah: number;
  ayah: number;
  surahName: string;
  arabic: string;
  arabicFont: string;
  loading: boolean;
  result: TefseerResult | null;
  error: string | null;
  // When the failure is a connectivity problem, the error card uses a calm
  // "offline" treatment (brass, cloud icon, connect-then-retry copy) instead
  // of the harsh red error styling reserved for genuine failures.
  offline?: boolean;
  onRetry: () => void;
  onClose: () => void;
}

// Read-only bottom sheet presenting a single ayah's tafsir. Same fade +
// translateY entry technique as HifzNoteSheet, adapted for scrollable,
// structured content (meaning → context → reflections → sources).
export function TefseerSheet(props: Props) {
  const { visible, surahName, ayah, arabic, arabicFont, loading, result, error, offline, onRetry, onClose } = props;
  const t = useTheme();
  const s = useStrings();
  const [copied, setCopied] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    if (!visible) return;
    setCopied(false);
    fade.setValue(0);
    translateY.setValue(24);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, friction: 8, tension: 90, useNativeDriver: true }),
    ]).start();
  }, [visible, ayah, fade, translateY]);

  if (!visible) return null;

  const close = () => {
    Animated.timing(fade, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => onClose());
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await Clipboard.setStringAsync(tefseerToClipboard(result));
      void Haptics.selectionAsync();
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* ignore */ }
  };

  const label = (text: string) => (
    <Text style={{ color: t.colors.brass, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' }}>{text}</Text>
  );

  return (
    <Modal visible transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <Animated.View style={{ flex: 1, opacity: fade, backgroundColor: 'rgba(6, 47, 42, 0.5)', justifyContent: 'flex-end' }}>
        <Pressable onPress={close} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <Animated.View style={{
          transform: [{ translateY }], maxHeight: '88%', overflow: 'hidden',
          backgroundColor: t.colors.surfaceElevated,
          borderTopLeftRadius: t.radius.xl, borderTopRightRadius: t.radius.xl,
          borderWidth: 0.75, borderColor: t.colors.hairline,
        }}>
          <View pointerEvents="none" style={{ position: 'absolute', right: -30, top: -30, opacity: t.mode === 'dark' ? 0.07 : 0.05 }}>
            <ArabesqueMark size={160} color={t.colors.brass} />
          </View>

          {/* Header */}
          <View style={{ paddingHorizontal: t.spacing(5), paddingTop: t.spacing(3), gap: t.spacing(3) }}>
            <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: t.colors.hairline }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(3) }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: t.accent.primarySoft, borderWidth: 1, borderColor: t.colors.brass }}>
                <Ionicons name="book" size={18} color={t.accent.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.colors.text, fontWeight: '800', fontSize: 20 }}>{s.tefseerTitle}</Text>
                <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>{s.tefseerSubtitle}</Text>
              </View>
              <Pressable onPress={close} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                <Ionicons name="close" size={22} color={t.colors.textMuted} />
              </Pressable>
            </View>
            {/* Ayah preview card */}
            <View style={{ backgroundColor: t.colors.surfaceMuted, borderRadius: t.radius.lg, padding: t.spacing(3), gap: t.spacing(2) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(2) }}>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: t.colors.brass }} />
                <Text style={{ color: t.colors.brass, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 }}>
                  {surahName.toUpperCase()}{' \u00b7 '}{ayah}
                </Text>
              </View>
              <Text allowFontScaling={false} style={{ color: t.colors.text, fontSize: 22, lineHeight: 40, textAlign: 'right', writingDirection: 'rtl', fontFamily: arabicFont }}>
                {arabic}
              </Text>
            </View>
          </View>

          {/* Body */}
          <ScrollView contentContainerStyle={{ padding: t.spacing(5), gap: t.spacing(4) }} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={{ alignItems: 'center', gap: t.spacing(3), paddingVertical: t.spacing(8) }}>
                <ActivityIndicator color={t.accent.primary} />
                <Text style={{ color: t.colors.textMuted, fontSize: 13 }}>{s.tefseerLoading}</Text>
              </View>
            ) : error ? (
              <View style={{ alignItems: 'center', gap: t.spacing(3), paddingVertical: t.spacing(7), paddingHorizontal: t.spacing(4) }}>
                <View style={{
                  width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: offline ? t.colors.surfaceMuted : t.accent.primarySoft,
                }}>
                  <Ionicons
                    name={offline ? 'cloud-offline-outline' : 'alert-circle-outline'}
                    size={30}
                    color={offline ? t.colors.brass : t.colors.danger}
                  />
                </View>
                <Text style={{ color: t.colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center' }}>
                  {offline ? s.tefseerOfflineTitle : s.tefseerTitle}
                </Text>
                <Text style={{ color: t.colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 300 }}>
                  {offline ? s.tefseerOfflineMessage : error}
                </Text>
                <Pressable onPress={onRetry} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: t.spacing(1), paddingHorizontal: t.spacing(4), paddingVertical: t.spacing(2.5), borderRadius: t.radius.pill, backgroundColor: t.accent.primary, transform: [{ scale: pressed ? t.pressedScale : 1 }] })}>
                  <Ionicons name="refresh" size={15} color={t.accent.onPrimary} />
                  <Text style={{ color: t.accent.onPrimary, fontWeight: '700', fontSize: 13 }}>{s.tefseerRetry}</Text>
                </Pressable>
              </View>
            ) : result ? (
              <TefseerBody result={result} label={label} copied={copied} onCopy={handleCopy} arabicFont={arabicFont} />
            ) : null}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// Structured result body: meaning → context → reflections → sources, with a
// copy action + disclaimer footer. Split out so the sheet shell above stays
// focused on layout/animation.
function TefseerBody({ result, label, copied, onCopy, arabicFont }: {
  result: TefseerResult;
  label: (text: string) => React.ReactNode;
  copied: boolean;
  onCopy: () => void;
  arabicFont: string;
}) {
  const t = useTheme();
  const s = useStrings();
  const meaning = result.summary.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  return (
    <>
      <View style={{ gap: t.spacing(2) }}>
        {label(s.tefseerMeaningLabel)}
        <View style={{ gap: t.spacing(2) }}>
          {(meaning.length ? meaning : [result.summary]).map((p, i) => (
            <Text key={i} style={{ color: t.colors.text, fontSize: 15, lineHeight: 23 }}>{p}</Text>
          ))}
        </View>
      </View>

      {result.context ? (
        <View style={{ gap: t.spacing(2), paddingTop: t.spacing(3), borderTopWidth: 0.75, borderTopColor: t.colors.hairline }}>
          {label(s.tefseerContextLabel)}
          <Text style={{ color: t.colors.textMuted, fontSize: 14, lineHeight: 22 }}>{result.context}</Text>
        </View>
      ) : null}

      {result.reflections.length > 0 ? (
        <View style={{ gap: t.spacing(2), paddingTop: t.spacing(3), borderTopWidth: 0.75, borderTopColor: t.colors.hairline }}>
          {label(s.tefseerReflectionsLabel)}
          <View style={{ gap: t.spacing(2) }}>
            {result.reflections.map((r, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: t.spacing(2), alignItems: 'flex-start' }}>
                <Ionicons name="leaf-outline" size={14} color={t.colors.brass} style={{ marginTop: 3 }} />
                <Text style={{ color: t.colors.text, fontSize: 14, lineHeight: 21, flex: 1 }}>{r}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {result.references.length > 0 ? (
        <View style={{ gap: t.spacing(2), paddingTop: t.spacing(3), borderTopWidth: 0.75, borderTopColor: t.colors.hairline }}>
          {label(s.tefseerReferencesLabel)}
          <View style={{ gap: t.spacing(2) }}>
            {result.references.map((r, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: t.spacing(2), alignItems: 'flex-start' }}>
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: t.colors.brass, marginTop: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.colors.text, fontSize: 13, fontWeight: '700' }}>
                    {r.source}
                    <Text style={{ color: t.colors.textMuted, fontWeight: '500' }}>{' \u00b7 '}{r.citation}</Text>
                  </Text>
                  {r.arabic ? (
                    <Text allowFontScaling={false} style={{ color: t.colors.text, fontSize: 19, lineHeight: 34, textAlign: 'right', writingDirection: 'rtl', fontFamily: arabicFont, marginTop: 4 }}>{r.arabic}</Text>
                  ) : null}
                  {r.quote ? (
                    <Text style={{ color: t.colors.textMuted, fontSize: 12, fontStyle: 'italic', marginTop: 2, lineHeight: 17 }}>{'\u201c'}{r.quote}{'\u201d'}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(3), marginTop: t.spacing(1), paddingTop: t.spacing(3), borderTopWidth: 0.75, borderTopColor: t.colors.hairline }}>
        <Pressable onPress={onCopy} hitSlop={6} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: pressed ? 0.6 : 1 })}>
          <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color={copied ? t.accent.primary : t.colors.textMuted} />
          <Text style={{ color: copied ? t.accent.primary : t.colors.textMuted, fontSize: 12, fontWeight: '600' }}>{copied ? s.tefseerCopied : s.tefseerCopy}</Text>
        </Pressable>
      </View>

      <Text style={{ color: t.colors.textMuted, fontSize: 10, textAlign: 'center', opacity: 0.7, marginTop: t.spacing(1) }}>
        {s.tefseerDisclaimer}
      </Text>
    </>
  );
}

function tefseerToClipboard(r: TefseerResult): string {
  const lines: string[] = [r.summary.trim()];
  if (r.context) lines.push('', r.context.trim());
  if (r.reflections.length) { lines.push(''); r.reflections.forEach(x => lines.push(`\u2022 ${x}`)); }
  if (r.references.length) {
    lines.push('', 'Sources:');
    r.references.forEach(x => {
      lines.push(`\u2022 ${x.source} \u00b7 ${x.citation}`);
      if (x.arabic) lines.push(`  ${x.arabic}`);
      if (x.quote) lines.push(`  \u201c${x.quote}\u201d`);
    });
  }
  return lines.join('\n');
}
