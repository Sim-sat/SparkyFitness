import { BmrAlgorithm } from '@/services/bmrService';
import { BodyFatAlgorithm } from '@/services/bodyCompositionService';
import {
  FatBreakdownAlgorithm,
  MineralCalculationAlgorithm,
  SugarCalculationAlgorithm,
  VitaminCalculationAlgorithm,
} from '@/types/nutrientAlgorithms';
import { PreferencesState } from '@/types/preferences';

export const GUEST_KEYS = {
  weightUnit: 'weightUnit',
  measurementUnit: 'measurementUnit',
  distanceUnit: 'distanceUnit',
  dateFormat: 'dateFormat',
  language: 'language',
  calorieGoalAdjustmentMode: 'calorieGoalAdjustmentMode',
  energyUnit: 'energyUnit',
  autoScaleOpenFoodFactsImports: 'autoScaleOpenFoodFactsImports',
  autoScaleOnlineImports: 'autoScaleOnlineImports',
} as const;

export const DEFAULT_PREFS: PreferencesState = {
  weightUnit: 'kg',
  measurementUnit: 'cm',
  distanceUnit: 'km',
  dateFormat: 'MM/dd/yyyy',
  autoClearHistory: 'never',
  loggingLevel: 'ERROR',
  defaultFoodDataProviderId: null,
  defaultBarcodeProviderId: null,
  barcodeFallbackOpenFoodFacts: false,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  itemDisplayLimit: 10,
  foodDisplayLimit: 10,
  calorieGoalAdjustmentMode: 'dynamic',
  exerciseCaloriePercentage: 100,
  activityLevel: 'not_much',
  tdeeAllowNegativeAdjustment: false,
  energyUnit: 'kcal',
  autoScaleOpenFoodFactsImports: false,
  autoScaleOnlineImports: true,
  waterDisplayUnit: 'ml',
  language: 'en',
  bmrAlgorithm: BmrAlgorithm.MIFFLIN_ST_JEOR,
  bodyFatAlgorithm: BodyFatAlgorithm.US_NAVY,
  includeBmrInNetCalories: false,
  fatBreakdownAlgorithm: FatBreakdownAlgorithm.AHA_GUIDELINES,
  mineralCalculationAlgorithm: MineralCalculationAlgorithm.RDA_STANDARD,
  vitaminCalculationAlgorithm: VitaminCalculationAlgorithm.RDA_STANDARD,
  sugarCalculationAlgorithm: SugarCalculationAlgorithm.WHO_GUIDELINES,
  selectedDiet: 'balanced',
  firstDayOfWeek: 0,
};
