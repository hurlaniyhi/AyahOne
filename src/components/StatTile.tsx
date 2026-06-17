import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { Card } from './Card';

interface StatTileProps {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string; // border color
  iconBg: string;
}

export function StatTile({ label, value, icon, accent, iconBg }: StatTileProps) {
  const t = useTheme();
  return (
    <Card
      borderColor={accent}
      style={{
        alignItems: 'center', gap: t.spacing(2),
        backgroundColor: t.colors.surfaceElevated,
        shadowColor: '#000',
        shadowOpacity: t.mode === 'dark' ? 0.35 : 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }}
    >
      <View style={{
        width: 56, height: 56, borderRadius: 16,
        backgroundColor: iconBg,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: iconBg,
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
      }}>
        <Ionicons name={icon} size={28} color="#FFFFFF" />
      </View>
      <Text style={{ color: t.colors.text, fontSize: 16, fontWeight: '500' }}>{label}</Text>
      <Text style={{ color: t.colors.text, fontSize: 26, fontWeight: '700' }}>{value}</Text>
    </Card>
  );
}
