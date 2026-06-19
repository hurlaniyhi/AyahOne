import React, { useEffect, useRef } from 'react';
import { ScrollView, View, Text, Pressable, useWindowDimensions, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';
import { useTheme, ACCENTS } from '@/theme/ThemeProvider';
import { useAppStore } from '@/store/appStore';
import { useStrings } from '@/i18n/strings';
import { ArabesqueMark } from '@/components/ArabesqueMark';
import { arabicFontFor } from '@/lib/quranText';
import type { AccentPalette, ThemeColors } from '@/theme/palettes';

// Real content used inside the mini reader — same Bismillah constant the
// actual reader screen renders, plus Al-Fatihah's standard Sahih translation
// and transliteration. The Bismillah carries exactly 19 Arabic letters →
// 190 hasanat at the 10×/letter rate used everywhere else in the app.
const BISMILLAH = '\u0628\u0650\u0633\u0652\u0645\u0650 \u0627\u0644\u0644\u0651\u064E\u0647\u0650 \u0627\u0644\u0631\u0651\u064E\u062D\u0652\u0645\u064E\u0670\u0646\u0650 \u0627\u0644\u0631\u0651\u064E\u062D\u0650\u064A\u0645\u0650';
const TRANSLITERATION = 'Bismillāhi r-raḥmāni r-raḥīm';
const TRANSLATION = 'In the name of Allah, the Entirely Merciful, the Especially Merciful.';
const HASANAT = 190;

// A faithful, scaled-down render of the Read screen using the live theme
// surfaces plus the candidate accent for tints. Mirrors the real reader's
// layout: Arabic lives alone in the verse card; transliteration, translation
// and the per-verse hasanat pill sit below as standalone elements.
function MiniReadScreen({ accent, colors, scale }: {
  accent: AccentPalette; colors: ThemeColors; scale: number;
}) {
  const arabicFont = arabicFontFor('uthmani');
  return (
    // Extra top padding clears the dynamic-island pill drawn by the phone
    // chassis above so the stats bar isn't tucked under the notch.
    <View style={{ flex: 1, paddingTop: 16 * scale, paddingHorizontal: 7 * scale, paddingBottom: 7 * scale, gap: 4 * scale }}>
      {/* Top stats pill — mirrors the real reader's top bar */}
      <View style={{ alignItems: 'center' }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 3 * scale,
          paddingHorizontal: 7 * scale, paddingVertical: 3 * scale,
          borderRadius: 999, backgroundColor: colors.surface,
          borderWidth: 0.5, borderColor: colors.hairline,
        }}>
          <Ionicons name="sparkles" size={6 * scale} color={colors.brass} />
          <Text style={{ fontSize: 6.5 * scale, fontWeight: '700', color: colors.text }}>10K</Text>
          <View style={{ width: 1, height: 5 * scale, backgroundColor: colors.hairline }} />
          <Ionicons name="book-outline" size={6 * scale} color={accent.primary} />
          <Text style={{ fontSize: 6.5 * scale, fontWeight: '700', color: colors.text }}>12</Text>
          <View style={{ width: 1, height: 5 * scale, backgroundColor: colors.hairline }} />
          <Ionicons name="time-outline" size={6 * scale} color={colors.tileBlue} />
          <Text style={{ fontSize: 6.5 * scale, fontWeight: '700', color: colors.text }}>05:30</Text>
        </View>
      </View>
      {/* Surah eyebrow + title */}
      <View style={{ alignItems: 'center', gap: 1 }}>
        <Text style={{ color: colors.brass, fontSize: 5.5 * scale, fontWeight: '800', letterSpacing: 1 }}>001 · THE OPENER</Text>
        <Text style={{ color: colors.text, fontSize: 10 * scale, fontWeight: '800' }}>Al-Fatihah</Text>
      </View>
      {/* Progress bar — track + accent fill + real numerals */}
      <View>
        <View style={{ height: 3 * scale, borderRadius: 2, backgroundColor: colors.surfaceMuted }}>
          <View style={{ width: '14%', height: 3 * scale, borderRadius: 2, backgroundColor: accent.primary }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
          <Text style={{ fontSize: 5.5 * scale, color: colors.textMuted }}>1/7</Text>
          <Text style={{ fontSize: 5.5 * scale, color: colors.textMuted }}>6 left</Text>
          <Text style={{ fontSize: 5.5 * scale, color: colors.textMuted }}>14%</Text>
        </View>
      </View>
      {/* Verse card on surfaceElevated — Arabic only, like the real reader */}
      <View style={{
        backgroundColor: colors.surfaceElevated,
        borderRadius: 10 * scale,
        borderWidth: 0.5, borderColor: colors.hairline,
        padding: 7 * scale, gap: 3 * scale, overflow: 'hidden',
      }}>
        <View pointerEvents="none" style={{ position: 'absolute', right: -10 * scale, top: -10 * scale, opacity: 0.12 }}>
          <ArabesqueMark size={50 * scale} color={colors.brass} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ paddingHorizontal: 5 * scale, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.surfaceMuted }}>
            <Text style={{ fontSize: 6 * scale, fontWeight: '800', color: colors.brass, letterSpacing: 0.6 }}>AYAH 1/7</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 4 * scale }}>
            <Ionicons name="heart-outline" size={8 * scale} color={colors.textMuted} />
            <Ionicons name="bookmark-outline" size={8 * scale} color={colors.textMuted} />
          </View>
        </View>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{
            color: colors.text, fontSize: 11 * scale, lineHeight: 16 * scale,
            textAlign: 'center', writingDirection: 'rtl',
            fontFamily: arabicFont, marginTop: 2,
          }}
        >
          {BISMILLAH}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 * scale, marginTop: 1 }}>
          <View style={{ flex: 1, height: 0.5, backgroundColor: colors.hairline }} />
          <View style={{ width: 10 * scale, height: 10 * scale, borderRadius: 999, borderWidth: 1, borderColor: colors.brass, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 5 * scale, color: colors.brass, fontWeight: '800' }}>١</Text>
          </View>
          <View style={{ flex: 1, height: 0.5, backgroundColor: colors.hairline }} />
        </View>
      </View>
      {/* Transliteration — standalone italic muted text, outside the verse card */}
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{ color: colors.textMuted, fontStyle: 'italic', fontSize: 6.5 * scale, lineHeight: 9 * scale }}
      >
        {TRANSLITERATION}
      </Text>
      {/* Translation — standalone text, outside the verse card */}
      <Text numberOfLines={2} style={{ color: colors.text, fontSize: 6.5 * scale, lineHeight: 9 * scale, fontWeight: '500' }}>
        {TRANSLATION}
      </Text>
      {/* Per-verse hasanat pill — right-aligned, accent-tinted, brass sparkles */}
      <View style={{
        alignSelf: 'flex-end',
        flexDirection: 'row', alignItems: 'center', gap: 3 * scale,
        paddingHorizontal: 6 * scale, paddingVertical: 2 * scale,
        borderRadius: 999, backgroundColor: accent.primarySoft,
      }}>
        <Ionicons name="sparkles" size={6 * scale} color={colors.brass} />
        <Text style={{ fontSize: 7 * scale, fontWeight: '800', color: colors.success }}>+{HASANAT}</Text>
      </View>
      {/* Flex spacer pushes the bottom dock to the card bottom */}
      <View style={{ flex: 1 }} />
      {/* Bottom dock — accent-tinted Next button is the most visible accent surface */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 3 * scale,
        padding: 3 * scale, borderRadius: 999,
        backgroundColor: colors.surface,
        borderWidth: 0.5, borderColor: colors.hairline,
      }}>
        <View style={{ width: 14 * scale, height: 14 * scale, borderRadius: 999, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={7 * scale} color={colors.text} />
        </View>
        <View style={{ flex: 1, height: 14 * scale, borderRadius: 999, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 6 * scale, fontWeight: '700', color: colors.text }}>I&apos;m Done</Text>
        </View>
        <View style={{ paddingHorizontal: 6 * scale, height: 14 * scale, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 2 * scale, backgroundColor: accent.primary }}>
          <Text style={{ fontSize: 6 * scale, fontWeight: '800', color: accent.onPrimary }}>Next</Text>
          <Ionicons name="arrow-forward" size={Math.max(7, 7 * scale)} color={accent.onPrimary} />
        </View>
      </View>
    </View>
  );
}

