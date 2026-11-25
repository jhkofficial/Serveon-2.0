import type { CustomerRecord, IndustryId, RiskCategory } from './platform';

export type CustomerMarkerGroup =
  | 'active'
  | 'high_value'
  | 'growth'
  | 'at_risk'
  | 'inactive';

export type MapDisplayMode =
  | 'points'
  | 'clusters'
  | 'heatmap_density'
  | 'heatmap_value'
  | 'heatmap_risk'
  | 'dealer_coverage'
  | 'competitor_analysis'
  | 'opportunity';

export type GeolocationStatus =
  | 'VERIFIED_ADDRESS'
  | 'VERIFIED_POINT'
  | 'APPROXIMATE_LOCATION'
  | 'SIMULATED_VALID_LAND_POINT'
  | 'INVALID_LOCATION'
  | 'NOT_GEOCODED';

export type CoordinateValidationStatus = 'VALID' | 'INVALID' | 'MISSING';
export type LandValidationStatus = 'ON_LAND' | 'IN_SEA_OR_WATER' | 'UNAVAILABLE';
export type TerritoryValidationStatus = 'INSIDE_TERRITORY' | 'OUTSIDE_TERRITORY' | 'UNAVAILABLE';

export interface GeoViewportBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface CustomerMapCounts {
  total: number;
  mapped: number;
  visible: number;
  unmapped: number;
  invalid: number;
  notGeocoded: number;
}

export interface GeolocationQualitySummary {
  totalCustomers: number;
  geocodedCustomers: number;
  validatedLandPoints: number;
  verifiedAddressPoints: number;
  approximateLocations: number;
  invalidCoordinates: number;
  unmappedCustomers: number;
  plottableCustomers: number;
  offshoreRejectedCount: number;
  outsideTerritoryRejectedCount: number;
  lastValidatedAt: string;
}

export interface ForwardGeocodingRequest {
  sourceAddress: string;
  village: string;
  district: string;
  city: string;
  province: string;
  postalCode: string;
}

export interface ForwardGeocodingResult {
  serviceConnected: boolean;
  statusMessage: string;
  providerName: string;
  latitude: number | null;
  longitude: number | null;
  quality: GeolocationStatus;
  matchedAddress: string;
  confidence: number;
  caveat: string;
}

export interface ReverseGeocodingResult {
  serviceConnected: boolean;
  statusMessage: string;
  providerName: string;
  latitude: number;
  longitude: number;
  approximateAddress: string;
  village: string;
  district: string;
  city: string;
  province: string;
  postalCode: string;
  landStatus: LandValidationStatus;
  territoryStatus: TerritoryValidationStatus;
  cached: boolean;
  caveat: string;
}

export type CompetitorFilterMode = 'all' | 'dealer' | 'service' | 'none';

export type DrawingToolMode = 'none' | 'rectangle' | 'polygon' | 'radius' | 'measure';

export type NetworkNodeCategory = 'dealer' | 'service' | 'branch';

export interface GeocodedCustomer {
  customer_id: string;
  pseudonym_code: string;
  tenant_id: string;
  business_unit_id: string;
  customer_segment: CustomerRecord['customer_segment'];
  status: CustomerRecord['status'];
  lifecycle_stage: CustomerRecord['lifecycle_stage'];

  /** Validated WGS-84 EPSG:4326 latitude (null when NOT_GEOCODED) */
  latitude: number | null;
  /** Validated WGS-84 EPSG:4326 longitude (null when NOT_GEOCODED) */
  longitude: number | null;
  /** Raw source coordinate retained for audit when quarantined as INVALID_LOCATION */
  raw_source_latitude?: number | null;
  raw_source_longitude?: number | null;

  /** Structured address metadata — never fabricated as a real residential street address */
  address_line: string;
  village_name: string;
  district_name: string;
  city_name: string;
  province_name: string;
  postal_code: string;
  reverse_geocoded_address: string | null;

