
export enum VoiceName {
  CHARON = 'Charon',
  KORE = 'Kore',
  PUCK = 'Puck',
  FENRIR = 'Fenrir',
  ZEPHYR = 'Zephyr'
}

export interface AudioItem {
  id: string;
  text: string;
  voice: VoiceName;
  timestamp: number;
  audioUrl: string;
  duration: number;
}

export interface TTSConfig {
  voice: VoiceName;
  speed: number;
  pitch: number;
}
