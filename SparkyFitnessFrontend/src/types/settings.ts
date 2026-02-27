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
