import { vi, beforeEach, describe, expect, it } from 'vitest';
import foodRepository from '../models/foodRepository.js';
import foodCoreService from '../services/foodCoreService.js';
vi.mock('../models/foodRepository');
vi.mock('../config/logging', () => ({ log: vi.fn() }));
const TEST_USER_ID = 'user-123';
const FOOD_ID = 'food-456';
const VARIANT_ID = 'variant-789';

type Food = {
  id: string;
  name: string;
  brand: string | null;
  is_custom: boolean;
  user_id: string;
};

type FoodVariant = {
  id: string;
  food_id: string;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  saturated_fat: number | null;
  polyunsaturated_fat: number | null;
  monounsaturated_fat: number | null;
  trans_fat: number | null;
  cholesterol: number | null;
  sodium: number | null;
  potassium: number | null;
  dietary_fiber: number | null;
  sugars: number | null;
  vitamin_a: number | null;
  vitamin_c: number | null;
  calcium: number | null;
  iron: number | null;
  glycemic_index: number | null;
  custom_nutrients: Record<string, string | null> | null;
  is_default: boolean;
};

const makeFood = (overrides: Partial<Food> = {}): Food => ({
  id: FOOD_ID,
  name: 'Chicken Breast',
  brand: 'Acme',
  is_custom: true,
  user_id: TEST_USER_ID,
  ...overrides,
});

