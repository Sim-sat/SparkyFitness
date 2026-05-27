import { format, parseISO, startOfDay } from 'date-fns';
import { error, debug } from '@/utils/logging';
import type {
  ActivityLevel,
  CalorieGoalAdjustmentMode,
  DistanceUnit,
  LoggingLevel,
  WaterDisplayUnit,
} from '@/contexts/PreferencesContext';
import { DefaultPreferences, PreferencesState } from '@/types/preferences';
import { DEFAULT_PREFS, GUEST_KEYS } from '@/constants/preferences';
import { BmrAlgorithm } from '@/services/bmrService';
import { BodyFatAlgorithm } from '@/services/bodyCompositionService';
import {
  FatBreakdownAlgorithm,
  MineralCalculationAlgorithm,
  VitaminCalculationAlgorithm,
  SugarCalculationAlgorithm,
} from '@/types/nutrientAlgorithms';
import { DayOfWeek } from '@/types/settings';
// --- Constants ---
const KCAL_TO_KJ = 4.184;

// --- Primitive conversions ---
export const kgToLbs = (kg: number): number => kg * 2.20462;
export const lbsToKg = (lbs: number): number => lbs / 2.20462;
export const cmToInches = (cm: number): number => cm / 2.54;
export const inchesToCm = (inches: number): number => inches * 2.54;
export const stonesLbsToKg = (stones: number, lbs: number): number =>
  (stones * 14 + lbs) / 2.20462;
export const feetInchesToCm = (feet: number, inches: number): number =>
  (feet * 12 + inches) * 2.54;

// --- Higher-level converters ---
export type WeightUnit = 'kg' | 'lbs' | 'st_lbs';
export type MeasurementUnit = 'cm' | 'inches' | 'ft_in';
export type EnergyUnit = 'kcal' | 'kJ';

export const convertWeight = (
  value: number | string | null | undefined,
  from: WeightUnit,
  to: WeightUnit
): number => {
  const numValue =
    typeof value === 'string' ? parseFloat(value) : (value ?? NaN);
  if (isNaN(numValue) || from === to) return numValue;

  let kgValue = numValue;
  if (from === 'lbs') kgValue = lbsToKg(numValue);
  else if (from === 'st_lbs') kgValue = stonesLbsToKg(numValue, 0);

  if (to === 'lbs') return kgToLbs(kgValue);
  if (to === 'st_lbs') return kgToLbs(kgValue) / 14;
  return kgValue;
};

export const convertMeasurement = (
  value: number | string | null | undefined,
  from: MeasurementUnit,
  to: MeasurementUnit
): number => {
  const numValue =
    typeof value === 'string' ? parseFloat(value) : (value ?? NaN);
  if (isNaN(numValue) || from === to) return numValue;

  let cmValue = numValue;
  if (from === 'inches') cmValue = inchesToCm(numValue);
  else if (from === 'ft_in') cmValue = feetInchesToCm(numValue, 0);

  if (to === 'inches') return cmToInches(cmValue);
  if (to === 'ft_in') return cmToInches(cmValue) / 12;
  return cmValue;
};

export const convertDistance = (
  value: number | string | null | undefined,
  from: 'km' | 'miles',
  to: 'km' | 'miles'
): number => {
  const numValue =
    typeof value === 'string' ? parseFloat(value) : (value ?? NaN);
  if (isNaN(numValue) || from === to) return numValue;
  return from === 'km' ? numValue * 0.621371 : numValue / 0.621371;
};

export const convertEnergy = (
  value: number | string | null | undefined,
  from: EnergyUnit,
  to: EnergyUnit
): number => {
  const numValue =
    typeof value === 'string' ? parseFloat(value) : (value ?? NaN);
  if (isNaN(numValue) || from === to) return numValue;
  return from === 'kcal' ? numValue * KCAL_TO_KJ : numValue / KCAL_TO_KJ;
};

export const isLiteralDateString = (s: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) ||
  s.includes('T00:00:00') ||
  (s.endsWith('Z') && s.includes('T00:00'));

