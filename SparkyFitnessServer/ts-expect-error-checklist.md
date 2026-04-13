## `@ts-expect-error` Burn-down Checklist (SparkyFitnessServer)

This file tracks progress removing TypeScript suppressions without introducing `any` or `as unknown as`.

### Wave_1_tests (target ~200)

| File | Start count | Batch | Status | Notes |
| --- | ---: | --- | --- | --- |
| `tests/foodCoreService.updateSnapshot.test.ts` | 40 | A | done | removed mock-related suppressions |
| `tests/barcodeLookupRoute.test.ts` | 8 | A | done | replaced with typed mocks and middleware signatures |
| `tests/foodRoutesV2.test.ts` | 3 | A | done | typed router module extraction and mocks |
| `tests/check_routes.ts` | 1 | A | done | replaced with runtime endpoint shape guard |
| `tests/labelScanService.test.ts` | 37 | B | pending |  |
| `tests/labelScanRoute.test.ts` | 6 | B | pending |  |
| `tests/openFoodFactsLanguage.test.ts` | 8 | B | pending |  |
| `tests/fatsecretService.test.ts` | 23 | C | pending |  |
| `tests/openFoodFactsService.test.ts` | 23 | C | pending |  |
| `tests/measurementService.healthConnectSleepStages.test.ts` | 3 | C | pending |  |
| `tests/mealRoutes.test.ts` | 21 | D | pending |  |
| `tests/measurementService.timezone.test.ts` | 20 | D | pending |  |
| `tests/dateShifting.test.ts` | 4 | D | pending |  |
| `tests/oidcProviderRepository.test.ts` | 3 | D | pending |  |