interface PreviewProps { accent: AccentPalette; active: boolean; onPress: () => void; label: string; current: string; }

function ThemePreviewCard({ accent, active, onPress, label, current }: PreviewProps) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const cardW = Math.floor((width - 16 * 2 - 12) / 2);
  const cardH = Math.round(cardW * 1.95);
  // Inner screen sits inside a chassis bezel. The mini reader scales off the
  // screen width, not the chassis width, so content stays comfortably inset.
  const bezel = 5;
  const screenW = cardW - bezel * 2;
  const scale = Math.max(0.85, Math.min(1.2, screenW / 160));
  // Animated value drives the selected-state overlay (ring + checkmark + label)
  // so picking a different theme cross-fades rather than snapping.
  const ringOpacity = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(ringOpacity, {
      toValue: active ? 1 : 0, duration: 260,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, [active, ringOpacity]);
  const checkScale = ringOpacity.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  // Phone chassis tone — slightly lifted from background in dark mode so the
  // device silhouette reads, deep slate in light mode for a real device feel.
  const chassis = t.mode === 'dark' ? '#2A2D33' : '#1B1D22';
  const notchColor = '#0A0B0E';

  return (
    <View style={{ width: cardW, gap: t.spacing(2) }}>
      <Pressable onPress={onPress} style={({ pressed }) => ({ transform: [{ scale: pressed ? t.pressedScale : 1 }] })}>
        {/* Phone chassis — rounded body that frames the live preview screen. */}
        <View style={{
          height: cardH, borderRadius: 30, padding: bezel,
          backgroundColor: chassis,
          shadowColor: active ? accent.primary : '#000',
          shadowOpacity: active ? 0.45 : (t.mode === 'dark' ? 0.45 : 0.18),
          shadowRadius: active ? 18 : 14,
          shadowOffset: { width: 0, height: 8 },
          elevation: active ? 8 : 4,
        }}>
          {/* Screen — clips the live mini reader and gives it a phone-glass
              corner radius. Background uses the theme background so the preview
              reflects how AyahOne actually looks for this accent. */}
          <View style={{
            flex: 1, borderRadius: 24, overflow: 'hidden',
            backgroundColor: t.colors.background,
          }}>
            <MiniReadScreen accent={accent} colors={t.colors} scale={scale} />
            {/* Dynamic-island-style pill at the top of the screen. Sits on top
                of the mini reader so the silhouette reads as a phone at a glance. */}
            <View pointerEvents="none" style={{
              position: 'absolute', top: 4, left: 0, right: 0, alignItems: 'center',
            }}>
              <View style={{
                width: Math.round(screenW * 0.32), height: 8, borderRadius: 4,
                backgroundColor: notchColor,
              }} />
            </View>
          </View>
          {/* Volume & power buttons — thin chassis-side rails for the
              phone-shaped illusion. Purely decorative. */}
          <View pointerEvents="none" style={{ position: 'absolute', left: -1.5, top: '22%', width: 2.5, height: 18, borderRadius: 2, backgroundColor: chassis }} />
          <View pointerEvents="none" style={{ position: 'absolute', left: -1.5, top: '34%', width: 2.5, height: 26, borderRadius: 2, backgroundColor: chassis }} />
          <View pointerEvents="none" style={{ position: 'absolute', left: -1.5, top: '46%', width: 2.5, height: 26, borderRadius: 2, backgroundColor: chassis }} />
          <View pointerEvents="none" style={{ position: 'absolute', right: -1.5, top: '30%', width: 2.5, height: 34, borderRadius: 2, backgroundColor: chassis }} />
          {/* Selection cue — checkmark badge anchored to the chassis corner. */}
          <Animated.View pointerEvents="none" style={{
            position: 'absolute', top: -6, right: -6,
            width: 28, height: 28, borderRadius: 14,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: accent.primary,
            borderWidth: 2, borderColor: t.colors.background,
            opacity: ringOpacity, transform: [{ scale: checkScale }],
            shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3,
          }}>
            <Ionicons name="checkmark" size={16} color={accent.onPrimary} />
          </Animated.View>
        </View>
      </Pressable>
      {/* Fixed-height label area keeps cards aligned regardless of which is active. */}
      <View style={{ alignItems: 'center', height: 32, gap: 2 }}>
        <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 14 }}>{label}</Text>
        <Animated.Text style={{ color: t.colors.brass, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, opacity: ringOpacity }}>
          {current}
        </Animated.Text>
      </View>
    </View>
  );
}

