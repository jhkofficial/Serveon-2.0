import type { ProvinceMapConfig, TerritoryGeoPolygon } from '../../data/geo/indonesiaGeo';
import type {
  CoordinateValidationStatus,
  ForwardGeocodingRequest,
  ForwardGeocodingResult,
  GeocodedCustomer,
  GeolocationQualitySummary,
  LandValidationStatus,
  ReverseGeocodingResult,
  TerritoryValidationStatus,
} from '../../types/geospatial';

export interface PointValidationResult {
  coordinateStatus: CoordinateValidationStatus;
  landStatus: LandValidationStatus;
  territoryStatus: TerritoryValidationStatus;
  isValidLandPoint: boolean;
  seaBodyName: string | null;
  issueDescription: string | null;
}

const reverseGeocodeCache = new Map<string, ReverseGeocodingResult>();

function fnv1aHash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededUnit(key: string): number {
  return (fnv1aHash(key) % 100000) / 100000;
}

/** Exact ray-casting point-in-polygon check in WGS-84 (EPSG:4326) [lat, lng] */
export function pointInPolygonRing(
  lat: number,
  lng: number,
  ring: Array<[number, number]>
): boolean {
  if (ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i][0];
    const xi = ring[i][1];
    const yj = ring[j][0];
    const xj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Validate WGS-84 numeric range and reject (0, 0) / NaN / reversed coordinates */
export function isValidWgs84Coordinate(
  lat: number | null | undefined,
  lng: number | null | undefined
): lat is number {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) return false;
  return true;
}

/**
 * Full 5-step EPSG:4326 validation pipeline:
 * 1. Coordinate validity
 * 2. Sea / water body exclusion check
 * 3. Province terrestrial land mask check
 * 4. Assigned administrative territory containment check
 * 5. Structured diagnostic result (never fabricates a pass if geometry unavailable)
 */
export function validatePointAgainstLandAndTerritory(
  lat: number | null | undefined,
  lng: number | null | undefined,
  provinceGeo: ProvinceMapConfig | null | undefined,
  assignedRegionId?: string
): PointValidationResult {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return {
      coordinateStatus: 'MISSING',
      landStatus: 'UNAVAILABLE',
      territoryStatus: 'UNAVAILABLE',
      isValidLandPoint: false,
      seaBodyName: null,
      issueDescription: 'Customer record has not been geocoded (missing latitude/longitude).',
    };
  }

  if (!isValidWgs84Coordinate(lat, lng)) {
    return {
      coordinateStatus: 'INVALID',
      landStatus: 'UNAVAILABLE',
      territoryStatus: 'UNAVAILABLE',
      isValidLandPoint: false,
      seaBodyName: null,
      issueDescription: `Invalid WGS-84 coordinate (${String(lat)}, ${String(lng)}).`,
    };
  }

  // Indonesia geographic sanity check (catches reversed lat/lng immediately)
  if (lat < -11.5 || lat > 6.5 || lng < 94.5 || lng > 141.5) {
    return {
      coordinateStatus: 'INVALID',
      landStatus: 'UNAVAILABLE',
      territoryStatus: 'OUTSIDE_TERRITORY',
      isValidLandPoint: false,
      seaBodyName: null,
      issueDescription:
        'Coordinate falls outside Indonesia WGS-84 extent (possible reversed lat/lng or corrupt source data).',
    };
  }

  if (!provinceGeo || provinceGeo.landMaskPolygons.length === 0) {
    return {
      coordinateStatus: 'VALID',
      landStatus: 'UNAVAILABLE',
      territoryStatus: 'UNAVAILABLE',
      isValidLandPoint: false,
      seaBodyName: null,
      issueDescription: 'Trusted terrestrial land mask unavailable for this province.',
    };
  }

  // Check explicit offshore sea / water body exclusion polygons FIRST
  for (const sea of provinceGeo.seaExclusionPolygons) {
    if (pointInPolygonRing(lat, lng, sea.ring)) {
      return {
        coordinateStatus: 'VALID',
        landStatus: 'IN_SEA_OR_WATER',
        territoryStatus: 'OUTSIDE_TERRITORY',
        isValidLandPoint: false,
        seaBodyName: sea.name,
        issueDescription: `Coordinate falls offshore inside ${sea.name} — rejected by terrestrial land mask.`,
      };
    }
  }

  // Check terrestrial land mask containment
  const onLand = provinceGeo.landMaskPolygons.some((ring) =>
    pointInPolygonRing(lat, lng, ring)
  );
  if (!onLand) {
    return {
      coordinateStatus: 'VALID',
      landStatus: 'IN_SEA_OR_WATER',
      territoryStatus: 'OUTSIDE_TERRITORY',
      isValidLandPoint: false,
      seaBodyName: 'Outside Permitted Terrestrial Land Mask',
      issueDescription:
        'Coordinate falls outside permitted province terrestrial land mask (potential coastal/water overshoot).',
    };
  }

  // Check administrative territory containment
  if (assignedRegionId) {
    const territory = provinceGeo.territories.find((t) => t.regionId === assignedRegionId);
    if (!territory) {
      return {
        coordinateStatus: 'VALID',
        landStatus: 'ON_LAND',
        territoryStatus: 'UNAVAILABLE',
        isValidLandPoint: false,
        seaBodyName: null,
        issueDescription: `Administrative boundary polygon unavailable for territory ${assignedRegionId}.`,
      };
    }
    const inTerritory = pointInPolygonRing(lat, lng, territory.coordinates);
    if (!inTerritory) {
      return {
        coordinateStatus: 'VALID',
        landStatus: 'ON_LAND',
        territoryStatus: 'OUTSIDE_TERRITORY',
        isValidLandPoint: false,
        seaBodyName: null,
        issueDescription: `Coordinate is on land but falls outside assigned territory (${territory.name}).`,
      };
    }
  }

  return {
    coordinateStatus: 'VALID',
    landStatus: 'ON_LAND',
    territoryStatus: 'INSIDE_TERRITORY',
    isValidLandPoint: true,
    seaBodyName: null,
    issueDescription: null,
  };
}

