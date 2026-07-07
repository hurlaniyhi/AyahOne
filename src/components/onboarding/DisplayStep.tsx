import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { useAppStore, type ArabicScript } from '@/store/appStore';
import { arabicFontFor, arabicLineHeight as arabicLineHeightFor } from '@/lib/quranText';
import { Button } from '@/components/Button';
import { FontSizeSlider } from '@/components/FontSizeSlider';
import { ToggleRow } from '@/components/SettingsRow';
import { Card } from '@/components/Card';
import { StepHeader, OnbFooter, type OnbNav } from './parts';

// Short Bismillah previews per edition so the script cards feel like real
// muṣḥaf snippets rather than plain labels.
const PREVIEW: Record<ArabicScript, string> = {
  uthmani: 'بِسْمِ ٱللَّهِ',
  indopak: 'بِسْمِ اللہِ',
  tajweed: 'بِسْمِ ٱللَّهِ',
};

// Personalise-the-reading step — the same script / font / verse toggles from
// the settings screen, surfaced up-front so the muṣḥaf reads the way the user
// wants from their very first ayah. All choices commit live to the store.
export function DisplayStep({ nav }: { nav: OnbNav }) {
  const t = useTheme();
  const s = useStrings();
  const settings = useAppStore(st => st.settings);
  const setSetting = useAppStore(st => st.setSetting);

  const scripts: { id: ArabicScript; label: string }[] = [
    { id: 'uthmani', label: s.scriptUthmani },
    { id: 'indopak', label: s.scriptIndopak },
    { id: 'tajweed', label: s.scriptTajweed },
  ];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: t.spacing(5), paddingTop: t.spacing(2), paddingBottom: t.spacing(3) }}>
        <StepHeader eyebrow={s.onbDisplayEyebrow} title={s.onbDisplayTitle} subtitle={s.onbDisplaySubtitle} align="left" />

        {/* Script chooser — compact cards with a live Arabic snippet. */}
        <View style={{ gap: t.spacing(2) }}>
          <Text style={{ color: t.colors.textMuted, fontSize: 13, fontWeight: '700', letterSpacing: 0.4 }}>
            {s.quranScript}
          </Text>
          <View style={{ flexDirection: 'row', gap: t.spacing(2) }}>
            {scripts.map(opt => {
              const active = settings.arabicScript === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => setSetting('arabicScript', opt.id)}
                  style={{
                    flex: 1, paddingVertical: t.spacing(3), paddingHorizontal: t.spacing(2),
                    borderRadius: t.radius.lg, alignItems: 'center', gap: t.spacing(2),
                    backgroundColor: t.colors.surface,
                    borderWidth: active ? 1.5 : 0.75,
                    borderColor: active ? t.accent.primary : t.colors.hairline,
                  }}
                >
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={{
                      color: t.colors.text, fontSize: 18,
                      lineHeight: arabicLineHeightFor(18),
                      paddingVertical: t.spacing(1),
                      writingDirection: 'rtl', fontFamily: arabicFontFor(opt.id),
                    }}
                  >
                    {PREVIEW[opt.id]}
                  </Text>
                  <Text style={{
                    color: active ? t.accent.primary : t.colors.textMuted,
                    fontSize: 12, fontWeight: '700',
                  }}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Font size */}
        <View style={{ gap: t.spacing(2) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: t.colors.textMuted, fontSize: 13, fontWeight: '700', letterSpacing: 0.4 }}>
              {s.fontSize}
            </Text>
            <View style={{
              paddingHorizontal: t.spacing(3), paddingVertical: 3, borderRadius: t.radius.pill,
              backgroundColor: t.accent.primarySoft,
            }}>
              <Text style={{ color: t.accent.primary, fontWeight: '800', fontSize: 12 }}>
                {settings.arabicFontSize}px
              </Text>
            </View>
          </View>
          <FontSizeSlider
            value={settings.arabicFontSize}
            onChange={v => setSetting('arabicFontSize', v)}
          />
        </View>

        {/* Verse extras */}
        <Card padded={false} style={{ overflow: 'hidden' }}>
          <ToggleRow
            grouped
            icon="book-outline"
            label={s.translation}
            value={settings.showTranslation}
            onChange={v => setSetting('showTranslation', v)}
          />
          <ToggleRow
            grouped
            last
            icon="text-outline"
            label={s.transliteration}
            value={settings.showTransliteration}
            onChange={v => setSetting('showTransliteration', v)}
          />
        </Card>
      </ScrollView>

      <OnbFooter>
        <Button label={s.onbContinue} onPress={nav.next} right={<Ionicons name="arrow-forward" size={18} color={t.accent.onPrimary} />} />
      </OnbFooter>
    </View>
  );
}
