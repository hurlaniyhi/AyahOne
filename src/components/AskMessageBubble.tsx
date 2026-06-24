import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '@/theme/ThemeProvider';
import type { AskReference, AskOpinion, AskMsg } from '@/lib/islamicAi';

export type { AskMsg } from '@/lib/islamicAi';

interface Props {
  msg: AskMsg;
  // Localised section labels. Plumbed in from the parent so the bubble itself
  // stays presentation-only and doesn't reach back into i18n.
  labels: {
    references: string;
    opinions: string;
    outOfScope: string;
    copy: string;
    copied: string;
    retry: string;
  };
  // Triggered when the user taps the retry pill on an errored model bubble.
  // The parent re-issues the original prompt and replaces this message.
  onRetry?: (msg: AskMsg) => void;
}

// Render a single paragraph with inline **bold** spans. Splitting on `**`
// turns "a **b** c" into ['a ', 'b', ' c'] where odd indices are bold.
function FormattedParagraph({ text, color }: { text: string; color: string }) {
  const parts = text.split(/\*\*/);
  return (
    <Text style={{ color, fontSize: 15, lineHeight: 22 }}>
      {parts.map((p, i) => (
        i % 2 === 1
          ? <Text key={i} style={{ fontWeight: '800' }}>{p}</Text>
          : <Text key={i}>{p}</Text>
      ))}
    </Text>
  );
}

// Render answer text as a stack of paragraphs separated by blank lines. Falls
// back to the raw string when no blank-line breaks are present.
function FormattedAnswer({ text, color, gap }: { text: string; color: string; gap: number }) {
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  if (paragraphs.length <= 1) return <FormattedParagraph text={text} color={color} />;
  return (
    <View style={{ gap }}>
      {paragraphs.map((p, i) => <FormattedParagraph key={i} text={p} color={color} />)}
    </View>
  );
}

// Three-dot typing indicator while the model is generating. Staggered fade
// loop on each dot \u2014 reads as a calm "thinking" pulse rather than a spinner.
function TypingDots() {
  const t = useTheme();
  const dots = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current];
  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(d, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(d, { toValue: 0.3, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ),
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, [dots]);
  return (
    <View style={{ flexDirection: 'row', gap: 6, paddingVertical: 4, paddingHorizontal: 2 }}>
      {dots.map((d, i) => (
        <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: t.colors.textMuted, opacity: d }} />
      ))}
    </View>
  );
}

function ReferenceRow({ r }: { r: AskReference }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: t.colors.brass, marginTop: 8 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.colors.text, fontSize: 13, fontWeight: '700' }}>
          {r.source}
          <Text style={{ color: t.colors.textMuted, fontWeight: '500' }}>{' · '}{r.citation}</Text>
        </Text>
        {r.quote ? (
          <Text style={{ color: t.colors.textMuted, fontSize: 12, fontStyle: 'italic', marginTop: 2, lineHeight: 17 }}>{'\u201c'}{r.quote}{'\u201d'}</Text>
        ) : null}
      </View>
    </View>
  );
}

function OpinionRow({ o }: { o: AskOpinion }) {
  const t = useTheme();
  return (
    <View style={{ gap: 4, paddingTop: 4 }}>
      <Text style={{ color: t.colors.text, fontSize: 13, fontWeight: '700' }}>{o.holder}</Text>
      <Text style={{ color: t.colors.textMuted, fontSize: 13, lineHeight: 18 }}>{o.view}</Text>
      {o.references && o.references.length > 0 ? (
        <Text style={{ color: t.colors.textMuted, fontSize: 11, marginTop: 2 }}>
          {o.references.map(r => `${r.source} ${r.citation}`).join(' \u00b7 ')}
        </Text>
      ) : null}
    </View>
  );
}

// Build the plain-text representation of a model message for the clipboard.
// Includes the answer body plus every cited reference, so what the user
// pastes elsewhere is verifiable on its own.
function answerToClipboardText(msg: AskMsg): string {
  if (!msg.answer) return msg.error ?? '';
  const lines: string[] = [msg.answer.answer.trim()];
  if (msg.answer.references.length > 0) {
    lines.push('', 'References:');
    msg.answer.references.forEach(r => {
      const q = r.quote ? ` \u2014 \u201c${r.quote}\u201d` : '';
      lines.push(`\u2022 ${r.source} \u00b7 ${r.citation}${q}`);
    });
  }
  if (msg.answer.opinions.length > 0) {
    lines.push('', 'Scholarly opinions:');
    msg.answer.opinions.forEach(o => lines.push(`\u2022 ${o.holder}: ${o.view}`));
  }
  return lines.join('\n');
}