/**
 * Constrained deterministic terrestrial point generator.
 * Replaces unrestricted bounding-box / polar random generation.
 *
 * Samples strictly inside: (Territory Polygon) ∩ (Province Land Mask) \ (Sea Exclusion Polygons)
 * using deterministic rejection sampling anchored to the district/village terrestrial anchor.
 */
export function generateValidatedTerrestrialPoint(params: {
  seedKey: string;
  provinceGeo: ProvinceMapConfig;
  territory: TerritoryGeoPolygon;
  anchorLat: number;
  anchorLng: number;
  preferOuterRing?: boolean;
  isCompactMetro?: boolean;
}): { latitude: number; longitude: number; validation: PointValidationResult } {
  const {
    seedKey,
    provinceGeo,
    territory,
    anchorLat,
    anchorLng,
    preferOuterRing = false,
    isCompactMetro = false,
  } = params;

  // Deterministic radial rings around the terrestrial district/village anchor,
  // rejecting ANY candidate that crosses into sea or outside the territory polygon.
  const baseAttempts = 36;
  const uRing = seededUnit(`${seedKey}-ring`);
  const innerCutoff = preferOuterRing ? 0.42 : 0.56;
  const midCutoff = preferOuterRing ? 0.74 : 0.86;

  const targetRadiusKm =
    uRing < innerCutoff
      ? isCompactMetro
        ? 0.3 + seededUnit(`${seedKey}-r0`) * 1.9
        : 0.45 + seededUnit(`${seedKey}-r0`) * 3.1
      : uRing < midCutoff
        ? isCompactMetro
          ? 2.2 + seededUnit(`${seedKey}-r1`) * 2.1
          : 3.6 + seededUnit(`${seedKey}-r1`) * 3.6
        : isCompactMetro
          ? 4.3 + seededUnit(`${seedKey}-r2`) * 2.2
          : 7.2 + seededUnit(`${seedKey}-r2`) * 4.2;

  for (let attempt = 0; attempt < baseAttempts; attempt++) {
    // Gradually contract radius on retries so coastal anchors naturally settle inland onto dry land
    const shrink = attempt < 12 ? 1 : attempt < 24 ? 0.62 : 0.3;
    const distKm = targetRadiusKm * shrink;
    const angle = seededUnit(`${seedKey}-ang-${attempt}`) * Math.PI * 2;
    const dLat = (distKm / 111.32) * Math.cos(angle);
    const dLng = (distKm / (111.32 * Math.cos((anchorLat * Math.PI) / 180))) * Math.sin(angle);

    const candLat = Number((anchorLat + dLat).toFixed(5));
    const candLng = Number((anchorLng + dLng).toFixed(5));
    const check = validatePointAgainstLandAndTerritory(
      candLat,
      candLng,
      provinceGeo,
      territory.regionId
    );
    if (check.isValidLandPoint) {
      return { latitude: candLat, longitude: candLng, validation: check };
    }
  }

  // Guaranteed deterministic fallback: inland anchor or verified territory center
  const anchorCheck = validatePointAgainstLandAndTerritory(
    anchorLat,
    anchorLng,
    provinceGeo,
    territory.regionId
  );
  if (anchorCheck.isValidLandPoint) {
    return {
      latitude: Number(anchorLat.toFixed(5)),
      longitude: Number(anchorLng.toFixed(5)),
      validation: anchorCheck,
    };
  }

  const centerLat = Number(territory.center[0].toFixed(5));
  const centerLng = Number(territory.center[1].toFixed(5));
  return {
    latitude: centerLat,
    longitude: centerLng,
    validation: validatePointAgainstLandAndTerritory(
      centerLat,
      centerLng,
      provinceGeo,
      territory.regionId
    ),
  };
}

