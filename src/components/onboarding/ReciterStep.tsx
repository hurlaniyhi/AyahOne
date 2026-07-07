import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { useAppStore } from '@/store/appStore';
import { getAyahAudioUrl, RECITERS } from '@/data/quranAudio';
import { useTogglePlayback } from '@/lib/useTogglePlayback';
import { Button } from '@/components/Button';
import { InlineNotice } from '@/components/InlineNotice';
import { StepHeader, OnbFooter, type OnbNav } from './parts';

const PREVIEW_SURAH = 1;
const PREVIEW_AYAH = 1;

// Reciter chooser — same card + audition-preview pattern as the settings
// screen (app/settings/quran-display.tsx), surfaced up front so a first-time
// user picks a voice before they ever open a surah, instead of stumbling on
// the setting later.
export function ReciterStep({ nav }: { nav: OnbNav }) {
  const t = useTheme();
  const s = useStrings();
  const settings = useAppStore(st => st.settings);
  const setSetting = useAppStore(st => st.setSetting);

  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingReciterId, setLoadingReciterId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const previewPlayer = useAudioPlayer(previewUrl);
  const previewStatus = useAudioPlayerStatus(previewPlayer);
  const togglePreview = useTogglePlayback(previewPlayer, previewStatus, () => setPreviewError(true));

  useEffect(() => {
    if (previewUrl) void togglePreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl]);

  const handlePreview = async (reciterId: string) => {
    if (previewingId === reciterId && previewUrl) {
      void togglePreview();
      return;
    }
    setPreviewError(false);
    setLoadingReciterId(reciterId);
    try {
      const url = await getAyahAudioUrl(PREVIEW_SURAH, PREVIEW_AYAH, reciterId);
      setPreviewingId(reciterId);
      setPreviewUrl(url);
    } catch {
      setPreviewError(true);
    } finally {
      setLoadingReciterId(null);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: t.spacing(4), paddingTop: t.spacing(2), paddingBottom: t.spacing(3) }}>
        <StepHeader eyebrow={s.onbReciterEyebrow} title={s.onbReciterTitle} subtitle={s.onbReciterSubtitle} align="left" />

        <View style={{ gap: t.spacing(2) }}>
          {RECITERS.map(reciter => {
            const active = settings.reciterId === reciter.id;
            const isPreviewing = previewingId === reciter.id;
            const isLoading = loadingReciterId === reciter.id;
            return (
              <Pressable
                key={reciter.id}
                onPress={() => setSetting('reciterId', reciter.id)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: t.spacing(3),
                  padding: t.spacing(4), borderRadius: t.radius.lg,
                  backgroundColor: t.colors.surface,
                  borderWidth: active ? 1.5 : 0.75,
                  borderColor: active ? t.accent.primary : t.colors.hairline,
                }}
              >
                <Pressable
                  onPress={() => handlePreview(reciter.id)}
                  hitSlop={8}
                  style={({ pressed }) => ({
                    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: t.colors.surfaceMuted,
                    transform: [{ scale: pressed ? t.pressedScale : 1 }],
                  })}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={t.accent.primary} />
                  ) : (
                    <Ionicons
                      name={isPreviewing && previewStatus.playing ? 'pause' : 'play'}
                      size={16}
                      color={t.accent.primary}
                    />
                  )}
                </Pressable>

                <View style={{ flex: 1 }}>
                  <Text style={{ color: active ? t.accent.primary : t.colors.text, fontWeight: '700', fontSize: 15 }}>
                    {reciter.name}
                  </Text>
                  <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>{reciter.style}</Text>
                </View>

                {active ? (
                  <Ionicons name="checkmark-circle" size={22} color={t.accent.primary} />
                ) : (
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: t.colors.border }} />
                )}
              </Pressable>
            );
          })}
          {previewError && <InlineNotice tone="danger" icon="alert-circle-outline" text={s.audioError} />}
        </View>
      </ScrollView>

      <OnbFooter>
        <Button label={s.onbContinue} onPress={nav.next} right={<Ionicons name="arrow-forward" size={18} color={t.accent.onPrimary} />} />
      </OnbFooter>
    </View>
  );
}
