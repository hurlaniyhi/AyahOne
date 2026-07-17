import { useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
  useAudioRecorder, useAudioRecorderState,
  RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync,
} from 'expo-audio';

export type RecorderStage = 'idle' | 'recording' | 'recorded';

// Safety cap on a single take: keeps the base64 payload under Gemini's 20MB
// inline-request limit (a single ayah is well under a minute even slowly).
const MAX_RECORDING_SECONDS = 90;

interface Options {
  micPermissionMessage: string;
  recordingErrorMessage: string;
}

// Encapsulates the record-with-metering flow (including the Bluetooth-route
// race handling) shared with app/recite/[surah].tsx, so callers only deal with
// stage transitions and the finalized recording uri.
export function useRecitationRecorder({ micPermissionMessage, recordingErrorMessage }: Options) {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const recorderState = useAudioRecorderState(recorder, 100);

  const [stage, setStage] = useState<RecorderStage>('idle');
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Guards the auto-stop effect against the native "recording started" event
  // arriving a tick after we set stage='recording' — otherwise a momentary
  // stale isRecording===false looks like a genuine stop.
  const sawRecordingRef = useRef(false);

  useEffect(() => {
    if (recorderState.isRecording) {
      sawRecordingRef.current = true;
      return;
    }
    if (stage === 'recording' && sawRecordingRef.current) {
      sawRecordingRef.current = false;
      setStage('recorded');
    }
  }, [recorderState.isRecording, stage]);

  const startRecording = async () => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setErrorMsg(micPermissionMessage);
      return;
    }
    if (recorder.isRecording) await recorder.stop();
    setErrorMsg(null);
    sawRecordingRef.current = false;
    // iOS AVAudioSession.setActive can transiently throw while negotiating a
    // Bluetooth HFP mic route; a short retry lets that settle.
    const ATTEMPTS = 4;
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      try {
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
        await recorder.prepareToRecordAsync();
        recorder.record({ forDuration: MAX_RECORDING_SECONDS });
        setStage('recording');
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        return;
      } catch {
        if (attempt === ATTEMPTS) {
          setErrorMsg(recordingErrorMessage);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return;
        }
        await new Promise(r => setTimeout(r, 350 * attempt));
      }
    }
  };

  const stopRecording = async () => {
    await recorder.stop();
    sawRecordingRef.current = false;
    setRecordingUri(recorder.uri);
    setStage('recorded');
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const reset = () => {
    setRecordingUri(null);
    setErrorMsg(null);
    setStage('idle');
  };

  return {
    stage, setStage,
    recordingUri,
    errorMsg, setErrorMsg,
    durationMillis: recorderState.durationMillis,
    metering: recorderState.metering,
    startRecording, stopRecording, reset,
  };
}