/**
 * Validate every customer in a dataset without mutating invalid records or silently snapping them.
 */
export function validateAllCustomerLocations(
  customers: GeocodedCustomer[],
  provinceGeo: ProvinceMapConfig,
  verifiedTimestamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
): GeocodedCustomer[] {
  return customers.map((c) => {
    if (c.geolocation_status === 'NOT_GEOCODED' || c.latitude === null || c.longitude === null) {
      return {
        ...c,
        coordinate_validation_status: 'MISSING',
        land_validation_status: 'UNAVAILABLE',
        territory_validation_status: 'UNAVAILABLE',
        geolocation_status: 'NOT_GEOCODED',
        validation_issue: 'Customer has no geocoded coordinates (Location Not Available).',
        is_plottable: false,
        last_verified_at: verifiedTimestamp,
      };
    }

    const check = validatePointAgainstLandAndTerritory(
      c.latitude,
      c.longitude,
      provinceGeo,
      c.region_id
    );

    if (!check.isValidLandPoint) {
      return {
        ...c,
        coordinate_validation_status: check.coordinateStatus,
        land_validation_status: check.landStatus,
        territory_validation_status: check.territoryStatus,
        geolocation_status: 'INVALID_LOCATION',
        validation_issue: check.issueDescription ?? 'Failed geographic validation.',
        is_plottable: false,
        last_verified_at: verifiedTimestamp,
      };
    }

    return {
      ...c,
      coordinate_validation_status: check.coordinateStatus,
      land_validation_status: check.landStatus,
      territory_validation_status: check.territoryStatus,
      geolocation_status:
        c.geolocation_status === 'INVALID_LOCATION'
          ? 'SIMULATED_VALID_LAND_POINT'
          : c.geolocation_status,
      validation_issue: null,
      is_plottable: true,
      last_verified_at: verifiedTimestamp,
    };
  });
}

