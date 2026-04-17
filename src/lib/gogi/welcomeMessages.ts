export function getWelcomeMessage(streakDay: number): string {
  if (streakDay === 0) return "Start your streak today. One session is all it takes.";
  if (streakDay === 1) return "Day 1. Every great streak starts exactly here.";
  if (streakDay === 7) return "Day 7. The inferencing unit is close. Let's finish it.";
  if (streakDay >= 14) return `Day ${streakDay}. You have built something real. Keep it going.`;

  const messages = [
    `Day ${streakDay}. Back again. Let's keep it moving.`,
    `Day ${streakDay}. Ready when you are.`,
    `Day ${streakDay}. One more session. That's all it takes.`,
    `Day ${streakDay}. The work is adding up. You just can't see it yet.`,
    `Day ${streakDay}. Show up. That's the whole move.`,
  ];
  return messages[streakDay % messages.length];
}
