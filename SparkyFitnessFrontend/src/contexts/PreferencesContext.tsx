import type React from 'react';
import { createContext, useContext, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { debug, info, error } from '@/utils/logging';
import {
  FatBreakdownAlgorithm,
  MineralCalculationAlgorithm,
  VitaminCalculationAlgorithm,
  SugarCalculationAlgorithm,
} from '@/types/nutrientAlgorithms';
import { BmrAlgorithm } from '@/services/bmrService';
import { BodyFatAlgorithm } from '@/services/bodyCompositionService';
import {
  preferencesOptions,
  useNutrientsPreferencesQuery,
  useUpdatePreferencesMutation,
  useUserPreferencesQuery,
} from '@/hooks/Settings/usePreferences';
import { useQueryClient } from '@tanstack/react-query';
import { getErrorMessage } from '@/utils/api';

import { DayOfWeek } from '@/types/settings';
import {
  DefaultPreferences,
  PreferencesContextType,
  PreferencesState,
} from '@/types/preferences';
import {
  convertDistance,
  convertEnergy,
  convertMeasurement,
  convertWeight,
  formatDateInUserTimezone as _formatDateInUserTimezone,
  formatDate as _formatDate,
  parseDateInUserTimezone as _parseDateInUserTimezone,
  fromApiToState,
  loadGuestPrefs,
  normalizeDateFormat,
  saveGuestPrefs,
  toApiPayload,
} from '@/utils/preferences';
import { DEFAULT_PREFS } from '@/constants/preferences';

export type EnergyUnit = 'kcal' | 'kJ';
export type ActivityLevel = 'not_much' | 'light' | 'moderate' | 'heavy';
export type WeightUnit = 'kg' | 'lbs' | 'st_lbs';
export type MeasurementUnit = 'cm' | 'inches' | 'ft_in';
export type DistanceUnit = 'km' | 'miles';
export type LoggingLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SILENT';
export type CalorieGoalAdjustmentMode =
  | 'dynamic'
  | 'fixed'
  | 'percentage'
  | 'tdee'
  | 'adaptive';
export type WaterDisplayUnit = 'ml' | 'oz' | 'liter';

const PreferencesContext = createContext<PreferencesContextType | undefined>(
  undefined
);

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
};

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { mutateAsync: upsertUserPreferences } = useUpdatePreferencesMutation();
  const userPrefsQuery = useUserPreferencesQuery(!!user);
  const nutrientsQuery = useNutrientsPreferencesQuery(!!user);
  const guestPrefs = useMemo(() => loadGuestPrefs(), []);

  const prefs: PreferencesState = useMemo(() => {
    if (!user) return { ...DEFAULT_PREFS, ...guestPrefs };
    if (userPrefsQuery.error) {
      const msg = getErrorMessage(userPrefsQuery.error);
      if (msg?.includes('404')) return DEFAULT_PREFS;
    }
    return fromApiToState(userPrefsQuery.data ?? null);
  }, [user, guestPrefs, userPrefsQuery.data, userPrefsQuery.error]);

  const nutrientDisplayPreferences = nutrientsQuery.data ?? [];

  const getEnergyUnitString = useCallback((unit: EnergyUnit) => unit, []);

  const formatDateInUserTimezone = useCallback(
    (date: string | Date, formatStr?: string) =>
      _formatDateInUserTimezone(
        date,
        prefs.timezone,
        prefs.loggingLevel,
        formatStr
      ),
    [prefs.timezone, prefs.loggingLevel]
  );

  const formatDate = useCallback(
    (date: string | Date) =>
      _formatDate(date, prefs.timezone, prefs.loggingLevel, prefs.dateFormat),
    [prefs.timezone, prefs.loggingLevel, prefs.dateFormat]
  );

  const parseDateInUserTimezone = useCallback(
    (dateString: string) =>
      _parseDateInUserTimezone(dateString, prefs.timezone, prefs.loggingLevel),
    [prefs.timezone, prefs.loggingLevel]
  );

  const loadPreferences = useCallback(async () => {
    if (!user) return;
    await queryClient.invalidateQueries({
      queryKey: preferencesOptions.user().queryKey,
    });
  }, [user, queryClient]);

  const loadNutrientDisplayPreferences = useCallback(async () => {
    if (!user) return;
    await queryClient.invalidateQueries({
      queryKey: preferencesOptions.nutrients().queryKey,
    });
  }, [user, queryClient]);

  const updatePreferences = useCallback(
    async (updates: Partial<DefaultPreferences>) => {
      debug(
        prefs.loggingLevel,
        'PreferencesProvider: Attempting to update preferences with:',
        updates
      );

      if (!user) {
        saveGuestPrefs(updates);
        return;
      }

      try {
        await upsertUserPreferences({
          user_id: user.id,
          ...updates,
          updated_at: new Date().toISOString(),
        });

        await queryClient.invalidateQueries({
          queryKey: preferencesOptions.user().queryKey,
        });

        info(
          prefs.loggingLevel,
          'PreferencesContext: Preferences updated successfully.'
        );
      } catch (err) {
        error(
          prefs.loggingLevel,
          'PreferencesContext: Unexpected error updating preferences:',
          err
        );
        throw err;
      }
    },
    [user, upsertUserPreferences, queryClient, prefs.loggingLevel]
  );

  const saveAllPreferences = useCallback(
    async (newPrefs?: Partial<PreferencesState>) => {
      info(
        prefs.loggingLevel,
        'PreferencesProvider: Saving all preferences to backend.'
      );
      const merged = { ...prefs, ...(newPrefs ?? {}) };

      try {
        await updatePreferences(toApiPayload(merged));
        info(
          prefs.loggingLevel,
          'PreferencesProvider: All preferences saved successfully.'
        );
      } catch (err) {
        error(
          prefs.loggingLevel,
          'PreferencesContext: Error saving all preferences:',
          err
        );
        throw err;
      }
    },
    [prefs, updatePreferences]
  );

  const setPref = useCallback(
    <K extends keyof PreferencesState>(key: K, value: PreferencesState[K]) => {
      const patch = { [key]: value } as Partial<PreferencesState>;
      void saveAllPreferences(patch);
    },
    [saveAllPreferences]
  );

  const contextValue = useMemo(
    () => ({
      weightUnit: prefs.weightUnit,
      measurementUnit: prefs.measurementUnit,
      distanceUnit: prefs.distanceUnit,
      dateFormat: prefs.dateFormat,
      autoClearHistory: prefs.autoClearHistory,
      loggingLevel: prefs.loggingLevel,
      defaultFoodDataProviderId: prefs.defaultFoodDataProviderId,
      defaultBarcodeProviderId: prefs.defaultBarcodeProviderId,
      barcodeFallbackOpenFoodFacts: prefs.barcodeFallbackOpenFoodFacts,
      timezone: prefs.timezone,
      itemDisplayLimit: prefs.itemDisplayLimit,
      foodDisplayLimit: prefs.foodDisplayLimit,
      calorieGoalAdjustmentMode: prefs.calorieGoalAdjustmentMode,
      exerciseCaloriePercentage: prefs.exerciseCaloriePercentage,
      activityLevel: prefs.activityLevel,
      tdeeAllowNegativeAdjustment: prefs.tdeeAllowNegativeAdjustment,
      energyUnit: prefs.energyUnit,
      autoScaleOpenFoodFactsImports: prefs.autoScaleOpenFoodFactsImports,
      autoScaleOnlineImports: prefs.autoScaleOnlineImports,
      nutrientDisplayPreferences,
      water_display_unit: prefs.waterDisplayUnit,
      language: prefs.language,
      bmrAlgorithm: prefs.bmrAlgorithm,
      bodyFatAlgorithm: prefs.bodyFatAlgorithm,
      includeBmrInNetCalories: prefs.includeBmrInNetCalories,
      fatBreakdownAlgorithm: prefs.fatBreakdownAlgorithm,
      mineralCalculationAlgorithm: prefs.mineralCalculationAlgorithm,
      vitaminCalculationAlgorithm: prefs.vitaminCalculationAlgorithm,
      sugarCalculationAlgorithm: prefs.sugarCalculationAlgorithm,
      selectedDiet: prefs.selectedDiet,
      firstDayOfWeek: prefs.firstDayOfWeek,

      setWeightUnit: (v: WeightUnit) => setPref('weightUnit', v),
      setMeasurementUnit: (v: MeasurementUnit) => setPref('measurementUnit', v),
      setDistanceUnit: (v: DistanceUnit) => setPref('distanceUnit', v),
      setDateFormat: (v: string) =>
        setPref('dateFormat', normalizeDateFormat(v)),
      setAutoClearHistory: (v: string) => setPref('autoClearHistory', v),
      setLoggingLevel: (v: LoggingLevel) => setPref('loggingLevel', v),
      setDefaultFoodDataProviderId: (v: string | null) =>
        setPref('defaultFoodDataProviderId', v),
      setDefaultBarcodeProviderId: (v: string | null) =>
        setPref('defaultBarcodeProviderId', v),
      setBarcodeFallbackOpenFoodFacts: (v: boolean) =>
        setPref('barcodeFallbackOpenFoodFacts', v),
      setTimezone: (v: string) => setPref('timezone', v),
      setItemDisplayLimit: (v: number) => setPref('itemDisplayLimit', v),
      setCalorieGoalAdjustmentMode: (v: CalorieGoalAdjustmentMode) =>
        setPref('calorieGoalAdjustmentMode', v),
      setExerciseCaloriePercentage: (v: number) =>
        setPref('exerciseCaloriePercentage', v),
      setActivityLevel: (v: ActivityLevel) => setPref('activityLevel', v),
      setTdeeAllowNegativeAdjustment: (v: boolean) =>
        setPref('tdeeAllowNegativeAdjustment', v),
      setEnergyUnit: (v: EnergyUnit) => setPref('energyUnit', v),
      setAutoScaleOpenFoodFactsImports: (v: boolean) =>
        setPref('autoScaleOpenFoodFactsImports', v),
      setAutoScaleOnlineImports: (v: boolean) =>
        setPref('autoScaleOnlineImports', v),
      loadNutrientDisplayPreferences,
      setWaterDisplayUnit: (v: WaterDisplayUnit) =>
        setPref('waterDisplayUnit', v),
      setLanguage: (v: string) => setPref('language', v),
      setBmrAlgorithm: (v: BmrAlgorithm) => setPref('bmrAlgorithm', v),
      setBodyFatAlgorithm: (v: BodyFatAlgorithm) =>
        setPref('bodyFatAlgorithm', v),
      setIncludeBmrInNetCalories: (v: boolean) =>
        setPref('includeBmrInNetCalories', v),
      setFatBreakdownAlgorithm: (v: FatBreakdownAlgorithm) =>
        setPref('fatBreakdownAlgorithm', v),
      setMineralCalculationAlgorithm: (v: MineralCalculationAlgorithm) =>
        setPref('mineralCalculationAlgorithm', v),
      setVitaminCalculationAlgorithm: (v: VitaminCalculationAlgorithm) =>
        setPref('vitaminCalculationAlgorithm', v),
      setSugarCalculationAlgorithm: (v: SugarCalculationAlgorithm) =>
        setPref('sugarCalculationAlgorithm', v),
      setSelectedDiet: (v: string) => setPref('selectedDiet', v),
      setFirstDayOfWeek: (v: DayOfWeek) => setPref('firstDayOfWeek', v),

      convertWeight,
      convertMeasurement,
      convertDistance,
      convertEnergy,
      formatDate,
      formatDateInUserTimezone,
      parseDateInUserTimezone,
      loadPreferences,
      saveAllPreferences,
      getEnergyUnitString,
    }),
    [
      prefs,
      nutrientDisplayPreferences,
      setPref,
      loadNutrientDisplayPreferences,
      formatDate,
      formatDateInUserTimezone,
      parseDateInUserTimezone,
      loadPreferences,
      saveAllPreferences,
      getEnergyUnitString,
    ]
  );

  return (
    <PreferencesContext.Provider value={contextValue}>
      {children}
    </PreferencesContext.Provider>
  );
};