export default function ThemesScreen() {
  const t = useTheme();
  const s = useStrings();
  const router = useRouter();
  const accentId = useAppStore(st => st.settings.accent);
  const setSetting = useAppStore(st => st.setSetting);

  const onPick = (id: AccentPalette['id']) => {
    if (id === accentId) return;
    void Haptics.selectionAsync();
    setSetting('accent', id);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: t.spacing(4), paddingTop: t.spacing(2), paddingBottom: t.spacing(3) }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={{
            width: 40, height: 40, borderRadius: 20,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 0.75, borderColor: t.colors.hairline,
            backgroundColor: t.colors.surface,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={t.colors.text} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', color: t.colors.text, fontSize: 18, fontWeight: '800', marginRight: 40 }}>
          {s.readingThemes}
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: t.spacing(4),
          // Extra top padding so the floating checkmark badge on the top row
          // of cards (anchored at top:-6) clears the screen-title bar above.
          paddingTop: t.spacing(3),
          paddingBottom: t.spacing(8),
          gap: t.spacing(5),
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: t.spacing(5) }}>
          {ACCENTS.map(a => (
            <ThemePreviewCard
              key={a.id}
              accent={a}
              active={accentId === a.id}
              onPress={() => onPick(a.id)}
              label={a.label}
              current={s.current}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