const makeVariant = (overrides: Partial<FoodVariant> = {}): FoodVariant => ({
  id: VARIANT_ID,
  food_id: FOOD_ID,
  serving_size: 100,
  serving_unit: 'g',
  calories: 165,
  protein: 31,
  carbs: 0,
  fat: 3.6,
  saturated_fat: 1,
  polyunsaturated_fat: 0.8,
  monounsaturated_fat: 1.2,
  trans_fat: 0,
  cholesterol: 85,
  sodium: 74,
  potassium: 256,
  dietary_fiber: 0,
  sugars: 0,
  vitamin_a: 6,
  vitamin_c: 0,
  calcium: 11,
  iron: 0.7,
  glycemic_index: null,
  custom_nutrients: { zinc: '1.3mg' },
  is_default: true,
  ...overrides,
});
describe('foodCoreService.updateFoodEntriesSnapshot', () => {
  const mockedFoodRepository = vi.mocked(foodRepository, { deep: true });

  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('should fetch food + variant, update snapshot, clear ignored updates, and return success message', async () => {
    mockedFoodRepository.getFoodById.mockResolvedValue(makeFood());
    mockedFoodRepository.getFoodVariantById.mockResolvedValue(makeVariant());
    mockedFoodRepository.updateFoodEntriesSnapshot.mockResolvedValue(2);
    mockedFoodRepository.clearUserIgnoredUpdate.mockResolvedValue(undefined);
    const result = await foodCoreService.updateFoodEntriesSnapshot(
      TEST_USER_ID,
      FOOD_ID,
      VARIANT_ID
    );
    expect(result).toEqual({ message: 'Food entries updated successfully.' });
    expect(mockedFoodRepository.getFoodById).toHaveBeenCalledWith(
      FOOD_ID,
      TEST_USER_ID
    );
    expect(mockedFoodRepository.getFoodVariantById).toHaveBeenCalledWith(
      VARIANT_ID,
      TEST_USER_ID
    );
    expect(mockedFoodRepository.updateFoodEntriesSnapshot).toHaveBeenCalled();
    expect(mockedFoodRepository.clearUserIgnoredUpdate).toHaveBeenCalledWith(
      TEST_USER_ID,
      VARIANT_ID
    );
  });
  it('should pass the exact snapshot shape to the repository', async () => {
    const food = makeFood();
    const variant = makeVariant();
    mockedFoodRepository.getFoodById.mockResolvedValue(food);
    mockedFoodRepository.getFoodVariantById.mockResolvedValue(variant);
    mockedFoodRepository.updateFoodEntriesSnapshot.mockResolvedValue(1);
    mockedFoodRepository.clearUserIgnoredUpdate.mockResolvedValue(undefined);
    await foodCoreService.updateFoodEntriesSnapshot(
      TEST_USER_ID,
      FOOD_ID,
      VARIANT_ID
    );
    // This is the key test — verifies the 4-arg call with the full snapshot object.
    // The original 3-arg bug would have failed here because newSnapshotData
    // would have been missing entirely.
    expect(mockedFoodRepository.updateFoodEntriesSnapshot).toHaveBeenCalledWith(
      TEST_USER_ID,
      FOOD_ID,
      VARIANT_ID,
      {
        food_name: food.name,
        brand_name: food.brand,
        serving_size: variant.serving_size,
        serving_unit: variant.serving_unit,
        calories: variant.calories,
        protein: variant.protein,
        carbs: variant.carbs,
        fat: variant.fat,
        saturated_fat: variant.saturated_fat,
        polyunsaturated_fat: variant.polyunsaturated_fat,
        monounsaturated_fat: variant.monounsaturated_fat,
        trans_fat: variant.trans_fat,
        cholesterol: variant.cholesterol,
        sodium: variant.sodium,
        potassium: variant.potassium,
        dietary_fiber: variant.dietary_fiber,
        sugars: variant.sugars,
        vitamin_a: variant.vitamin_a,
        vitamin_c: variant.vitamin_c,
        calcium: variant.calcium,
        iron: variant.iron,
        glycemic_index: variant.glycemic_index,
        custom_nutrients: { zinc: '1.3mg' },
      }
    );
  });
  it('should sanitize custom_nutrients by stripping empty and null values', async () => {
    const variant = makeVariant({
      custom_nutrients: { zinc: '1.3mg', empty: '', blank: null, ok: '5mg' },
    });
    mockedFoodRepository.getFoodById.mockResolvedValue(makeFood());
    mockedFoodRepository.getFoodVariantById.mockResolvedValue(variant);
    mockedFoodRepository.updateFoodEntriesSnapshot.mockResolvedValue(1);
    mockedFoodRepository.clearUserIgnoredUpdate.mockResolvedValue(undefined);
    await foodCoreService.updateFoodEntriesSnapshot(
      TEST_USER_ID,
      FOOD_ID,
      VARIANT_ID
    );
    const snapshotArg =
      mockedFoodRepository.updateFoodEntriesSnapshot.mock.calls[0]?.[3];
    expect(snapshotArg).toBeDefined();
    expect(snapshotArg.custom_nutrients).toEqual({ zinc: '1.3mg', ok: '5mg' });
  });
  it('should throw "Food not found." when food is null', async () => {
    mockedFoodRepository.getFoodById.mockResolvedValue(null);
    await expect(
      foodCoreService.updateFoodEntriesSnapshot(
        TEST_USER_ID,
        FOOD_ID,
        VARIANT_ID
      )
    ).rejects.toThrow('Food not found.');
    expect(mockedFoodRepository.updateFoodEntriesSnapshot).not.toHaveBeenCalled();
    expect(mockedFoodRepository.clearUserIgnoredUpdate).not.toHaveBeenCalled();
  });
  it('should throw "Food variant not found." when variant is null', async () => {
    mockedFoodRepository.getFoodById.mockResolvedValue(makeFood());
    mockedFoodRepository.getFoodVariantById.mockResolvedValue(null);
    await expect(
      foodCoreService.updateFoodEntriesSnapshot(
        TEST_USER_ID,
        FOOD_ID,
        VARIANT_ID
      )
    ).rejects.toThrow('Food variant not found.');
    expect(mockedFoodRepository.updateFoodEntriesSnapshot).not.toHaveBeenCalled();
    expect(mockedFoodRepository.clearUserIgnoredUpdate).not.toHaveBeenCalled();
  });
  it('should not clear ignored updates when snapshot update throws', async () => {
    mockedFoodRepository.getFoodById.mockResolvedValue(makeFood());
    mockedFoodRepository.getFoodVariantById.mockResolvedValue(makeVariant());
    mockedFoodRepository.updateFoodEntriesSnapshot.mockRejectedValue(
      new Error('DB write failed')
    );
    await expect(
      foodCoreService.updateFoodEntriesSnapshot(
        TEST_USER_ID,
        FOOD_ID,
        VARIANT_ID
      )
    ).rejects.toThrow('DB write failed');
    expect(mockedFoodRepository.updateFoodEntriesSnapshot).toHaveBeenCalled();
    expect(mockedFoodRepository.clearUserIgnoredUpdate).not.toHaveBeenCalled();
  });
  // Snapshot update must succeed before clearing ignored updates, so a failure
  // doesn't also lose the user's ignore state.
  it('should call updateFoodEntriesSnapshot before clearUserIgnoredUpdate', async () => {
    const callOrder: string[] = [];
    mockedFoodRepository.getFoodById.mockResolvedValue(makeFood());
    mockedFoodRepository.getFoodVariantById.mockResolvedValue(makeVariant());
    mockedFoodRepository.updateFoodEntriesSnapshot.mockImplementation(() => {
      callOrder.push('updateFoodEntriesSnapshot');
      return Promise.resolve(1);
    });
    mockedFoodRepository.clearUserIgnoredUpdate.mockImplementation(() => {
      callOrder.push('clearUserIgnoredUpdate');
      return Promise.resolve(undefined);
    });
    await foodCoreService.updateFoodEntriesSnapshot(
      TEST_USER_ID,
      FOOD_ID,
      VARIANT_ID
    );
    expect(callOrder).toEqual([
      'updateFoodEntriesSnapshot',
      'clearUserIgnoredUpdate',
    ]);
  });
  // --- No variantId: update all variants for the food ---
  it('should fetch all variants and update each one when variantId is not provided', async () => {
    const variantA = makeVariant({ id: 'variant-aaa' });
    const variantB = makeVariant({ id: 'variant-bbb', calories: 200 });
    mockedFoodRepository.getFoodById.mockResolvedValue(makeFood());
    mockedFoodRepository.getFoodVariantsByFoodId.mockResolvedValue([
      variantA,
      variantB,
    ]);
    mockedFoodRepository.updateFoodEntriesSnapshot.mockResolvedValue(1);
    mockedFoodRepository.clearUserIgnoredUpdate.mockResolvedValue(undefined);
    const result = await foodCoreService.updateFoodEntriesSnapshot(
      TEST_USER_ID,
      FOOD_ID,
      undefined
    );
    expect(result).toEqual({ message: 'Food entries updated successfully.' });
    expect(mockedFoodRepository.getFoodVariantsByFoodId).toHaveBeenCalledWith(
      FOOD_ID,
      TEST_USER_ID
    );
    expect(mockedFoodRepository.getFoodVariantById).not.toHaveBeenCalled();
    expect(mockedFoodRepository.updateFoodEntriesSnapshot).toHaveBeenCalledTimes(2);
    expect(mockedFoodRepository.clearUserIgnoredUpdate).toHaveBeenCalledTimes(2);
    expect(mockedFoodRepository.clearUserIgnoredUpdate).toHaveBeenCalledWith(
      TEST_USER_ID,
      'variant-aaa'
    );
    expect(mockedFoodRepository.clearUserIgnoredUpdate).toHaveBeenCalledWith(
      TEST_USER_ID,
      'variant-bbb'
    );
  });
  it('should pass correct snapshot data for each variant when variantId is not provided', async () => {
    const food = makeFood();
    const variantA = makeVariant({ id: 'variant-aaa', calories: 100 });
    const variantB = makeVariant({ id: 'variant-bbb', calories: 250 });
    mockedFoodRepository.getFoodById.mockResolvedValue(food);
    mockedFoodRepository.getFoodVariantsByFoodId.mockResolvedValue([
      variantA,
      variantB,
    ]);
    mockedFoodRepository.updateFoodEntriesSnapshot.mockResolvedValue(1);
    mockedFoodRepository.clearUserIgnoredUpdate.mockResolvedValue(undefined);
    await foodCoreService.updateFoodEntriesSnapshot(TEST_USER_ID, FOOD_ID, undefined);
    const firstCall = mockedFoodRepository.updateFoodEntriesSnapshot.mock.calls[0];
    expect(firstCall).toBeDefined();
    expect(firstCall[2]).toBe('variant-aaa');
    expect(firstCall[3].calories).toBe(100);
    expect(firstCall[3].food_name).toBe(food.name);
    const secondCall = mockedFoodRepository.updateFoodEntriesSnapshot.mock.calls[1];
    expect(secondCall).toBeDefined();
    expect(secondCall[2]).toBe('variant-bbb');
    expect(secondCall[3].calories).toBe(250);
    expect(secondCall[3].food_name).toBe(food.name);
  });
  it('should succeed with no updates when food has no variants and variantId is not provided', async () => {
    mockedFoodRepository.getFoodById.mockResolvedValue(makeFood());
    mockedFoodRepository.getFoodVariantsByFoodId.mockResolvedValue([]);
    const result = await foodCoreService.updateFoodEntriesSnapshot(
      TEST_USER_ID,
      FOOD_ID,
      undefined
    );
    expect(result).toEqual({ message: 'Food entries updated successfully.' });
    expect(mockedFoodRepository.updateFoodEntriesSnapshot).not.toHaveBeenCalled();
    expect(mockedFoodRepository.clearUserIgnoredUpdate).not.toHaveBeenCalled();
  });
  it('should throw "Food not found." when food is null and variantId is not provided', async () => {
    mockedFoodRepository.getFoodById.mockResolvedValue(null);
    await expect(
      foodCoreService.updateFoodEntriesSnapshot(TEST_USER_ID, FOOD_ID, undefined)
    ).rejects.toThrow('Food not found.');
    expect(mockedFoodRepository.getFoodVariantsByFoodId).not.toHaveBeenCalled();
    expect(mockedFoodRepository.updateFoodEntriesSnapshot).not.toHaveBeenCalled();
  });
});