export function AskMessageBubble({ msg, labels, onRetry }: Props) {
  const t = useTheme();
  const [copied, setCopied] = useState(false);

  // Mount-in animation: short fade + 6px slide up. Plays once per bubble
  // (the message id is the React key, so a new bubble = a fresh anim).
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim]);
  const animStyle = {
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
  };

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(answerToClipboardText(msg));
      void Haptics.selectionAsync();
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // ignore
    }
  };

  if (msg.role === 'user') {
    return (
      <Animated.View style={[animStyle, { alignSelf: 'flex-end', maxWidth: '85%', paddingHorizontal: t.spacing(3.5), paddingVertical: t.spacing(2.5), borderRadius: t.radius.lg, borderTopRightRadius: 4, backgroundColor: t.accent.primary }]}>
        <Text style={{ color: t.accent.onPrimary, fontSize: 15, lineHeight: 21 }}>{msg.text}</Text>
      </Animated.View>
    );
  }

  // Model bubble: parchment surface with brass-accented outline, content
  // stack of answer \u2192 references \u2192 differing opinions \u2192 footer actions.
  // Renders distinct states for pending (typing dots) and error.
  const showFooter = !msg.pending && (msg.answer || msg.error);
  return (
    <Animated.View style={[animStyle, { alignSelf: 'stretch', backgroundColor: t.colors.surface, borderRadius: t.radius.lg, borderTopLeftRadius: 4, borderWidth: 0.75, borderColor: t.colors.hairline, padding: t.spacing(3.5), gap: t.spacing(2), marginRight: '8%' }]}>
      {msg.pending ? (
        <TypingDots />
      ) : msg.error ? (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
          <Ionicons name="alert-circle" size={16} color={t.colors.danger} style={{ marginTop: 1 }} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: t.colors.danger, fontSize: 14, lineHeight: 20 }}>{msg.error}</Text>
            {msg.errorDetail ? (
              <Text style={{ color: t.colors.textMuted, fontSize: 12, lineHeight: 17 }}>{msg.errorDetail}</Text>
            ) : null}
          </View>
        </View>
      ) : msg.answer ? (
        <>
          {!msg.answer.inScope ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 }}>
              <Ionicons name="alert-circle-outline" size={14} color={t.colors.brass} />
              <Text style={{ color: t.colors.brass, fontSize: 12, fontWeight: '700' }}>{labels.outOfScope}</Text>
            </View>
          ) : null}
          <FormattedAnswer text={msg.answer.answer} color={t.colors.text} gap={t.spacing(2)} />

          {msg.answer.references.length > 0 ? (
            <View style={{ marginTop: t.spacing(1), paddingTop: t.spacing(2), borderTopWidth: 0.75, borderTopColor: t.colors.hairline, gap: 6 }}>
              <Text style={{ color: t.colors.brass, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' }}>{labels.references}</Text>
              {msg.answer.references.map((r, i) => <ReferenceRow key={i} r={r} />)}
            </View>
          ) : null}

          {msg.answer.opinions.length > 0 ? (
            <View style={{ marginTop: t.spacing(1), paddingTop: t.spacing(2), borderTopWidth: 0.75, borderTopColor: t.colors.hairline, gap: 6 }}>
              <Text style={{ color: t.colors.brass, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' }}>{labels.opinions}</Text>
              {msg.answer.opinions.map((o, i) => <OpinionRow key={i} o={o} />)}
            </View>
          ) : null}
        </>
      ) : null}

      {showFooter ? (
        <View style={{ flexDirection: 'row', gap: t.spacing(2), marginTop: t.spacing(1), paddingTop: t.spacing(2), borderTopWidth: 0.75, borderTopColor: t.colors.hairline }}>
          {msg.answer ? (
            <Pressable
              onPress={handleCopy}
              hitSlop={6}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: pressed ? 0.6 : 1 })}
            >
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={13} color={copied ? t.accent.primary : t.colors.textMuted} />
              <Text style={{ color: copied ? t.accent.primary : t.colors.textMuted, fontSize: 12, fontWeight: '600' }}>
                {copied ? labels.copied : labels.copy}
              </Text>
            </Pressable>
          ) : null}
          {msg.error && onRetry ? (
            <Pressable
              onPress={() => onRetry(msg)}
              hitSlop={6}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: pressed ? 0.6 : 1 })}
            >
              <Ionicons name="refresh" size={13} color={t.accent.primary} />
              <Text style={{ color: t.accent.primary, fontSize: 12, fontWeight: '700' }}>{labels.retry}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
}