/** Compute exact reconciled Geolocation Data Quality metrics directly from the dataset */
export function computeGeolocationQualitySummary(
  customers: GeocodedCustomer[]
): GeolocationQualitySummary {
  let geocodedCustomers = 0;
  let validatedLandPoints = 0;
  let verifiedAddressPoints = 0;
  let approximateLocations = 0;
  let invalidCoordinates = 0;
  let unmappedCustomers = 0;
  let plottableCustomers = 0;
  let offshoreRejectedCount = 0;
  let outsideTerritoryRejectedCount = 0;
  let lastValidatedAt = '2026-11-24 08:00';

  for (const c of customers) {
    if (c.last_verified_at && c.last_verified_at > lastValidatedAt) {
      lastValidatedAt = c.last_verified_at;
    }

    if (c.geolocation_status === 'NOT_GEOCODED' || c.coordinate_validation_status === 'MISSING') {
      unmappedCustomers++;
      continue;
    }

    geocodedCustomers++;

    if (c.geolocation_status === 'INVALID_LOCATION' || !c.is_plottable) {
      invalidCoordinates++;
      if (c.land_validation_status === 'IN_SEA_OR_WATER') offshoreRejectedCount++;
      else if (c.territory_validation_status === 'OUTSIDE_TERRITORY') {
        outsideTerritoryRejectedCount++;
      }
      continue;
    }

    plottableCustomers++;
    if (c.land_validation_status === 'ON_LAND') {
      validatedLandPoints++;
    }
    if (c.geolocation_status === 'VERIFIED_ADDRESS') {
      verifiedAddressPoints++;
    } else if (c.geolocation_status === 'APPROXIMATE_LOCATION') {
      approximateLocations++;
    }
  }

  return {
    totalCustomers: customers.length,
    geocodedCustomers,
    validatedLandPoints,
    verifiedAddressPoints,
    approximateLocations,
    invalidCoordinates,
    unmappedCustomers,
    plottableCustomers,
    offshoreRejectedCount,
    outsideTerritoryRejectedCount,
    lastValidatedAt,
  };
}

/**
 * Forward Geocoding Workflow:
 * Honest provider check — never fabricates a verified street coordinate when no geocoder API is connected.
 */
export function runForwardGeocoding(
  request: ForwardGeocodingRequest,
  provinceGeo: ProvinceMapConfig,
  options?: { allowSyntheticTerritoryFallback?: boolean }
): ForwardGeocodingResult {
  const allowFallback = Boolean(options?.allowSyntheticTerritoryFallback);

  if (!allowFallback) {
    return {
      serviceConnected: false,
      statusMessage: 'Geocoding Service Not Connected',
      providerName: 'No External Geocoder Configured (Approved Provider Required)',
      latitude: null,
      longitude: null,
      quality: 'NOT_GEOCODED',
      matchedAddress: 'Unavailable — External Forward Geocoding Service Not Connected',
      confidence: 0,
      caveat:
        'SERVEON does not invent residential street coordinates without an approved connected geocoding provider (e.g., licensed BIG/HERE/Google Geocoding API).',
    };
  }

  // Explicit opt-in approximate territory reference match (strictly labeled APPROXIMATE_LOCATION, never VERIFIED_ADDRESS)
  const cityLower = request.city.trim().toLowerCase();
  const matchedTerritory =
    provinceGeo.territories.find(
      (t) =>
        t.name.toLowerCase().includes(cityLower) || cityLower.includes(t.name.toLowerCase())
    ) ?? provinceGeo.territories[0];

  const [lat, lng] = matchedTerritory.center;
  return {
    serviceConnected: false,
    statusMessage: 'Geocoding Service Not Connected (Using Approximate Territory Reference Only)',
    providerName: 'Local EPSG:4326 Administrative Reference (Demo Fallback)',
    latitude: Number(lat.toFixed(5)),
    longitude: Number(lng.toFixed(5)),
    quality: 'APPROXIMATE_LOCATION',
    matchedAddress: `Simulated Point — Exact Address Unavailable (${matchedTerritory.name}, ${provinceGeo.provinceName})`,
    confidence: 35,
    caveat:
      'Approximate territory anchor only — NOT a verified residential address. Connect an approved geocoding API for street-level matching.',
  };
}

/**
 * Reverse Geocoding Workflow (with coordinate caching):
 * Returns honest "Geocoding Service Not Connected" status alongside local EPSG:4326
 * administrative boundary & land-mask classification (never fabricates street numbers).
 */
