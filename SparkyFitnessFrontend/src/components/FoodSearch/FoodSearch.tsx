import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Loader2, Edit, Camera, BookText } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { debug } from '@/utils/logging';
import { type FatSecretFoodItem } from '@/api/Foods/fatSecret.ts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import { getProviderCategory } from '@/api/Settings/externalProviderService';
import type { Food, CSVData } from '@/types/food';
import type { Meal } from '@/types/meal';
import { useQueryClient } from '@tanstack/react-query';
import {
  searchMealieOptions,
  searchTandoorOptions,
  useDatabaseFoodSearchQuery,
  useImportCsvMutation,
  useRecentAndTopFoodsQuery,
} from '@/hooks/Foods/useFoods.ts';
import { useCustomNutrients } from '@/hooks/Foods/useCustomNutrients.ts';
import {
  fatSecretNutrientOptions,
  searchFatSecretOptions,
} from '@/hooks/Foods/useFatSecret.ts';
import {
  nutritionixBrandedNutrientsOptions,
  nutritionixNaturalNutrientsOptions,
  searchNutritionixOptions,
} from '@/hooks/Foods/useNutrionix.ts';
import {
  searchUsdaOptions,
  usdaFoodDetailsOptions,
} from '@/hooks/Foods/useUSDA.ts';
import { DEFAULT_NUTRIENTS } from '@/constants/nutrients.ts';
import { NutrientGrid } from './NutrientGrid.tsx';
import {
  convertFatSecretToFood,
  convertNutritionixToFood,
  convertUsdaToFood,
  formatUsdaNutrientsForDisplay,
} from '@/utils/foodSearch.ts';
import FoodResultCard from './FoodResultCard.tsx';
import { BarcodeScannerDialog } from './BarcodeScannerDialog.tsx';
import { CsvImportDialog } from './CsvImportDialog.tsx';
import { FoodFormDialog } from './FoodFormDialog.tsx';
import { useExternalProvidersQuery } from '@/hooks/Settings/useExternalProviderSettings.ts';
import {
  searchOpenFoodFactsBarcodeOptions,
  searchOpenFoodFactsOptions,
} from '@/hooks/Foods/useOpenFoodFacts.ts';
import { mealSearchOptions } from '@/hooks/Foods/useMeals.ts';

export interface OpenFoodFactsProduct {
  product_name: string;
  brands?: string;
  serving_quantity?: number;
  nutriments: {
    'energy-kcal_100g'?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
    'saturated-fat_100g'?: number;
    sodium_100g?: number;
    fiber_100g?: number;
    sugars_100g?: number;
  };
  code: string;
}

interface EnhancedFoodSearchProps {
  onFoodSelect: (item: Food | Meal, type: 'food' | 'meal') => void;
  hideDatabaseTab?: boolean;
  hideMealTab?: boolean;
  mealType?: string;
}

type FoodDataForBackend = Omit<CSVData, 'id'>;