export const parseLiteralDate = (s: string): Date | null => {
  const datePart = s.split('T')[0];
  if (datePart) {
    const [year, month, day] = datePart.split('-').map(Number);
    if (year && month && day) {
      return new Date(year, month - 1, day);
    }
  }
  return null;
};

export const isLocalCalendarDate = (date: Date): boolean =>
  date.getHours() === 0 &&
  date.getMinutes() === 0 &&
  date.getSeconds() === 0 &&
  date.getMilliseconds() === 0;

export const toUserTimezone = (date: Date, timezone: string): Date => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? '0');

  const hour = get('hour');
  return new Date(
    get('year'),
    get('month') - 1,
    get('day'),
    hour === 24 ? 0 : hour,
    get('minute'),
    get('second')
  );
};

export const formatDateInUserTimezone = (
  date: string | Date,
  timezone: string,
  loggingLevel: LoggingLevel,
  formatStr?: string
): string => {
  let dateToFormat: Date;

  if (typeof date === 'string') {
    if (isLiteralDateString(date)) {
      dateToFormat = parseLiteralDate(date) ?? new Date();
    } else {
      dateToFormat = toUserTimezone(parseISO(date), timezone);
    }
  } else if (isLocalCalendarDate(date)) {
    dateToFormat = date;
  } else {
    dateToFormat = toUserTimezone(date, timezone);
  }

  if (isNaN(dateToFormat.getTime())) {
    error(
      loggingLevel,
      `dateUtils: Invalid date value provided for formatting:`,
      date
    );
    return '';
  }

  return format(dateToFormat, formatStr ?? 'yyyy-MM-dd');
};

export const formatDate = (
  date: string | Date,
  timezone: string,
  loggingLevel: LoggingLevel,
  dateFormat: string
): string => formatDateInUserTimezone(date, timezone, loggingLevel, dateFormat);

export const parseDateInUserTimezone = (
  dateString: string,
  timezone: string,
  loggingLevel: LoggingLevel
): Date => {
  debug(loggingLevel, `dateUtils: Parsing date string "${dateString}".`);

  if (isLiteralDateString(dateString)) {
    const literal = parseLiteralDate(dateString);
    if (literal) return literal;
  }

  return startOfDay(toUserTimezone(parseISO(dateString), timezone));
};

export const normalizeDateFormat = (v: string) =>
  v.replace(/DD/g, 'dd').replace(/YYYY/g, 'yyyy');
