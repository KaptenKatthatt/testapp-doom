import type { PlayerState } from './types';

export function formatTime(startTime: number, endTime: number): string {
  if (!startTime) return "0:00";
  const end = endTime || performance.now() / 1000;
  const elapsed = Math.round(end - startTime);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function calcScore(state: PlayerState): number {
  const end = state.endTime || performance.now() / 1000;
  const killPoints = state.kills * 100;
  const timeBonus = Math.max(0, 3000 - Math.round((end - state.startTime) * 10));
  const accuracyBonus = state.shotsFired > 0 ? Math.round((state.kills / state.shotsFired) * 500) : 0;
  const healthBonus = state.health * 5;
  const hitPenalty = state.timesHit * 50;
  return Math.max(0, killPoints + timeBonus + accuracyBonus + healthBonus - hitPenalty);
}