const EnhancedFoodSearch = ({
  onFoodSelect,
  hideDatabaseTab = false,
  hideMealTab = false,
  mealType = undefined,
}: EnhancedFoodSearchProps) => {
  const { activeUserId } = useActiveUser();
  const { t } = useTranslation();
  const {
    defaultFoodDataProviderId,
    setDefaultFoodDataProviderId,
    loggingLevel,
    itemDisplayLimit,
    foodDisplayLimit, // Add foodDisplayLimit here
    nutrientDisplayPreferences,
    energyUnit,
    convertEnergy,
    getEnergyUnitString,
    autoScaleOpenFoodFactsImports, // Add auto-scale preference
  } = usePreferences(); // Get loggingLevel, itemDisplayLimit, and foodDisplayLimit
  const isMobile = useIsMobile();
  const platform = isMobile ? 'mobile' : 'desktop';
  const [searchTerm, setSearchTerm] = useState('');
  const [meals, setMeals] = useState<Meal[]>([]); // New state for meal results
  const [openFoodFactsResults, setOpenFoodFactsResults] = useState<
    OpenFoodFactsProduct[]
  >([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [nutritionixResults, setNutritionixResults] = useState<any[]>([]); // To store Nutritionix search results
  const [fatSecretResults, setFatSecretResults] = useState<FatSecretFoodItem[]>(
    []
  ); // To store FatSe cret search results
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [usdaResults, setUsdaResults] = useState<any[]>([]); // To store USDA search results
  const getInitialActiveTab = () => {
    if (!hideDatabaseTab) return 'database';
    if (!hideMealTab) return 'meal';
    return 'online';
  };

  const [activeTab, setActiveTab] = useState<
    'database' | 'meal' | 'online' | 'barcode'
  >(getInitialActiveTab());
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<
    OpenFoodFactsProduct | Food | null
  >(null);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showAddFoodDialog, setShowAddFoodDialog] = useState(false); // New state for Add Food dialog
  const [showImportFromCsvDialog, setShowImportFromCsvDialog] = useState(false);
  const isSearchEmpty = !searchTerm.trim();
  const isDatabaseTab = activeTab === 'database';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [manualProviderId, setManualProviderId] = useState<string | null>(null);
  const [isOnlineLoading, setIsOnlineLoading] = useState(false);
  const [mealieTandoorResults, setMealieTandoorResults] = useState<Food[]>([]);

  const queryClient = useQueryClient();
  const { data: customNutrients } = useCustomNutrients();
  const { data: foodDataProviders = [] } = useExternalProvidersQuery();
  const { data: recentTopData, isFetching: isFetchingRecent } =
    useRecentAndTopFoodsQuery(
      itemDisplayLimit,
      mealType,
      isDatabaseTab && isSearchEmpty
    );
  const { mutateAsync: importCsvMutation } = useImportCsvMutation();
  const { data: searchData, isFetching: isFetchingSearch } =
    useDatabaseFoodSearchQuery(
      searchTerm,
      foodDisplayLimit,
      mealType,
      isDatabaseTab && !isSearchEmpty
    );

  const recentFoods = recentTopData?.recentFoods || [];
  const topFoods = recentTopData?.topFoods || [];
  const foods = searchData?.searchResults || [];
  const loading = isFetchingRecent || isFetchingSearch || isOnlineLoading;

  const selectedFoodDataProvider =
    manualProviderId ||
    defaultFoodDataProviderId ||
    foodDataProviders[0]?.id ||
    null;

  const [hasOnlineSearchBeenPerformed, setHasOnlineSearchBeenPerformed] =
    useState(false);

  // Debounce effect for database search
  useEffect(() => {
    const handler = setTimeout(() => {
      if (activeTab === 'meal') {
        handleMealSearch(searchTerm);
      }
    }, 500); // 500ms debounce delay

    return () => {
      clearTimeout(handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, activeTab]);

  const searchOpenFoodFacts = async () => {
    if (!searchTerm.trim()) return;

    const data = await queryClient.fetchQuery(
      searchOpenFoodFactsOptions(searchTerm)
    );

    if (data.products) {
      setOpenFoodFactsResults(
        data.products.filter(
          (p: OpenFoodFactsProduct) =>
            p.product_name && p.nutriments && p.nutriments['energy-kcal_100g']
        )
      );
    }
  };

  const searchOpenFoodFactsByBarcode = async (barcode: string) => {
    const data = await queryClient.fetchQuery(
      searchOpenFoodFactsBarcodeOptions(barcode)
    );

    if (data.status === 1 && data.product) {
      setOpenFoodFactsResults([data.product]);
      setActiveTab('online');
      toast({
        title: 'Barcode scanned successfully',
        description: `Found product: ${data.product.product_name}`,
      });
    } else {
      setOpenFoodFactsResults([]);
      toast({
        title: 'Product not found',
        description: 'No product found for this barcode on OpenFoodFacts.',
        variant: 'destructive',
      });
    }
  };

  const handleOpenFoodFactsEdit = (product: OpenFoodFactsProduct) => {
    setEditingProduct(product);
    setShowEditDialog(true);
  };

  const handleSaveEditedFood = async (foodData: Food) => {
    // foodData is now the fully saved food from EnhancedCustomFoodForm
    try {
      onFoodSelect(foodData, 'food');

      // Close dialog and clear state
      setShowEditDialog(false);
      setEditingProduct(null);

      toast({
        title: 'Food added',
        description: `${foodData.name} has been added and is ready to be added to your meal`,
      });
    } catch (error) {
      console.error('Error handling edited food:', error);
      toast({
        title: 'Error',
        description: 'Failed to process the edited food',
        variant: 'destructive',
      });
    }
  };

  const handleImportFromCSV = async (foodDataArray: FoodDataForBackend[]) => {
    try {
      await importCsvMutation(foodDataArray);
      setShowImportFromCsvDialog(false);
    } catch (error) {}
  };

  const handleMealSearch = useCallback(
    async (term: string) => {
      const results = await queryClient.fetchQuery(
        mealSearchOptions('all', term)
      );
      setMeals(results);
    },
    [queryClient]
  );

  const handleSearch = async () => {
    setIsOnlineLoading(true);
    setMealieTandoorResults([]); // Clear previous Mealie/Tandoor results
    setMeals([]); // Clear previous meal results
    setOpenFoodFactsResults([]);
    setNutritionixResults([]);
    setFatSecretResults([]);
    setUsdaResults([]); // Clear previous USDA results

    if (!searchTerm.trim()) {
      setIsOnlineLoading(false);
      return;
    }

    if (activeTab === 'meal') {
      await handleMealSearch(searchTerm);
    } else if (activeTab === 'online') {
      setHasOnlineSearchBeenPerformed(true);
      if (!selectedFoodDataProvider) {
        toast({
          title: 'Error',
          description: 'Please select a food data provider.',
          variant: 'destructive',
        });
        setIsOnlineLoading(false);
        return;
      }

      const provider = foodDataProviders.find(
        (p) => p.id === selectedFoodDataProvider
      );

      if (!provider || !selectedFoodDataProvider) {
        toast({
          title: 'Error',
          description: 'Please select a valid food data provider.',
          variant: 'destructive',
        });
        setIsOnlineLoading(false);
        return;
      }

      if (provider.provider_type === 'openfoodfacts') {
        await searchOpenFoodFacts();
      } else if (provider.provider_type === 'nutritionix') {
        const results = await queryClient.fetchQuery(
          searchNutritionixOptions(searchTerm, selectedFoodDataProvider)
        );
        setNutritionixResults(results);
      } else if (provider.provider_type === 'fatsecret') {
        const results = await queryClient.fetchQuery(
          searchFatSecretOptions(searchTerm, selectedFoodDataProvider)
        );
        setFatSecretResults(results);
      } else if (provider.provider_type === 'mealie') {
        const results = await queryClient.fetchQuery(
          searchMealieOptions(
            searchTerm,
            provider.base_url,
            provider.app_key,
            provider.id
          )
        );
        setMealieTandoorResults(results);
      } else if (provider.provider_type === 'tandoor') {
        const results = await queryClient.fetchQuery(
          searchTandoorOptions(
            searchTerm,
            provider.base_url,
            provider.app_key,
            provider.id
          )
        );
        setMealieTandoorResults(results);
      } else if (provider.provider_type === 'usda') {
        const results = await queryClient.fetchQuery(
          searchUsdaOptions(
            searchTerm,
            selectedFoodDataProvider,
            foodDisplayLimit
          )
        );
        setUsdaResults(results);
        debug(loggingLevel, 'USDA Search Results:', results);
      } else {
        toast({
          title: 'Error',
          description: 'Selected provider type is not supported for search.',
          variant: 'destructive',
        });
      }
    }
    setIsOnlineLoading(false);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleUsdaEdit = async (item: any) => {
    const nutrientData = await queryClient.fetchQuery(
      usdaFoodDetailsOptions(item.fdcId, selectedFoodDataProvider)
    );

    if (nutrientData) {
      setEditingProduct(convertUsdaToFood(item, nutrientData)); // Corrected: Convert to Food object here
      setShowEditDialog(true);
    } else {
      toast({
        title: 'Error',
        description: 'Failed to retrieve detailed nutrition for this item.',
        variant: 'destructive',
      });
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNutritionixEdit = async (item: any) => {
    let nutrientData;
    if (item.brand) {
      // It's a branded item, use nix_item_id to get full details
      nutrientData = await queryClient.fetchQuery(
        nutritionixBrandedNutrientsOptions(item.id, selectedFoodDataProvider)
      );
    } else {
      // It's a common item, use natural language query
      nutrientData = await queryClient.fetchQuery(
        nutritionixNaturalNutrientsOptions(item.name, selectedFoodDataProvider)
      );
    }

    if (nutrientData) {
      setEditingProduct(convertNutritionixToFood(item, nutrientData)); // Convert to Food object for editing
      setShowEditDialog(true);
    } else {
      toast({
        title: 'Error',
        description: 'Failed to retrieve detailed nutrition for this item.',
        variant: 'destructive',
      });
    }
  };

  const handleFatSecretEdit = async (item: FatSecretFoodItem) => {
    // Only fetch detailed nutrients when "Edit & Add" is clicked
    const nutrientData = await queryClient.fetchQuery(
      fatSecretNutrientOptions(item.food_id, selectedFoodDataProvider)
    );

    if (nutrientData) {
      setEditingProduct(convertFatSecretToFood(item, nutrientData));
      setShowEditDialog(true);
    } else {
      toast({
        title: 'Error',
        description: 'Failed to retrieve detailed nutrition for this item.',
        variant: 'destructive',
      });
    }
  };

  const handleMealieOrTandoorEdit = async (food: Food) => {
    const provider = foodDataProviders.find(
      (p) => p.id === selectedFoodDataProvider
    );
    if (!provider) {
      toast({
        title: 'Error',
        description: 'Could not find the selected food provider.',
        variant: 'destructive',
      });
      return;
    }

    // Since Mealie and Tandoor search results are already in the `Food` format,
    // we can directly use the food object for the edit dialog.
    setEditingProduct(food);
    setShowEditDialog(true);
  };

  const quickInfoPreferences =
    nutrientDisplayPreferences.find(
      (p) => p.view_group === 'quick_info' && p.platform === platform
    ) ||
    nutrientDisplayPreferences.find(
      (p) => p.view_group === 'quick_info' && p.platform === 'desktop'
    );

  const visibleNutrients = quickInfoPreferences
    ? quickInfoPreferences.visible_nutrients
    : DEFAULT_NUTRIENTS;

  const nutrientConfig = {
    visibleNutrients,
    energyUnit,
    convertEnergy,
    getEnergyUnitString,
    customNutrients: customNutrients || [],
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row flex-wrap gap-2">
        {!hideDatabaseTab && (
          <Button
            variant={activeTab === 'database' ? 'default' : 'outline'}
            onClick={() => setActiveTab('database')}
          >
            {t('enhancedFoodSearch.database', 'Database')}
          </Button>
        )}
        {!hideMealTab && (
          <Button
            variant={activeTab === 'meal' ? 'default' : 'outline'}
            onClick={() => setActiveTab('meal')}
          >
            <BookText className="w-4 h-4 mr-2" />
            {t('enhancedFoodSearch.meals', 'Meals')}
          </Button>
        )}
        <Button
          variant={activeTab === 'online' ? 'default' : 'outline'}
          onClick={() => setActiveTab('online')}
        >
          {t('enhancedFoodSearch.online', 'Online')}
        </Button>
        <Button
          variant={activeTab === 'barcode' ? 'default' : 'outline'}
          onClick={() => {
            setActiveTab('barcode');
            setShowBarcodeScanner(true);
          }}
        >
          <Camera className="w-4 h-4 mr-2" />{' '}
          {t('enhancedFoodSearch.scanBarcode', 'Scan Barcode')}
        </Button>
        <Button
          onClick={() => setShowAddFoodDialog(true)}
          className="whitespace-nowrap"
        >
          <Plus className="w-4 h-4 mr-2" />{' '}
          {t('enhancedFoodSearch.customFood', 'Custom Food')}
        </Button>
        <Button
          onClick={() => setShowImportFromCsvDialog(true)}
          className="whitespace-nowrap"
        >
          <Plus className="w-4 h-4 mr-2" />{' '}
          {t('enhancedFoodSearch.importFromCSV', 'Import from CSV')}
        </Button>
      </div>

      <div className="flex space-x-2 items-center">
        <Input
          placeholder={t(
            'enhancedFoodSearch.searchFoodsPlaceholder',
            'Search for foods...'
          )}
          value={searchTerm}
          autoFocus
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === 'Enter' &&
              (activeTab === 'online' || activeTab === 'barcode')
            ) {
              handleSearch();
            }
          }}
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </Button>
        {activeTab === 'online' && (
          <Select
            value={selectedFoodDataProvider || ''}
            onValueChange={(value) => {
              setManualProviderId(value);
              // Optionally, save the new default provider preference
              setDefaultFoodDataProviderId(value);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue
                placeholder={t(
                  'enhancedFoodSearch.selectProvider',
                  'Select Provider'
                )}
              />
            </SelectTrigger>
            <SelectContent>
              {foodDataProviders
                .filter(
                  (provider) =>
                    getProviderCategory(provider).includes('food') &&
                    provider.is_active
                )
                .map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {' '}
                    {/* Use provider.id for value */}
                    {provider.provider_name} {/* Display provider name */}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {loading && (
          <div className="text-center py-8 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
            {t('enhancedFoodSearch.searchingFoods', 'Searching foods...')}
          </div>
        )}

        {!loading && activeTab === 'database' && searchTerm.trim() === '' && (
          <>
            {recentFoods.map((food) => (
              <FoodResultCard
                key={food.id}
                item={food}
                activeUserId={activeUserId}
                nutrientConfig={nutrientConfig}
                onCardClick={() => onFoodSelect(food, 'food')}
                t={t}
              />
            ))}

            {topFoods.map((food) => (
              <FoodResultCard
                key={food.id}
                item={food}
                activeUserId={activeUserId}
                nutrientConfig={nutrientConfig}
                onCardClick={() => onFoodSelect(food, 'food')}
                t={t}
              />
            ))}

            {recentFoods.length === 0 && topFoods.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                {t(
                  'enhancedFoodSearch.noRecentOrTopFoods',
                  'No recent or top foods found. Start logging foods to see them here.'
                )}
              </div>
            )}
          </>
        )}

        {!loading &&
          activeTab === 'database' &&
          searchTerm.trim() !== '' &&
          foods.length === 0 &&
          meals.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {t('enhancedFoodSearch.noItemsFoundInDatabase', {
                searchTerm,
                defaultValue: `No items found in your database for "${searchTerm}".`,
              })}
            </div>
          )}

        {!loading &&
          activeTab === 'online' &&
          !hasOnlineSearchBeenPerformed && (
            <div className="text-center py-8 text-gray-500">
              {t(
                'enhancedFoodSearch.clickSearchIconOnline',
                'Click the search icon to search online.'
              )}
            </div>
          )}

        {!loading &&
          activeTab === 'online' &&
          hasOnlineSearchBeenPerformed &&
          openFoodFactsResults.length === 0 &&
          nutritionixResults.length === 0 &&
          fatSecretResults.length === 0 &&
          usdaResults.length === 0 &&
          foods.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {t(
                'enhancedFoodSearch.noFoodsFoundOnline',
                'No foods found from the selected online provider.'
              )}
            </div>
          )}

        {activeTab === 'online' &&
          mealieTandoorResults.length > 0 &&
          mealieTandoorResults.map((food) => (
            <FoodResultCard
              key={`${food.provider_type}-${food.provider_external_id}`}
              item={food}
              isOnline={true}
              providerLabel={
                food.provider_type === 'mealie'
                  ? t('enhancedFoodSearch.mealie', 'Mealie')
                  : t('enhancedFoodSearch.tandoor', 'Tandoor')
              }
              nutrientConfig={nutrientConfig}
              onEditClick={() => handleMealieOrTandoorEdit(food)}
              t={t}
            />
          ))}

        {activeTab === 'meal' &&
          meals.map((meal) => (
            <FoodResultCard
              key={meal.id}
              item={meal}
              isMeal={true}
              nutrientConfig={nutrientConfig}
              onCardClick={() => onFoodSelect(meal, 'meal')}
              t={t}
            />
          ))}

        {activeTab === 'database' &&
          searchTerm.trim() !== '' &&
          foods.map((food) => (
            <FoodResultCard
              key={food.id}
              item={food}
              activeUserId={activeUserId}
              nutrientConfig={nutrientConfig}
              onCardClick={() => onFoodSelect(food, 'food')}
              t={t}
            />
          ))}
        {activeTab === 'online' &&
          openFoodFactsResults.length > 0 &&
          openFoodFactsResults.map((product) => {
            // Calculate display values based on auto-scaling preference
            const shouldScale =
              autoScaleOpenFoodFactsImports &&
              product.serving_quantity &&
              product.serving_quantity > 0;
            const servingSize = shouldScale ? product.serving_quantity! : 100;
            const scaleFactor = shouldScale ? servingSize / 100 : 1;

            return (
              <Card
                key={product.code}
                className="hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="font-medium">{product.product_name}</h3>
                        {product.brands && (
                          <Badge variant="secondary" className="text-xs">
                            {product.brands.split(',')[0]}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {t(
                            'enhancedFoodSearch.openFoodFacts',
                            'OpenFoodFacts'
                          )}
                        </Badge>
                      </div>
                      <NutrientGrid
                        food={{
                          calories: Math.round(
                            (product.nutriments['energy-kcal_100g'] || 0) *
                              scaleFactor
                          ),
                          protein:
                            Math.round(
                              (product.nutriments['proteins_100g'] || 0) *
                                scaleFactor *
                                10
                            ) / 10,
                          carbs:
                            Math.round(
                              (product.nutriments['carbohydrates_100g'] || 0) *
                                scaleFactor *
                                10
                            ) / 10,
                          fat:
                            Math.round(
                              (product.nutriments['fat_100g'] || 0) *
                                scaleFactor *
                                10
                            ) / 10,
                          dietary_fiber:
                            Math.round(
                              (product.nutriments['fiber_100g'] || 0) *
                                scaleFactor *
                                10
                            ) / 10,
                          // For OpenFoodFacts, GI is not directly available in product.nutriments,
                          // so we'll display "None" or handle it as a special case.
                          glycemic_index: 'None',
                        }}
                        visibleNutrients={visibleNutrients}
                        energyUnit={energyUnit}
                        convertEnergy={convertEnergy}
                        getEnergyUnitString={getEnergyUnitString}
                        customNutrients={customNutrients}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Per {servingSize}g
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleOpenFoodFactsEdit(product)}
                      className="ml-2"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      {t('enhancedFoodSearch.editAndAdd', 'Edit & Add')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        {activeTab === 'online' &&
          nutritionixResults.length > 0 &&
          nutritionixResults.map((item) => (
            <Card
              key={item.id}
              className="hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="font-medium">{item.name}</h3>
                      {item.brand && (
                        <Badge variant="secondary" className="text-xs">
                          {item.brand}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {t('enhancedFoodSearch.nutritionix', 'Nutritionix')}
                      </Badge>
                    </div>
                    {item.image && (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-16 h-16 object-cover rounded-md mr-4"
                      />
                    )}
                    {item.calories && (
                      <NutrientGrid
                        food={item}
                        visibleNutrients={visibleNutrients}
                        energyUnit={energyUnit}
                        convertEnergy={convertEnergy}
                        getEnergyUnitString={getEnergyUnitString}
                        customNutrients={customNutrients}
                      />
                    )}
                    {item.serving_size && item.serving_unit && (
                      <p className="text-xs text-gray-500 mt-1">
                        Per {item.serving_size}
                        {item.serving_unit}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleNutritionixEdit(item)}
                    className="ml-2"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    {t('enhancedFoodSearch.editAndAdd', 'Edit & Add')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        {activeTab === 'online' &&
          fatSecretResults.length > 0 &&
          fatSecretResults.map((item) => (
            <Card
              key={item.food_id}
              className="hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="font-medium">{item.food_name}</h3>
                      {item.brand_name && (
                        <Badge variant="secondary" className="text-xs">
                          {item.brand_name}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {t('enhancedFoodSearch.fatSecret', 'FatSecret')}
                      </Badge>
                    </div>
                    {item.calories !== undefined &&
                      item.protein !== undefined &&
                      item.carbs !== undefined &&
                      item.fat !== undefined && (
                        <NutrientGrid
                          food={item}
                          visibleNutrients={visibleNutrients}
                          energyUnit={energyUnit}
                          convertEnergy={convertEnergy}
                          getEnergyUnitString={getEnergyUnitString}
                          customNutrients={customNutrients}
                        />
                      )}
                    {item.serving_size && item.serving_unit && (
                      <p className="text-xs text-gray-500 mt-1">
                        Per {item.serving_size}
                        {item.serving_unit}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleFatSecretEdit(item)}
                    className="ml-2"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    {t('enhancedFoodSearch.editAndAdd', 'Edit & Add')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        {activeTab === 'online' &&
          usdaResults.length > 0 &&
          usdaResults.map((item) => (
            <Card
              key={item.fdcId}
              className="hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="font-medium">{item.description}</h3>
                      {item.brandOwner && (
                        <Badge variant="secondary" className="text-xs">
                          {item.brandOwner}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {t('enhancedFoodSearch.usda', 'USDA')}
                      </Badge>
                    </div>
                    {item.foodNutrients && (
                      <NutrientGrid
                        food={formatUsdaNutrientsForDisplay(item, loggingLevel)}
                        visibleNutrients={visibleNutrients}
                        energyUnit={energyUnit}
                        convertEnergy={convertEnergy}
                        getEnergyUnitString={getEnergyUnitString}
                        customNutrients={customNutrients}
                      />
                    )}
                    {item.servingSize && item.servingSizeUnit && (
                      <p className="text-xs text-gray-500 mt-1">
                        Per {item.servingSize}
                        {item.servingSizeUnit}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleUsdaEdit(item)}
                    className="ml-2"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    {t('enhancedFoodSearch.editAndAdd', 'Edit & Add')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>
      <FoodFormDialog
        isOpen={showEditDialog}
        onOpenChange={setShowEditDialog}
        mode="edit"
        editingProduct={editingProduct}
        autoScaleOpenFoodFactsImports={autoScaleOpenFoodFactsImports}
        onSave={handleSaveEditedFood}
      />
      <FoodFormDialog
        isOpen={showAddFoodDialog}
        onOpenChange={setShowAddFoodDialog}
        mode="add"
        autoScaleOpenFoodFactsImports={autoScaleOpenFoodFactsImports}
        onSave={handleSaveEditedFood}
      />
      <BarcodeScannerDialog
        isOpen={showBarcodeScanner}
        onOpenChange={setShowBarcodeScanner}
        onBarcodeDetected={(barcode) => {
          searchOpenFoodFactsByBarcode(barcode);
          setShowBarcodeScanner(false);
        }}
      />
      <CsvImportDialog
        isOpen={showImportFromCsvDialog}
        onOpenChange={setShowImportFromCsvDialog}
        onSave={handleImportFromCSV}
      />
    </div>
  );
};

export default EnhancedFoodSearch;