export const fromApiToState = (
  data: Partial<DefaultPreferences> | null
): PreferencesState => {
  if (!data) return DEFAULT_PREFS;
  return {
    weightUnit:
      (data.default_weight_unit as WeightUnit) ?? DEFAULT_PREFS.weightUnit,
    measurementUnit:
      (data.default_measurement_unit as MeasurementUnit) ??
      DEFAULT_PREFS.measurementUnit,
    distanceUnit:
      (data.default_distance_unit as DistanceUnit) ??
      DEFAULT_PREFS.distanceUnit,
    dateFormat: normalizeDateFormat(
      data.date_format ?? DEFAULT_PREFS.dateFormat
    ),
    autoClearHistory: data.auto_clear_history ?? DEFAULT_PREFS.autoClearHistory,
    loggingLevel:
      (data.logging_level as LoggingLevel) ?? DEFAULT_PREFS.loggingLevel,
    defaultFoodDataProviderId: data.default_food_data_provider_id ?? null,
    defaultBarcodeProviderId: data.default_barcode_provider_id ?? null,
    barcodeFallbackOpenFoodFacts:
      data.barcode_fallback_open_food_facts ??
      DEFAULT_PREFS.barcodeFallbackOpenFoodFacts,
    timezone: data.timezone ?? DEFAULT_PREFS.timezone,
    itemDisplayLimit: data.item_display_limit ?? DEFAULT_PREFS.itemDisplayLimit,
    foodDisplayLimit: data.food_display_limit ?? DEFAULT_PREFS.foodDisplayLimit,
    calorieGoalAdjustmentMode:
      (data.calorie_goal_adjustment_mode as CalorieGoalAdjustmentMode) ??
      DEFAULT_PREFS.calorieGoalAdjustmentMode,
    exerciseCaloriePercentage:
      data.exercise_calorie_percentage ??
      DEFAULT_PREFS.exerciseCaloriePercentage,
    activityLevel:
      (data.activity_level as ActivityLevel) ?? DEFAULT_PREFS.activityLevel,
    tdeeAllowNegativeAdjustment:
      data.tdee_allow_negative_adjustment ??
      DEFAULT_PREFS.tdeeAllowNegativeAdjustment,
    energyUnit: (data.energy_unit as EnergyUnit) ?? DEFAULT_PREFS.energyUnit,
    autoScaleOpenFoodFactsImports:
      data.auto_scale_open_food_facts_imports ??
      DEFAULT_PREFS.autoScaleOpenFoodFactsImports,
    autoScaleOnlineImports:
      data.auto_scale_online_imports ?? DEFAULT_PREFS.autoScaleOnlineImports,
    waterDisplayUnit:
      (data.water_display_unit as WaterDisplayUnit) ??
      DEFAULT_PREFS.waterDisplayUnit,
    language: data.language ?? DEFAULT_PREFS.language,
    bmrAlgorithm:
      (data.bmr_algorithm as BmrAlgorithm) ?? DEFAULT_PREFS.bmrAlgorithm,
    bodyFatAlgorithm:
      (data.body_fat_algorithm as BodyFatAlgorithm) ??
      DEFAULT_PREFS.bodyFatAlgorithm,
    includeBmrInNetCalories:
      data.include_bmr_in_net_calories ?? DEFAULT_PREFS.includeBmrInNetCalories,
    fatBreakdownAlgorithm:
      (data.fat_breakdown_algorithm as FatBreakdownAlgorithm) ??
      DEFAULT_PREFS.fatBreakdownAlgorithm,
    mineralCalculationAlgorithm:
      (data.mineral_calculation_algorithm as MineralCalculationAlgorithm) ??
      DEFAULT_PREFS.mineralCalculationAlgorithm,
    vitaminCalculationAlgorithm:
      (data.vitamin_calculation_algorithm as VitaminCalculationAlgorithm) ??
      DEFAULT_PREFS.vitaminCalculationAlgorithm,
    sugarCalculationAlgorithm:
      (data.sugar_calculation_algorithm as SugarCalculationAlgorithm) ??
      DEFAULT_PREFS.sugarCalculationAlgorithm,
    selectedDiet: data.selected_diet ?? DEFAULT_PREFS.selectedDiet,
    firstDayOfWeek:
      (data.first_day_of_week as DayOfWeek) ?? DEFAULT_PREFS.firstDayOfWeek,
  };
};

export const toApiPayload = (
  p: PreferencesState
): Partial<DefaultPreferences> => ({
  default_weight_unit: p.weightUnit,
  default_measurement_unit: p.measurementUnit,
  default_distance_unit: p.distanceUnit,
  date_format: p.dateFormat,
  auto_clear_history: p.autoClearHistory,
  logging_level: p.loggingLevel,
  default_food_data_provider_id: p.defaultFoodDataProviderId,
  default_barcode_provider_id: p.defaultBarcodeProviderId,
  barcode_fallback_open_food_facts: p.barcodeFallbackOpenFoodFacts,
  timezone: p.timezone,
  item_display_limit: p.itemDisplayLimit,
  food_display_limit: p.foodDisplayLimit,
  water_display_unit: p.waterDisplayUnit,
  language: p.language,
  calorie_goal_adjustment_mode: p.calorieGoalAdjustmentMode,
  exercise_calorie_percentage: p.exerciseCaloriePercentage,
  activity_level: p.activityLevel,
  tdee_allow_negative_adjustment: p.tdeeAllowNegativeAdjustment,
  energy_unit: p.energyUnit,
  auto_scale_open_food_facts_imports: p.autoScaleOpenFoodFactsImports,
  auto_scale_online_imports: p.autoScaleOnlineImports,
  bmr_algorithm: p.bmrAlgorithm,
  body_fat_algorithm: p.bodyFatAlgorithm,
  include_bmr_in_net_calories: p.includeBmrInNetCalories,
  fat_breakdown_algorithm: p.fatBreakdownAlgorithm,
  mineral_calculation_algorithm: p.mineralCalculationAlgorithm,
  vitamin_calculation_algorithm: p.vitaminCalculationAlgorithm,
  sugar_calculation_algorithm: p.sugarCalculationAlgorithm,
  selected_diet: p.selectedDiet,
  first_day_of_week: p.firstDayOfWeek,
});

