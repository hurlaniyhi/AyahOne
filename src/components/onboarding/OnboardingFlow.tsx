import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { useAppStore } from '@/store/appStore';
import { ProgressBar, type OnbNav } from './parts';
import { WelcomeStep } from './WelcomeStep';
import { FeatureStep, type FeatureConfig } from './FeatureStep';
import { NameStep } from './NameStep';
import { DisplayStep } from './DisplayStep';
import { GoalStep } from './GoalStep';
import { NotificationStep } from './NotificationStep';
import { FinishStep } from './FinishStep';

// The three illustrated feature slides. Copy is stored as i18n keys and
// resolved inside FeatureStep so the whole walkthrough stays translatable.
const FEATURES: FeatureConfig[] = [
  {
    icon: 'book-outline',
    eyebrowKey: 'onbFeatReadEyebrow', titleKey: 'onbFeatReadTitle', subtitleKey: 'onbFeatReadSubtitle',
    bullets: [
      { icon: 'color-palette-outline', key: 'onbFeatReadB1' },
      { icon: 'language-outline', key: 'onbFeatReadB2' },
      { icon: 'search-outline', key: 'onbFeatReadB3' },
    ],
  },
  {
    icon: 'sparkles-outline',
    eyebrowKey: 'onbFeatRewardEyebrow', titleKey: 'onbFeatRewardTitle', subtitleKey: 'onbFeatRewardSubtitle',
    bullets: [
      { icon: 'star-outline', key: 'onbFeatRewardB1' },
      { icon: 'flame-outline', key: 'onbFeatRewardB2' },
      { icon: 'trophy-outline', key: 'onbFeatRewardB3' },
    ],
  },
  {
    icon: 'chatbubbles-outline',
    eyebrowKey: 'onbFeatAskEyebrow', titleKey: 'onbFeatAskTitle', subtitleKey: 'onbFeatAskSubtitle',
    bullets: [
      { icon: 'shield-checkmark-outline', key: 'onbFeatAskB1' },
      { icon: 'help-circle-outline', key: 'onbFeatAskB2' },
      { icon: 'moon-outline', key: 'onbFeatAskB3' },
    ],
  },
];

const TOTAL = 9; // welcome + 3 features + name + display + goal + notif + finish

// First-run walkthrough controller. Owns the step index, the sliding
// enter animation and the shared chrome (back / skip / progress); each step
// renders its own body and footer via the OnbNav it receives.
export function OnboardingFlow() {
  const t = useTheme();
  const s = useStrings();
  const completeOnboarding = useAppStore(st => st.completeOnboarding);

  const [index, setIndex] = useState(0);
  const dir = useRef(1); // 1 when advancing, -1 when going back — drives slide direction
  const enter = useRef(new Animated.Value(1)).current;
  const progress = useRef(new Animated.Value(1 / TOTAL)).current;

  // Re-run the slide/fade whenever the step changes and glide the progress bar.
  useEffect(() => {
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.timing(progress, { toValue: (index + 1) / TOTAL, duration: 320, useNativeDriver: false }).start();
  }, [index, enter, progress]);

  const finish = () => completeOnboarding();
  const nav: OnbNav = {
    index,
    total: TOTAL,
    next: () => { if (index < TOTAL - 1) { dir.current = 1; setIndex(index + 1); } else finish(); },
    back: () => { if (index > 0) { dir.current = -1; setIndex(index - 1); } },
    finish,
  };

  const renderStep = () => {
    switch (index) {
      case 0: return <WelcomeStep nav={nav} />;
      case 1: return <FeatureStep feature={FEATURES[0]} nav={nav} />;
      case 2: return <FeatureStep feature={FEATURES[1]} nav={nav} />;
      case 3: return <FeatureStep feature={FEATURES[2]} nav={nav} />;
      case 4: return <NameStep nav={nav} />;
      case 5: return <DisplayStep nav={nav} />;
      case 6: return <GoalStep nav={nav} />;
      case 7: return <NotificationStep nav={nav} />;
      default: return <FinishStep nav={nav} />;
    }
  };

  const translateX = enter.interpolate({ inputRange: [0, 1], outputRange: [dir.current * 36, 0] });
  const isLast = index === TOTAL - 1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }}>
      <View style={{ flex: 1, paddingHorizontal: t.spacing(5) }}>
        {/* Top bar — back on the left, skip on the right. */}
        <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {index > 0 ? (
            <Pressable onPress={nav.back} hitSlop={10} style={{ padding: t.spacing(1) }}>
              <Ionicons name="chevron-back" size={26} color={t.colors.textMuted} />
            </Pressable>
          ) : <View style={{ width: 26 }} />}
          {!isLast ? (
            <Pressable onPress={finish} hitSlop={10} style={{ padding: t.spacing(1) }}>
              <Text style={{ color: t.colors.textMuted, fontSize: 15, fontWeight: '700' }}>{s.onbSkip}</Text>
            </Pressable>
          ) : <View style={{ width: 26 }} />}
        </View>

        {/* Overall progress across the nine steps. */}
        <View style={{ paddingBottom: t.spacing(2) }}>
          <ProgressBar progress={progress} />
        </View>

        {/* Animated step body — keyed so mount animations and local state reset
            on each transition. */}
        <Animated.View key={index} style={{ flex: 1, opacity: enter, transform: [{ translateX }] }}>
          {renderStep()}
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