  /** Geolocation provenance & quality metadata */
  geolocation_source: string;
  geolocation_method: string;
  geolocation_accuracy: string;
  geolocation_confidence: number; // 0-100
  geolocation_status: GeolocationStatus;

  /** Explicit geospatial validation check outcomes */
  coordinate_validation_status: CoordinateValidationStatus;
  land_validation_status: LandValidationStatus;
  territory_validation_status: TerritoryValidationStatus;
  validation_issue: string | null;
  /** True only when coordinate passed WGS-84 + Land Mask + Territory checks and is safe to plot */
  is_plottable: boolean;

  geocoded_at: string | null;
  last_verified_at: string;

  /** Legacy compatibility fields */
  location_accuracy: string;
  location_source: string;

  last_purchase_date: string;
  last_service_date: string;
  days_since_last_service: number;
  lifetime_value: number;
  churn_risk: number;
  churn_risk_category: RiskCategory;
  purchase_propensity: number;
  geographic_opportunity_score: number;
  assigned_dealer_id: string;
  assigned_dealer_name: string;
  assigned_dealer_distance_km: number;
  nearest_dealer_id: string;
  nearest_dealer_name: string;
  nearest_dealer_distance_km: number;
  region_id: string;
  region_name: string;
  district_id: string;
  village_id: string;
  product_primary: string;
  preferred_channel: string;
  latest_interaction_summary: string;
  marker_group: CustomerMarkerGroup;
  has_consent: boolean;
  opted_out: boolean;
  suppressed: boolean;
}

export interface DealerNetworkNode {
  dealer_id: string;
  tenant_id: string;
  business_unit_id: string;
  region_id: string;
  region_name: string;
  district_id: string;
  code: string;
  name: string;
  dealer_type: string;
  network_category: NetworkNodeCategory;
  address: string;
  operational_status: 'Operational' | 'High Load' | 'Express Active';
  latitude: number;
  longitude: number;
  service_capacity_pct: number;
  service_volume_monthly: number;
  assigned_customers: number;
  default_coverage_km: number;
}

export interface CompetitorLocation {
  competitor_id: string;
  tenant_id: string;
  region_id: string;
  region_name: string;
  competitor_brand: string;
  competitor_category: 'dealer' | 'service';
  category_label: string;
  location_name: string;
  latitude: number;
  longitude: number;
  address: string;
  location_source: 'Illustrative Synthetic Reference Data (Demo Only)';
  last_verified_date: string;
}

export interface GeoClusterNode {
  id: string;
  label: string;
  regionId: string;
  /** Guaranteed on-land cluster display position (never mutates customer coordinates) */
  latitude: number;
  longitude: number;
  /** Raw mathematical centroid preserved for inspection & transparency */
  centroid_latitude: number;
  centroid_longitude: number;
  display_method:
    | 'On-Land Mathematical Centroid'
    | 'Nearest Valid On-Land Member Anchor (Coastal-Safe)';
  centroid_was_over_water: boolean;
  count: number;
  totalLtv: number;
  atRiskCount: number;
  highValueCount: number;
  avgChurnRisk: number;
  bounds: [[number, number], [number, number]];
  customerIds: string[];
}

export interface CoverageOverlapItem {
  dealer_id: string;
  dealer_name: string;
  distance_km: number;
  shared_customer_count: number;
}

export interface CoverageAnalysisResult {
  dealer_id: string;
  dealer_name: string;
  dealer_type: string;
  radius_km: number;
  inside_customers: GeocodedCustomer[];
  outside_customers: GeocodedCustomer[];
  inside_count: number;
  outside_count: number;
  inside_ltv: number;
  inside_at_risk_count: number;
  coverage_rate_pct: number;
  avg_distance_inside_km: number;
  avg_distance_all_km: number;
  overlapping_dealers: CoverageOverlapItem[];
}

export interface CustomerToDealerInsights {
  near_dealer_count: number;
  outside_coverage_count: number;
  assigned_non_nearest_count: number;
  overlapping_catchment_count: number;
  threshold_km: number;
}

