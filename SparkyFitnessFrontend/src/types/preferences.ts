import {
  FatBreakdownAlgorithm,
  MineralCalculationAlgorithm,
  VitaminCalculationAlgorithm,
  SugarCalculationAlgorithm,
} from '@/types/nutrientAlgorithms';
import { BmrAlgorithm } from '@/services/bmrService';
import { BodyFatAlgorithm } from '@/services/bodyCompositionService';
import { CalorieGoalAdjustmentMode } from '@/utils/calorieCalculations';
import { DayOfWeek } from '@/types/settings';
import {
  WeightUnit,
  DistanceUnit,
  LoggingLevel,
  EnergyUnit,
  WaterDisplayUnit,
  ActivityLevel,
  MeasurementUnit,
} from '@/contexts/PreferencesContext';

export interface NutrientPreference {
  view_group: string;
  platform: 'desktop' | 'mobile';
  visible_nutrients: string[];
}
export interface PreferencesContextType {
  weightUnit: WeightUnit;
  measurementUnit: MeasurementUnit;
  distanceUnit: DistanceUnit;
  dateFormat: string;
  autoClearHistory: string;
  loggingLevel: LoggingLevel;
  defaultFoodDataProviderId: string | null;
  defaultBarcodeProviderId: string | null;
  barcodeFallbackOpenFoodFacts: boolean;
  timezone: string;
  foodDisplayLimit: number;
  itemDisplayLimit: number;
  calorieGoalAdjustmentMode: CalorieGoalAdjustmentMode;
  energyUnit: EnergyUnit;
  autoScaleOpenFoodFactsImports: boolean;
  autoScaleOnlineImports: boolean;
  nutrientDisplayPreferences: NutrientPreference[];
  water_display_unit: WaterDisplayUnit;
  language: string;
  bmrAlgorithm: BmrAlgorithm;
  bodyFatAlgorithm: BodyFatAlgorithm;
  includeBmrInNetCalories: boolean;
  fatBreakdownAlgorithm: FatBreakdownAlgorithm;
  mineralCalculationAlgorithm: MineralCalculationAlgorithm;
  vitaminCalculationAlgorithm: VitaminCalculationAlgorithm;
  sugarCalculationAlgorithm: SugarCalculationAlgorithm;
  exerciseCaloriePercentage: number;
  activityLevel: ActivityLevel;
  tdeeAllowNegativeAdjustment: boolean;
  selectedDiet: string;
  firstDayOfWeek: DayOfWeek;
  setWeightUnit: (unit: WeightUnit) => void;
  setMeasurementUnit: (unit: MeasurementUnit) => void;
  setDistanceUnit: (unit: DistanceUnit) => void;
  setDateFormat: (format: string) => void;
  setAutoClearHistory: (value: string) => void;
  setLoggingLevel: (level: LoggingLevel) => void;
  setDefaultFoodDataProviderId: (id: string | null) => void;
  setDefaultBarcodeProviderId: (id: string | null) => void;
  setBarcodeFallbackOpenFoodFacts: (enabled: boolean) => void;
  setTimezone: (timezone: string) => void;
  setItemDisplayLimit: (limit: number) => void;
  setCalorieGoalAdjustmentMode: (mode: CalorieGoalAdjustmentMode) => void;
  setExerciseCaloriePercentage: (percentage: number) => void;
  setActivityLevel: (level: ActivityLevel) => void;
  setTdeeAllowNegativeAdjustment: (allow: boolean) => void;
  setEnergyUnit: (unit: EnergyUnit) => void;
  setAutoScaleOpenFoodFactsImports: (enabled: boolean) => void;
  setAutoScaleOnlineImports: (enabled: boolean) => void;
  loadNutrientDisplayPreferences: () => Promise<void>;
  setWaterDisplayUnit: (unit: WaterDisplayUnit) => void;
  setLanguage: (language: string) => void;
  setBmrAlgorithm: (algorithm: BmrAlgorithm) => void;
  setBodyFatAlgorithm: (algorithm: BodyFatAlgorithm) => void;
  setIncludeBmrInNetCalories: (include: boolean) => void;
  setFatBreakdownAlgorithm: (algorithm: FatBreakdownAlgorithm) => void;
  setMineralCalculationAlgorithm: (
    algorithm: MineralCalculationAlgorithm
  ) => void;
  setVitaminCalculationAlgorithm: (
    algorithm: VitaminCalculationAlgorithm
  ) => void;
  setSugarCalculationAlgorithm: (algorithm: SugarCalculationAlgorithm) => void;
  setSelectedDiet: (diet: string) => void;
  setFirstDayOfWeek: (day: DayOfWeek) => void;
  convertWeight: (value: number, from: WeightUnit, to: WeightUnit) => number;
  convertMeasurement: (
    value: number,
    from: MeasurementUnit,
    to: MeasurementUnit
  ) => number;
  convertDistance: (
    value: number,
    from: DistanceUnit,
    to: DistanceUnit
  ) => number;
  convertEnergy: (
    value: number,
    fromUnit: EnergyUnit,
    toUnit: EnergyUnit
  ) => number;
  getEnergyUnitString: (unit: EnergyUnit) => string;
  formatDate: (date: string | Date) => string;
  formatDateInUserTimezone: (date: string | Date, formatStr?: string) => string;
  parseDateInUserTimezone: (dateString: string) => Date;
  loadPreferences: () => Promise<void>;
  saveAllPreferences: (
    newPrefs?: Partial<PreferencesContextType>
  ) => Promise<void>;
}

