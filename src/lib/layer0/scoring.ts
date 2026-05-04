export type Layer0Band = 'low' | 'mid' | 'adequate';
export type Layer0Composite = 'high_capacity' | 'mixed_capacity' | 'low_capacity';
export type LoadCalibration = 'standard' | 'reduced' | 'maximum_reduction';

export type Layer0Scores = {
  dsbMaxSpan: number;
  dsbTotalCorrect: number;
  dsbBand: Layer0Band;
  cptCommissionErrors: number;
  cptOmissionErrors: number;
  cptMeanRtMs: number;
  cptRtCv: number;
  cptBand: Layer0Band;
  sdstCorrect: number;
  sdstAttempted: number;
  sdstBand: Layer0Band;
  rtvBand: Layer0Band;
  layer0Composite: Layer0Composite;
  loadCalibration: LoadCalibration;
  teacherReviewFlag: boolean;
};

export function bandDsb(maxSpan: number): Layer0Band {
  if (maxSpan <= 3) return 'low';
  if (maxSpan <= 5) return 'mid';
  return 'adequate';
}

export function bandSart(commissionRate: number, omissionRate: number): Layer0Band {
  if (commissionRate > 0.15 || omissionRate > 0.10) return 'low';
  if (commissionRate >= 0.08 || omissionRate >= 0.05) return 'mid';
  return 'adequate';
}

export function bandSdst(correct: number): Layer0Band {
  if (correct < 35) return 'low';
  if (correct <= 50) return 'mid';
  return 'adequate';
}

export function bandRtCv(rtCv: number): Layer0Band {
  if (rtCv > 0.30) return 'low';
  if (rtCv >= 0.20) return 'mid';
  return 'adequate';
}

export function compositeFromBands(bands: Layer0Band[]): {
  layer0Composite: Layer0Composite;
  loadCalibration: LoadCalibration;
  teacherReviewFlag: boolean;
} {
  const lowCount = bands.filter((band) => band === 'low').length;
  if (lowCount >= 3) {
    return {
      layer0Composite: 'low_capacity',
      loadCalibration: 'maximum_reduction',
      teacherReviewFlag: true,
    };
  }
  if (lowCount === 2) {
    return {
      layer0Composite: 'mixed_capacity',
      loadCalibration: 'reduced',
      teacherReviewFlag: false,
    };
  }
  return {
    layer0Composite: 'high_capacity',
    loadCalibration: 'standard',
    teacherReviewFlag: false,
  };
}

export function mean(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function coefficientOfVariation(values: number[]) {
  if (values.length < 2) return 0;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (!avg) return 0;
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance) / avg;
}