export type GeoSelectionGeometry =
  | {
      type: 'rectangle';
      bounds: [[number, number], [number, number]]; // [[south, west], [north, east]]
    }
  | {
      type: 'polygon';
      points: Array<[number, number]>;
    }
  | {
      type: 'radius';
      center: [number, number];
      radiusKm: number;
    };

export interface GeoSelectionSummary {
  label: string;
  geometry: GeoSelectionGeometry;
  matching_customers: GeocodedCustomer[];
  matching_count: number;
  eligible_consented_count: number;
  total_ltv: number;
  at_risk_count: number;
  segment_distribution: Array<{ segment: string; count: number; sharePct: number }>;
  nearby_dealers: DealerNetworkNode[];
  nearby_competitors: CompetitorLocation[];
  approx_coverage_rate_pct: number;
  dominant_region_id: string;
}

export interface OpportunityWeights {
  concentration: number; // default 25
  growthPotential: number; // default 20
  atRiskDensity: number; // default 20
  coverageGap: number; // default 20
  competitorProximity: number; // default 15
}

export type OpportunityGapCategory =
  | 'High Potential / Low Coverage'
  | 'High Customer Density / High Competition'
  | 'High Retention Risk'
  | 'Strong Coverage / Growth Opportunity'
  | 'Underserved Territories';

export interface OpportunityGapZone {
  region_id: string;
  region_name: string;
  category: OpportunityGapCategory;
  category_code: 'A' | 'B' | 'C' | 'D' | 'E';
  composite_score: number;
  customer_count: number;
  at_risk_count: number;
  dealer_count: number;
  competitor_count: number;
  coverage_rate_pct: number;
  avg_nearest_dealer_km: number;
  factors: {
    concentrationScore: number;
    growthPotentialScore: number;
    atRiskDensityScore: number;
    coverageGapScore: number;
    competitorProximityScore: number;
  };
  explanation: string;
  recommended_strategy: 'RETAIN' | 'DEFEND' | 'DEVELOP' | 'ACQUIRE';
  recommended_action: string;
  data_coverage_status: string;
}

export interface GeoLayerVisibility {
  customerPoints: boolean;
  customerClusters: boolean;
  atRiskHighlight: boolean;
  highValueHighlight: boolean;
  dealers: boolean;
  serviceCenters: boolean;
  branches: boolean;
  competitorMode: CompetitorFilterMode;
  coverageRadius: boolean;
  uncoveredHighlight: boolean;
  customerToDealerLines: boolean;
  territoryBoundaries: boolean;
  opportunityOverlay: boolean;
}

export interface GeoFilterState {
  searchQuery: string;
  segment: string;
  purchaseStatus: 'ALL' | 'Recent' | 'Standard' | 'Lapsed';
  serviceStatus: 'ALL' | 'Current' | 'Due Soon' | 'Overdue';
  churnRisk: 'ALL' | RiskCategory;
  valueTier: 'ALL' | 'High' | 'Mid' | 'Standard';
  productOwnership: string;
  assignedDealerId: string;
  onlyOutsideCoverage: boolean;
  geolocationStatus: 'ALL' | GeolocationStatus;
}

export interface SavedMapView {
  id: string;
  name: string;
  description: string;
  regionId: string;
  districtId: string;
  mapMode: MapDisplayMode;
  radiusKm: number;
  layers: Partial<GeoLayerVisibility>;
  filters: Partial<GeoFilterState>;
  isPreset?: boolean;
}

export interface IndustryGeoConfig {
  industryId: IndustryId;
  customerLabel: string;
  customerPlural: string;
  dealerLabel: string;
  dealerPlural: string;
  serviceLabel: string;
  servicePlural: string;
  branchLabel: string;
  competitorDealerLabel: string;
  competitorServiceLabel: string;
  serviceStatusLabel: string;
  productFilterLabel: string;
  competitorBrands: string[];
  defaultRadiusKm: number;
}
