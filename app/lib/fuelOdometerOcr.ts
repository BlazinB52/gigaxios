type OdometerCandidate = {
  value: number;
  score: number;
  index: number;
};

const ODOMETER_LABEL_PATTERN = /\b(?:odo|odometer|mileage)\b/i;
const DISTRACTOR_PATTERN = /\b(?:mph|speed|distance\s+to\s+empty|dte|range|empty|trip|mpg|avg|average|fuel\s+economy)\b/i;

function parseMileageNumber(value: string) {
  const normalized = value.replace(/[,\s]/g, "");
  if (!/^\d{4,7}$/.test(normalized)) return null;

  const numberValue = Number(normalized);
  if (!Number.isInteger(numberValue) || numberValue < 1000 || numberValue > 9999999) {
    return null;
  }

  return numberValue;
}

function pushCandidate(
  candidates: OdometerCandidate[],
  text: string,
  valueText: string,
  index: number,
  baseScore: number
) {
  const value = parseMileageNumber(valueText);
  if (value === null) return;

  const context = text.slice(Math.max(0, index - 35), index + valueText.length + 35);
  let score = baseScore;

  if (ODOMETER_LABEL_PATTERN.test(context)) score += 40;
  if (/\bmi(?:les)?\b/i.test(context)) score += 15;
  if (DISTRACTOR_PATTERN.test(context)) score -= 30;

  candidates.push({ value, score, index });
}

export function extractOdometerMileageFromText(text: string) {
  const normalizedText = text.replace(/\s+/g, " ").trim();
  if (!normalizedText) return null;

  const candidates: OdometerCandidate[] = [];
  const numberPattern = /\b\d{1,3}(?:[,\s]\d{3}){1,2}\b|\b\d{4,7}\b/g;

  for (const match of normalizedText.matchAll(numberPattern)) {
    pushCandidate(candidates, normalizedText, match[0], match.index ?? 0, 0);
  }

  const labelBeforePattern =
    /\b(?:odo|odometer|mileage)\b[\s:=-]*(?:total\s+)?(\d{1,3}(?:[,\s]\d{3}){1,2}|\d{4,7})\s*(?:mi|miles)?\b/gi;
  for (const match of normalizedText.matchAll(labelBeforePattern)) {
    pushCandidate(candidates, normalizedText, match[1], match.index ?? 0, 80);
  }

  const labelNearbyPattern =
    /\b(?:odo|odometer|mileage)\b.{0,24}?(\d{1,3}(?:[,\s]\d{3}){1,2}|\d{4,7})\s*(?:mi|miles)?\b/gi;
  for (const match of normalizedText.matchAll(labelNearbyPattern)) {
    pushCandidate(candidates, normalizedText, match[1], match.index ?? 0, 70);
  }

  const numberBeforeLabelPattern =
    /\b(\d{1,3}(?:[,\s]\d{3}){1,2}|\d{4,7})\s*(?:mi|miles)?\b.{0,24}?\b(?:odo|odometer|mileage)\b/gi;
  for (const match of normalizedText.matchAll(numberBeforeLabelPattern)) {
    pushCandidate(candidates, normalizedText, match[1], match.index ?? 0, 65);
  }

  if (candidates.length === 0) return null;

  const [best] = candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.index - b.index;
  });

  return best.score > 0 ? best.value : null;
}