export const loadGuestPrefs = (): Partial<PreferencesState> => {
  const out: Partial<PreferencesState> = {};
  const wu = localStorage.getItem(GUEST_KEYS.weightUnit) as WeightUnit | null;
  const mu = localStorage.getItem(
    GUEST_KEYS.measurementUnit
  ) as MeasurementUnit | null;
  const du = localStorage.getItem(
    GUEST_KEYS.distanceUnit
  ) as DistanceUnit | null;
  const df = localStorage.getItem(GUEST_KEYS.dateFormat);
  const lang = localStorage.getItem(GUEST_KEYS.language);
  const cgam = localStorage.getItem(
    GUEST_KEYS.calorieGoalAdjustmentMode
  ) as CalorieGoalAdjustmentMode | null;
  const eu = localStorage.getItem(GUEST_KEYS.energyUnit) as EnergyUnit | null;
  const off = localStorage.getItem(GUEST_KEYS.autoScaleOpenFoodFactsImports);
  const online = localStorage.getItem(GUEST_KEYS.autoScaleOnlineImports);

  if (wu) out.weightUnit = wu;
  if (mu) out.measurementUnit = mu;
  if (du) out.distanceUnit = du;
  if (df) out.dateFormat = df;
  if (lang) out.language = lang;
  if (cgam) out.calorieGoalAdjustmentMode = cgam;
  if (eu) out.energyUnit = eu;
  if (off !== null) out.autoScaleOpenFoodFactsImports = off === 'true';
  if (online !== null) out.autoScaleOnlineImports = online === 'true';
  return out;
};

export const saveGuestPrefs = (updates: Partial<DefaultPreferences>) => {
  if (updates.default_weight_unit)
    localStorage.setItem(GUEST_KEYS.weightUnit, updates.default_weight_unit);
  if (updates.default_measurement_unit)
    localStorage.setItem(
      GUEST_KEYS.measurementUnit,
      updates.default_measurement_unit
    );
  if (updates.default_distance_unit)
    localStorage.setItem(
      GUEST_KEYS.distanceUnit,
      updates.default_distance_unit
    );
  if (updates.date_format)
    localStorage.setItem(GUEST_KEYS.dateFormat, updates.date_format);
  if (updates.language)
    localStorage.setItem(GUEST_KEYS.language, updates.language);
  if (updates.calorie_goal_adjustment_mode)
    localStorage.setItem(
      GUEST_KEYS.calorieGoalAdjustmentMode,
      updates.calorie_goal_adjustment_mode
    );
  if (updates.energy_unit)
    localStorage.setItem(GUEST_KEYS.energyUnit, updates.energy_unit);
  if (updates.auto_scale_open_food_facts_imports !== undefined) {
    localStorage.setItem(
      GUEST_KEYS.autoScaleOpenFoodFactsImports,
      String(updates.auto_scale_open_food_facts_imports)
    );
  }
  if (updates.auto_scale_online_imports !== undefined) {
    localStorage.setItem(
      GUEST_KEYS.autoScaleOnlineImports,
      String(updates.auto_scale_online_imports)
    );
  }
};
