import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { TAJWEED_COLORS, TAJWEED_LABELS } from '@/lib/tajweed';
import type { TajweedNote } from '@/lib/recitationAi';

export function TajweedNoteRow({ note }: { note: TajweedNote }) {
  const t = useTheme();
  const s = useStrings();
  const dotColor = TAJWEED_COLORS[note.rule];
  const statusLabel = note.status === 'applied' ? s.reciteRuleApplied : note.status === 'partial' ? s.reciteRulePartial : s.reciteRuleMissed;
  const statusColor = note.status === 'applied' ? t.colors.success : note.status === 'partial' ? t.colors.brass : t.colors.danger;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing(3), paddingVertical: t.spacing(2) }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dotColor, marginTop: 5 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 14 }}>{TAJWEED_LABELS[note.rule]}</Text>
          <Text style={{ color: statusColor, fontWeight: '700', fontSize: 12 }}>{statusLabel}</Text>
        </View>
        {note.note ? (
          <Text style={{ color: t.colors.textMuted, fontSize: 13, lineHeight: 19 }}>{note.note}</Text>
        ) : null}
      </View>
    </View>
  );
}