export interface DefaultPreferences {
  user_id: string;
  date_format: string;
  default_weight_unit: WeightUnit;
  default_measurement_unit: MeasurementUnit;
  default_distance_unit: DistanceUnit;
  system_prompt: string;
  auto_clear_history: string;
  logging_level: LoggingLevel;
  timezone: string;
  item_display_limit: number;
  food_display_limit: number;
  water_display_unit: WaterDisplayUnit;
  language: string;
  calorie_goal_adjustment_mode: CalorieGoalAdjustmentMode;
  energy_unit: EnergyUnit;
  auto_scale_open_food_facts_imports: boolean;
  auto_scale_online_imports: boolean;
  selected_diet: string;
  updated_at?: string;
  default_food_data_provider_id: string | null;
  default_barcode_provider_id: string | null;
  barcode_fallback_open_food_facts: boolean;
  exercise_calorie_percentage: number;
  activity_level: ActivityLevel;
  tdee_allow_negative_adjustment: boolean;
  bmr_algorithm: BmrAlgorithm;
  body_fat_algorithm: BodyFatAlgorithm;
  include_bmr_in_net_calories: boolean;
  fat_breakdown_algorithm: FatBreakdownAlgorithm;
  mineral_calculation_algorithm: MineralCalculationAlgorithm;
  vitamin_calculation_algorithm: VitaminCalculationAlgorithm;
  sugar_calculation_algorithm: SugarCalculationAlgorithm;
  first_day_of_week: number;
}

export type PreferencesState = {
  weightUnit: WeightUnit;
  measurementUnit: MeasurementUnit;
  distanceUnit: DistanceUnit;
  dateFormat: string;
  autoClearHistory: string;
  loggingLevel: LoggingLevel;
  defaultFoodDataProviderId: string | null;
  defaultBarcodeProviderId: string | null;
  barcodeFallbackOpenFoodFacts: boolean;
  timezone: string;
  itemDisplayLimit: number;
  foodDisplayLimit: number;
  calorieGoalAdjustmentMode: CalorieGoalAdjustmentMode;
  exerciseCaloriePercentage: number;
  activityLevel: ActivityLevel;
  tdeeAllowNegativeAdjustment: boolean;
  energyUnit: EnergyUnit;
  autoScaleOpenFoodFactsImports: boolean;
  autoScaleOnlineImports: boolean;
  waterDisplayUnit: WaterDisplayUnit;
  language: string;
  bmrAlgorithm: BmrAlgorithm;
  bodyFatAlgorithm: BodyFatAlgorithm;
  includeBmrInNetCalories: boolean;
  fatBreakdownAlgorithm: FatBreakdownAlgorithm;
  mineralCalculationAlgorithm: MineralCalculationAlgorithm;
  vitaminCalculationAlgorithm: VitaminCalculationAlgorithm;
  sugarCalculationAlgorithm: SugarCalculationAlgorithm;
  selectedDiet: string;
  firstDayOfWeek: DayOfWeek;
};
