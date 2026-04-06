export const KG_TO_LBS = 2.20462;
export const CM_TO_INCHES = 0.393701;

export function kgToLbs(kg: number): number {
  return Math.round(kg * KG_TO_LBS);
}

export function lbsToKg(lbs: number): number {
  return Number((lbs / KG_TO_LBS).toFixed(2));
}

export function cmToFeetAndInches(cm: number): { feet: number; inches: number } {
  const totalInches = cm * CM_TO_INCHES;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet, inches };
}

export function feetAndInchesToCm(feet: number, inches: number): number {
  const totalInches = (feet * 12) + inches;
  return Math.round(totalInches / CM_TO_INCHES);
}
