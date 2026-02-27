export interface AIService {
  id: string;
  service_name: string;
  service_type: string;
  api_key?: string; // Temporarily holds plain text key from user for new/update operations, not received from backend.
  custom_url: string | null;
  system_prompt: string | null;
  is_active: boolean;
  model_name?: string;
  custom_model_name?: string; // Add custom_model_name to AIService interface
  is_public?: boolean; // Indicates if this is a public setting
  source?: 'user' | 'global' | 'environment'; // Indicates the source of the setting
}

export interface UserPreferencesChat {
  auto_clear_history: string;
}

export interface DataProvider {
  id: string;
  name: string;
  provider_type: string; // e.g., 'wger', 'fatsecret', 'openfoodfacts', 'nutritionix'
  provider_name: string; // e.g., 'Wger', 'FatSecret' (for display and value)
  is_active: boolean; // Changed from is_enabled to is_active
  has_token?: boolean;
  shared_with_public?: boolean;
  is_strictly_private?: boolean;
  base_url?: string;
  app_key: string;
}