export function runReverseGeocoding(
  latitude: number,
  longitude: number,
  provinceGeo: ProvinceMapConfig
): ReverseGeocodingResult {
  const cacheKey = `${provinceGeo.provinceId}:${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  const existing = reverseGeocodeCache.get(cacheKey);
  if (existing) {
    return { ...existing, cached: true };
  }

  const matchedTerritory = provinceGeo.territories.find((t) =>
    pointInPolygonRing(latitude, longitude, t.coordinates)
  );
  const validation = validatePointAgainstLandAndTerritory(
    latitude,
    longitude,
    provinceGeo,
    matchedTerritory?.regionId
  );

  // Find nearest village anchor inside matched territory (administrative context only)
  let nearestVillageName = 'Unavailable';
  let postalCode = matchedTerritory?.defaultPostalCode ?? 'Unavailable';
  if (matchedTerritory) {
    let bestDist = Infinity;
    for (const [vid, anchor] of Object.entries(matchedTerritory.villageAnchors)) {
      const d = Math.hypot(latitude - anchor.lat, longitude - anchor.lng);
      if (d < bestDist) {
        bestDist = d;
        nearestVillageName = vid;
        postalCode = anchor.postalCode;
      }
    }
  }

  const result: ReverseGeocodingResult = {
    serviceConnected: false,
    statusMessage: 'Geocoding Service Not Connected',
    providerName: 'Local EPSG:4326 Boundary Lookup Only (No External Reverse Geocoder)',
    latitude: Number(latitude.toFixed(5)),
    longitude: Number(longitude.toFixed(5)),
    approximateAddress:
      validation.landStatus === 'ON_LAND' && matchedTerritory
        ? `Simulated Point — Exact Address Unavailable (${matchedTerritory.name}, ${provinceGeo.provinceName})`
        : validation.seaBodyName
          ? `Offshore / Water Area (${validation.seaBodyName}) — No Residential Address`
          : 'Unmatched Coordinate — Exact Address Unavailable',
    village: matchedTerritory ? `Ref Zone (${nearestVillageName})` : 'Unavailable',
    district: matchedTerritory ? `${matchedTerritory.name} Territory` : 'Unavailable',
    city: matchedTerritory?.name ?? 'Outside Active Province',
    province: provinceGeo.provinceName,
    postalCode,
    landStatus: validation.landStatus,
    territoryStatus: matchedTerritory ? validation.territoryStatus : 'OUTSIDE_TERRITORY',
    cached: false,
    caveat:
      'Reverse geocoding service is not connected. Administrative boundary lookup identifies nearest mapped territory only and does not establish an actual residential address.',
  };

  reverseGeocodeCache.set(cacheKey, result);
  return result;
}

/** Generate a privacy-aware CSV validation report for export */
export function buildValidationReportCsv(
  customers: GeocodedCustomer[],
  tenantName: string,
  canExportPreciseCoordinates: boolean
): string {
  const header = [
    'tenant',
    'customer_id',
    'pseudonym_code',
    'latitude',
    'longitude',
    'geolocation_status',
    'coordinate_validation_status',
    'land_validation_status',
    'territory_validation_status',
    'geolocation_source',
    'geolocation_accuracy',
    'geolocation_confidence',
    'city_name',
    'district_name',
    'village_name',
    'postal_code',
    'address_line',
    'validation_issue',
    'last_verified_at',
  ];

  const escapeCsv = (val: string | number | null | undefined) => {
    const s = val === null || val === undefined ? '' : String(val);
    return `"${s.replace(/"/g, '""')}"`;
  };

  const rows = customers.map((c) => {
    const latOut =
      c.latitude === null
        ? 'NOT_GEOCODED'
        : canExportPreciseCoordinates
          ? c.latitude.toFixed(5)
          : `${c.latitude.toFixed(2)} (MASKED_RBAC)`;
    const lngOut =
      c.longitude === null
        ? 'NOT_GEOCODED'
        : canExportPreciseCoordinates
          ? c.longitude.toFixed(5)
          : `${c.longitude.toFixed(2)} (MASKED_RBAC)`;
    return [
      tenantName,
      c.customer_id,
      c.pseudonym_code,
      latOut,
      lngOut,
      c.geolocation_status,
      c.coordinate_validation_status,
      c.land_validation_status,
      c.territory_validation_status,
      c.geolocation_source,
      c.geolocation_accuracy,
      c.geolocation_confidence,
      c.city_name,
      c.district_name,
      c.village_name,
      c.postal_code,
      canExportPreciseCoordinates ? c.address_line : 'REDACTED_BY_ROLE_PRIVACY_POLICY',
      c.validation_issue ?? 'None',
      c.last_verified_at,
    ]
      .map(escapeCsv)
      .join(',');
  });

  return [header.join(','), ...rows].join('\n');
}
