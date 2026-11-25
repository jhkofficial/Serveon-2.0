import type { Tenant } from '../../types/platform';

export interface TerritoryGeoPolygon {
  regionId: string;
  name: string;
  center: [number, number]; // [lat, lng] — guaranteed terrestrial EPSG:4326
  /** Closed terrestrial administrative polygon ring in [lat, lng] (EPSG:4326) */
  coordinates: Array<[number, number]>;
  districtCentroids: Record<string, [number, number]>;
  villageAnchors: Record<string, { lat: number; lng: number; postalCode: string }>;
  defaultPostalCode: string;
  coverageRadiusMeters: number;
}

export interface ProvinceMapConfig {
  provinceId: string;
  provinceName: string;
  crs: 'EPSG:4326';
  center: [number, number];
  defaultZoom: number;
  bounds: [[number, number], [number, number]];
  boundaryNotice: string;
  landMaskSource: string;
  /** Terrestrial land mask polygon(s) in [lat, lng] (EPSG:4326) strictly inland of coastlines */
  landMaskPolygons: Array<Array<[number, number]>>;
  /** Explicit offshore sea / water body exclusion polygons in [lat, lng] (EPSG:4326) */
  seaExclusionPolygons: Array<{
    name: string;
    ring: Array<[number, number]>;
  }>;
  territories: TerritoryGeoPolygon[];
}

/**
 * Coastline-constrained WGS-84 (EPSG:4326) terrestrial administrative polygons,
 * province land masks, sea exclusion polygons, and district/village reference anchors.
 *
 * Notice: Official BPS/BIG cadastral shapefiles can be swapped into this decoupled module
 * without modifying map rendering or validation logic.
 */
export const INDONESIA_PROVINCE_GEO: Record<string, ProvinceMapConfig> = {
  'prov-jateng': {
    provinceId: 'prov-jateng',
    provinceName: 'Jawa Tengah',
    crs: 'EPSG:4326',
    center: [-7.18, 110.12],
    defaultZoom: 8,
    bounds: [
      [-7.92, 108.75],
      [-6.58, 111.35],
    ],
    boundaryNotice:
      'Coastline-constrained WGS-84 (EPSG:4326) terrestrial reference boundaries for Jawa Tengah (official BPS/BIG cadastral shapefile pluggable).',
    landMaskSource: 'SERVEON Coastline-Constrained Terrestrial Mask (EPSG:4326 Reference)',
    landMaskPolygons: [
      // Mainland Central Java strictly south of Java Sea shore & north of Indian Ocean shore
      [
        [-6.868, 108.82], // Brebes inland
        [-6.870, 109.18], // Tegal inland
        [-6.892, 109.45], // Pemalang inland
        [-6.884, 109.72], // Pekalongan / Batang inland
        [-6.935, 110.18], // Kendal inland
        [-6.976, 110.285], // Semarang West (Tugu/Mangkang) inland
        [-6.968, 110.365], // Semarang Barat inland
        [-6.963, 110.425], // Semarang Utara / Tengah inland
        [-6.967, 110.485], // Genuk / Terboyo inland
        [-6.880, 110.63], // Demak inland
        [-6.640, 110.74], // Jepara/Kudus inland
        [-6.690, 111.14], // Pati / Rembang inland
        [-7.180, 111.30], // Blora / Sragen east
        [-7.740, 111.05], // Wonogiri / Solo south
        [-7.760, 110.20], // Magelang / Purworejo south
        [-7.745, 109.30], // Kebumen / Banyumas south
        [-7.738, 109.03], // Cilacap north of Nusakambangan/Indian Ocean
        [-7.680, 108.76], // Cilacap west inland
        [-7.200, 108.75], // Brebes/Banyumas west
      ],
    ],
    seaExclusionPolygons: [
      {
        name: 'Java Sea (North Coast of Jawa Tengah & Semarang Bay)',
        ring: [
          [-6.20, 108.50],
          [-6.20, 111.60],
          [-6.68, 111.18],
          [-6.63, 110.72],
          [-6.87, 110.62],
          [-6.958, 110.49],
          [-6.955, 110.425],
          [-6.960, 110.365],
          [-6.968, 110.28],
          [-6.925, 110.18],
          [-6.874, 109.72],
          [-6.882, 109.45],
          [-6.860, 109.18],
          [-6.858, 108.80],
        ],
      },
      {
        name: 'Indian Ocean (South Coast of Cilacap & Central Java)',
        ring: [
          [-7.742, 108.70],
          [-7.742, 109.06],
          [-7.760, 109.35],
          [-7.820, 110.25],
          [-8.250, 111.30],
          [-8.250, 108.70],
        ],
      },
    ],
    territories: [
      {
        regionId: 'reg-semarang',
        name: 'Kota Semarang',
        center: [-7.015, 110.415],
        coverageRadiusMeters: 14000,
        // Strictly inland of the Semarang Java Sea shoreline (Tugu -> Semarang Barat -> Tengah -> Genuk -> Tembalang -> Banyumanik -> Gunungpati -> Mijen)
        coordinates: [
          [-6.978, 110.295], // Tugu / Mangkang inland
          [-6.970, 110.365], // Semarang Barat inland
          [-6.966, 110.425], // Semarang Tengah / Utara inland
          [-6.970, 110.478], // Genuk / Pedurungan north inland
          [-7.022, 110.488], // Pedurungan / Tembalang east
          [-7.082, 110.468], // Tembalang / Banyumanik east
          [-7.108, 110.415], // Banyumanik south
          [-7.105, 110.355], // Gunungpati
          [-7.068, 110.308], // Mijen
          [-7.018, 110.288], // Ngaliyan
        ],
        districtCentroids: {
          'dist-smg-tengah': [-6.985, 110.416],
          'dist-smg-banyumanik': [-7.064, 110.422],
        },
        villageAnchors: {
          'vil-smg-1': { lat: -6.9825, lng: 110.4125, postalCode: '50132' }, // Sekayu
          'vil-smg-2': { lat: -6.9885, lng: 110.4215, postalCode: '50134' }, // Miroto
          'vil-smg-3': { lat: -7.0635, lng: 110.4235, postalCode: '50263' }, // Srondol Wetan
          'vil-smg-4': { lat: -7.0585, lng: 110.4315, postalCode: '50268' }, // Pedalangan
        },
        defaultPostalCode: '50132',
      },
      {
        regionId: 'reg-surakarta',
        name: 'Kota Surakarta (Solo)',
        center: [-7.565, 110.825],
        coverageRadiusMeters: 15000,
        coordinates: [
          [-7.48, 110.72],
          [-7.49, 110.94],
          [-7.65, 110.95],
          [-7.68, 110.74],
          [-7.58, 110.69],
        ],
        districtCentroids: {
          'dist-slo-banjarsari': [-7.554, 110.823],
          'dist-slo-laweyan': [-7.571, 110.793],
        },
        villageAnchors: {
          'vil-slo-1': { lat: -7.5535, lng: 110.8065, postalCode: '57139' }, // Manahan
          'vil-slo-2': { lat: -7.5615, lng: 110.8165, postalCode: '57139' }, // Mangkubumen
          'vil-slo-3': { lat: -7.5695, lng: 110.8015, postalCode: '57142' }, // Purwosari
          'vil-slo-4': { lat: -7.5745, lng: 110.7935, postalCode: '57147' }, // Sondakan
        },
        defaultPostalCode: '57139',
      },
      {
        regionId: 'reg-magelang',
        name: 'Kab. & Kota Magelang',
        center: [-7.485, 110.22],
        coverageRadiusMeters: 18000,
        coordinates: [
          [-7.35, 110.09],
          [-7.36, 110.35],
          [-7.59, 110.34],
          [-7.61, 110.10],
          [-7.47, 110.04],
        ],
        districtCentroids: {
          'dist-mgl-mertoyudan': [-7.511, 110.224],
          'dist-mgl-selatan': [-7.495, 110.219],
        },
        villageAnchors: {
          'vil-mgl-1': { lat: -7.5165, lng: 110.2265, postalCode: '56172' }, // Sumberrejo
          'vil-mgl-2': { lat: -7.5085, lng: 110.2175, postalCode: '56172' }, // Banyurojo
          'vil-mgl-3': { lat: -7.4985, lng: 110.2215, postalCode: '56125' }, // Tidar Selatan
          'vil-mgl-4': { lat: -7.4895, lng: 110.2185, postalCode: '56124' }, // Rejowinangun
        },
        defaultPostalCode: '56124',
      },
      {
        regionId: 'reg-banyumas',
        name: 'Kab. Banyumas (Purwokerto)',
        center: [-7.425, 109.24],
        coverageRadiusMeters: 20000,
        coordinates: [
          [-7.28, 109.06],
          [-7.29, 109.42],
          [-7.52, 109.43],
          [-7.55, 109.13],
          [-7.41, 109.03],
        ],
        districtCentroids: {
          'dist-pwt-utara': [-7.405, 109.245],
          'dist-pwt-timur': [-7.425, 109.254],
        },
        villageAnchors: {
          'vil-pwt-1': { lat: -7.4075, lng: 109.2425, postalCode: '53121' }, // Bancarkembar
          'vil-pwt-2': { lat: -7.4015, lng: 109.2495, postalCode: '53122' }, // Grendeng
          'vil-pwt-3': { lat: -7.4215, lng: 109.2485, postalCode: '53114' }, // Purwokerto Lor
          'vil-pwt-4': { lat: -7.4275, lng: 109.2445, postalCode: '53115' }, // Sokanegara
        },
        defaultPostalCode: '53114',
      },
      {
        regionId: 'reg-tegal',
        name: 'Kota & Kab. Tegal',
        center: [-6.955, 109.14],
        coverageRadiusMeters: 18000,
        // Strictly inland south of Java Sea shore (-6.875 southward)
        coordinates: [
          [-6.876, 109.02],
          [-6.878, 109.26],
          [-7.12, 109.27],
          [-7.14, 109.02],
          [-6.99, 108.98],
        ],
        districtCentroids: {
          'dist-tgl-timur': [-6.892, 109.148],
          'dist-tgl-slawi': [-6.982, 109.136],
        },
        villageAnchors: {
          'vil-tgl-1': { lat: -6.8855, lng: 109.1435, postalCode: '52121' }, // Mintaragen
          'vil-tgl-2': { lat: -6.8915, lng: 109.1525, postalCode: '52122' }, // Panggung
          'vil-tgl-3': { lat: -6.9815, lng: 109.1365, postalCode: '52415' }, // Pakembaran
          'vil-tgl-4': { lat: -6.9765, lng: 109.1445, postalCode: '52413' }, // Kudaile
        },
        defaultPostalCode: '52121',
      },
      {
        regionId: 'reg-kudus',
        name: 'Kab. Kudus & Pati',
        center: [-6.815, 110.90],
        coverageRadiusMeters: 19000,
        // Inland Kudus-Pati plain south of northern coast
        coordinates: [
          [-6.72, 110.76],
          [-6.73, 111.09],
          [-6.92, 111.10],
          [-6.93, 110.78],
          [-6.82, 110.73],
        ],
        districtCentroids: {
          'dist-kds-kota': [-6.805, 110.841],
          'dist-kds-jati': [-6.829, 110.835],
        },
        villageAnchors: {
          'vil-kds-1': { lat: -6.8065, lng: 110.8425, postalCode: '59312' }, // Barongan
          'vil-kds-2': { lat: -6.8015, lng: 110.8485, postalCode: '59319' }, // Mlati Lor
          'vil-kds-3': { lat: -6.8295, lng: 110.8345, postalCode: '59346' }, // Jati Wetan
          'vil-kds-4': { lat: -6.8245, lng: 110.8435, postalCode: '59343' }, // Getas Pejaten
        },
        defaultPostalCode: '59312',
      },
      {
        regionId: 'reg-pekalongan',
        name: 'Kota Pekalongan',
        center: [-6.955, 109.67],
        coverageRadiusMeters: 16000,
        // Inland south of Java Sea shore (-6.890 southward)
        coordinates: [
          [-6.892, 109.56],
          [-6.894, 109.79],
          [-7.09, 109.80],
          [-7.10, 109.56],
        ],
        districtCentroids: {
          'dist-pkl-barat': [-6.906, 109.669],
        },
        villageAnchors: {
          'vil-pkl-1': { lat: -6.9025, lng: 109.6665, postalCode: '51119' }, // Bendan Kergon
          'vil-pkl-2': { lat: -6.9115, lng: 109.6695, postalCode: '51111' }, // Medono
        },
        defaultPostalCode: '51111',
      },
      {
        regionId: 'reg-cilacap',
        name: 'Kab. Cilacap',
        center: [-7.64, 109.02],
        coverageRadiusMeters: 20000,
        // Strictly inland north of Indian Ocean coastline (-7.732 northward)
        coordinates: [
          [-7.51, 108.84],
          [-7.54, 109.20],
          [-7.728, 109.18],
          [-7.732, 108.88],
        ],
        districtCentroids: {
          'dist-clp-tengah': [-7.705, 109.012],
        },
        villageAnchors: {
          'vil-clp-1': { lat: -7.7055, lng: 109.0115, postalCode: '53223' }, // Donan
          'vil-clp-2': { lat: -7.7115, lng: 109.0185, postalCode: '53224' }, // Sidanegara
        },
        defaultPostalCode: '53223',
      },
    ],
  },

  'prov-jakarta': {
    provinceId: 'prov-jakarta',
    provinceName: 'DKI Jakarta',
    crs: 'EPSG:4326',
    center: [-6.215, 106.84],
    defaultZoom: 11,
    bounds: [
      [-6.36, 106.70],
      [-6.115, 106.97],
    ],
    boundaryNotice:
      'Coastline-constrained WGS-84 (EPSG:4326) terrestrial reference boundaries for DKI Jakarta (south of Jakarta Bay).',
    landMaskSource: 'SERVEON Coastline-Constrained Terrestrial Mask (EPSG:4326 Reference)',
    landMaskPolygons: [
      [
        [-6.122, 106.715], // Kalideres / PIK inland
        [-6.128, 106.805], // Pluit / Penjaringan inland
        [-6.125, 106.885], // Tanjung Priok / Sunter inland
        [-6.120, 106.955], // Cilincing inland
        [-6.338, 106.955], // Jakarta Timur south
        [-6.345, 106.765], // Jakarta Selatan south
        [-6.220, 106.705], // Jakarta Barat west
      ],
    ],
    seaExclusionPolygons: [
      {
        name: 'Jakarta Bay (Teluk Jakarta)',
        ring: [
          [-5.95, 106.65],
          [-5.95, 107.05],
          [-6.114, 106.96],
          [-6.120, 106.885],
          [-6.122, 106.805],
          [-6.116, 106.715],
        ],
      },
    ],
    territories: [
      {
        regionId: 'reg-jaksel',
        name: 'Jakarta Selatan',
        center: [-6.265, 106.812],
        coverageRadiusMeters: 4800,
        coordinates: [
          [-6.215, 106.765],
          [-6.218, 106.858],
          [-6.332, 106.852],
          [-6.335, 106.770],
        ],
        districtCentroids: {
          'dist-jks-kebayoran': [-6.244, 106.798],
          'dist-jks-setiabudi': [-6.222, 106.828],
        },
        villageAnchors: {
          'vil-jks-1': { lat: -6.2385, lng: 106.8025, postalCode: '12190' },
          'vil-jks-2': { lat: -6.2485, lng: 106.7955, postalCode: '12160' },
          'vil-jks-3': { lat: -6.2245, lng: 106.8265, postalCode: '12950' },
          'vil-jks-4': { lat: -6.2195, lng: 106.8325, postalCode: '12920' },
        },
        defaultPostalCode: '12190',
      },
      {
        regionId: 'reg-jakpus',
        name: 'Jakarta Pusat',
        center: [-6.185, 106.834],
        coverageRadiusMeters: 3600,
        coordinates: [
          [-6.154, 106.804],
          [-6.156, 106.870],
          [-6.212, 106.866],
          [-6.211, 106.802],
        ],
        districtCentroids: {
          'dist-jkp-menteng': [-6.195, 106.836],
        },
        villageAnchors: {
          'vil-jkp-1': { lat: -6.1945, lng: 106.8355, postalCode: '10310' },
          'vil-jkp-2': { lat: -6.1895, lng: 106.8315, postalCode: '10350' },
        },
        defaultPostalCode: '10310',
      },
      {
        regionId: 'reg-jakbar',
        name: 'Jakarta Barat',
        center: [-6.170, 106.758],
        coverageRadiusMeters: 4600,
        coordinates: [
          [-6.132, 106.718],
          [-6.135, 106.796],
          [-6.214, 106.793],
          [-6.216, 106.715],
        ],
        districtCentroids: {
          'dist-jkb-grogol': [-6.167, 106.788],
        },
        villageAnchors: {
          'vil-jkb-1': { lat: -6.1675, lng: 106.7885, postalCode: '11470' },
          'vil-jkb-2': { lat: -6.1745, lng: 106.7825, postalCode: '11440' },
        },
        defaultPostalCode: '11470',
      },
      {
        regionId: 'reg-jakut',
        name: 'Jakarta Utara',
        center: [-6.144, 106.878],
        coverageRadiusMeters: 4500,
        // Strictly inland south of Jakarta Bay shoreline
        coordinates: [
          [-6.130, 106.808],
          [-6.126, 106.948],
          [-6.162, 106.946],
          [-6.160, 106.808],
        ],
        districtCentroids: {
          'dist-jku-kelapagading': [-6.154, 106.905],
        },
        villageAnchors: {
          'vil-jku-1': { lat: -6.1535, lng: 106.9045, postalCode: '14240' },
          'vil-jku-2': { lat: -6.1465, lng: 106.8985, postalCode: '14250' },
        },
        defaultPostalCode: '14240',
      },
      {
        regionId: 'reg-jaktim',
        name: 'Jakarta Timur',
        center: [-6.235, 106.908],
        coverageRadiusMeters: 5400,
        coordinates: [
          [-6.166, 106.874],
          [-6.168, 106.950],
          [-6.328, 106.946],
          [-6.330, 106.866],
        ],
        districtCentroids: {
          'dist-jkt-cakung': [-6.192, 106.932],
        },
        villageAnchors: {
          'vil-jkt-1': { lat: -6.1915, lng: 106.9325, postalCode: '13910' },
          'vil-jkt-2': { lat: -6.2245, lng: 106.9055, postalCode: '13430' },
        },
        defaultPostalCode: '13910',
      },
    ],
  },

  'prov-bali': {
    provinceId: 'prov-bali',
    provinceName: 'Bali',
    crs: 'EPSG:4326',
    center: [-8.46, 115.17],
    defaultZoom: 9,
    bounds: [
      [-8.82, 114.78],
      [-8.10, 115.55],
    ],
    boundaryNotice:
      'Coastline-constrained WGS-84 (EPSG:4326) terrestrial reference boundaries for Bali island.',
    landMaskSource: 'SERVEON Coastline-Constrained Terrestrial Mask (EPSG:4326 Reference)',
    landMaskPolygons: [
      [
        [-8.115, 114.95], // Buleleng north inland
        [-8.130, 115.30], // Singaraja east inland
        [-8.400, 115.42], // Gianyar/Klungkung inland
        [-8.610, 115.32], // Gianyar south inland
        [-8.705, 115.255], // Denpasar Sanur inland
        [-8.715, 115.185], // Kuta inland
        [-8.650, 115.135], // Canggu inland
        [-8.575, 115.020], // Tabanan south inland
        [-8.340, 114.920], // Tabanan west inland
      ],
    ],
    seaExclusionPolygons: [
      {
        name: 'Bali Sea (North Coast of Buleleng)',
        ring: [
          [-7.80, 114.60],
          [-7.80, 115.70],
          [-8.120, 115.32],
          [-8.105, 114.95],
          [-8.140, 114.60],
        ],
      },
      {
        name: 'Indian Ocean & Badung Strait (South/West Coast of Bali)',
        ring: [
          [-8.660, 115.125],
          [-8.725, 115.175],
          [-8.720, 115.265],
          [-8.620, 115.340],
          [-9.050, 115.650],
          [-9.050, 114.650],
          [-8.590, 114.980],
        ],
      },
    ],
    territories: [
      {
        regionId: 'reg-badung',
        name: 'Kab. Badung (Canggu & Kuta)',
        center: [-8.62, 115.165],
        coverageRadiusMeters: 10000,
        coordinates: [
          [-8.54, 115.135],
          [-8.55, 115.195],
          [-8.70, 115.190],
          [-8.65, 115.140],
        ],
        districtCentroids: {
          'dist-bdg-kutautara': [-8.635, 115.158],
          'dist-bdg-kutaselatan': [-8.685, 115.182],
        },
        villageAnchors: {
          'vil-bdg-1': { lat: -8.6425, lng: 115.1565, postalCode: '80361' },
          'vil-bdg-2': { lat: -8.6285, lng: 115.1645, postalCode: '80361' },
          'vil-bdg-3': { lat: -8.6825, lng: 115.1815, postalCode: '80361' },
          'vil-bdg-4': { lat: -8.6685, lng: 115.1745, postalCode: '80361' },
        },
        defaultPostalCode: '80361',
      },
      {
        regionId: 'reg-denpasar',
        name: 'Kota Denpasar',
        center: [-8.665, 115.225],
        coverageRadiusMeters: 7500,
        coordinates: [
          [-8.615, 115.195],
          [-8.618, 115.252],
          [-8.698, 115.250],
          [-8.698, 115.195],
        ],
        districtCentroids: {
          'dist-dps-selatan': [-8.675, 115.230],
        },
        villageAnchors: {
          'vil-dps-1': { lat: -8.6725, lng: 115.2325, postalCode: '80226' },
          'vil-dps-2': { lat: -8.6585, lng: 115.2215, postalCode: '80232' },
        },
        defaultPostalCode: '80226',
      },
      {
        regionId: 'reg-gianyar',
        name: 'Kab. Gianyar (Ubud)',
        center: [-8.505, 115.285],
        coverageRadiusMeters: 11000,
        coordinates: [
          [-8.40, 115.22],
          [-8.41, 115.36],
          [-8.59, 115.33],
          [-8.58, 115.22],
        ],
        districtCentroids: {
          'dist-gnr-ubud': [-8.507, 115.263],
        },
        villageAnchors: {
          'vil-gnr-1': { lat: -8.5075, lng: 115.2625, postalCode: '80571' },
          'vil-gnr-2': { lat: -8.5225, lng: 115.2745, postalCode: '80571' },
        },
        defaultPostalCode: '80571',
      },
      {
        regionId: 'reg-tabanan',
        name: 'Kab. Tabanan',
        center: [-8.49, 115.07],
        coverageRadiusMeters: 12000,
        coordinates: [
          [-8.36, 114.95],
          [-8.37, 115.13],
          [-8.56, 115.125],
          [-8.55, 114.99],
        ],
        districtCentroids: {
          'dist-tbn-kediri': [-8.545, 115.112],
        },
        villageAnchors: {
          'vil-tbn-1': { lat: -8.5445, lng: 115.1115, postalCode: '82121' },
          'vil-tbn-2': { lat: -8.5325, lng: 115.1025, postalCode: '82113' },
        },
        defaultPostalCode: '82121',
      },
      {
        regionId: 'reg-buleleng',
        name: 'Kab. Buleleng (Singaraja)',
        center: [-8.18, 115.09],
        coverageRadiusMeters: 14000,
        // Strictly inland south of Bali Sea shore (-8.120 southward)
        coordinates: [
          [-8.122, 114.97],
          [-8.135, 115.26],
          [-8.26, 115.25],
          [-8.25, 114.97],
        ],
        districtCentroids: {
          'dist-bll-buleleng': [-8.138, 115.091],
        },
        villageAnchors: {
          'vil-bll-1': { lat: -8.1385, lng: 115.0915, postalCode: '81113' },
          'vil-bll-2': { lat: -8.1485, lng: 115.0845, postalCode: '81119' },
        },
        defaultPostalCode: '81113',
      },
    ],
  },

  'prov-jabar': {
    provinceId: 'prov-jabar',
    provinceName: 'Jawa Barat',
    crs: 'EPSG:4326',
    center: [-6.68, 107.62],
    defaultZoom: 8,
    bounds: [
      [-7.20, 106.60],
      [-6.12, 108.65],
    ],
    boundaryNotice:
      'Coastline-constrained WGS-84 (EPSG:4326) terrestrial reference boundaries for Jawa Barat.',
    landMaskSource: 'SERVEON Coastline-Constrained Terrestrial Mask (EPSG:4326 Reference)',
    landMaskPolygons: [
      [
        [-6.13, 106.85], // Bekasi north inland
        [-6.25, 107.45], // Karawang inland
        [-6.45, 108.15], // Indramayu inland
        [-6.68, 108.555], // Cirebon coast inland
        [-6.86, 108.62], // Cirebon south inland
        [-7.18, 108.20], // Southern interior
        [-7.16, 106.66], // Bogor/Sukabumi inland
        [-6.45, 106.64], // Bogor west
      ],
    ],
    seaExclusionPolygons: [
      {
        name: 'Java Sea (North Coast of Jawa Barat & Cirebon)',
        ring: [
          [-5.85, 106.80],
          [-5.85, 108.85],
          [-6.78, 108.66],
          [-6.67, 108.565],
          [-6.42, 108.18],
          [-6.22, 107.45],
          [-6.11, 106.85],
        ],
      },
    ],
    territories: [
      {
        regionId: 'reg-bandung',
        name: 'Kota Bandung',
        center: [-6.917, 107.619],
        coverageRadiusMeters: 16000,
        coordinates: [
          [-6.81, 107.49],
          [-6.82, 107.76],
          [-7.03, 107.75],
          [-7.02, 107.50],
        ],
        districtCentroids: {
          'dist-bdg-coblong': [-6.89, 107.614],
        },
        villageAnchors: {
          'vil-bdg-jb-1': { lat: -6.8895, lng: 107.6145, postalCode: '40132' },
          'vil-bdg-jb-2': { lat: -6.9015, lng: 107.6185, postalCode: '40135' },
        },
        defaultPostalCode: '40132',
      },
      {
        regionId: 'reg-bekasi',
        name: 'Kota Bekasi',
        center: [-6.245, 106.995],
        coverageRadiusMeters: 14000,
        coordinates: [
          [-6.15, 106.90],
          [-6.16, 107.12],
          [-6.36, 107.11],
          [-6.35, 106.91],
        ],
        districtCentroids: {
          'dist-bks-selatan': [-6.25, 106.98],
        },
        villageAnchors: {
          'vil-bks-1': { lat: -6.2495, lng: 106.9815, postalCode: '17141' },
          'vil-bks-2': { lat: -6.2585, lng: 106.9925, postalCode: '17144' },
        },
        defaultPostalCode: '17141',
      },
      {
        regionId: 'reg-bogor',
        name: 'Kota Bogor',
        center: [-6.597, 106.806],
        coverageRadiusMeters: 15000,
        coordinates: [
          [-6.48, 106.68],
          [-6.49, 106.94],
          [-6.72, 106.93],
          [-6.71, 106.69],
        ],
        districtCentroids: {
          'dist-bgr-tengah': [-6.597, 106.798],
        },
        villageAnchors: {
          'vil-bgr-1': { lat: -6.5965, lng: 106.7985, postalCode: '16121' },
          'vil-bgr-2': { lat: -6.6045, lng: 106.8065, postalCode: '16129' },
        },
        defaultPostalCode: '16121',
      },
      {
        regionId: 'reg-cirebon',
        name: 'Kota Cirebon',
        center: [-6.745, 108.505],
        coverageRadiusMeters: 14000,
        // Strictly inland west of Java Sea shore at Cirebon
        coordinates: [
          [-6.69, 108.42],
          [-6.70, 108.55],
          [-6.84, 108.56],
          [-6.84, 108.42],
        ],
        districtCentroids: {
          'dist-crb-kejaksan': [-6.716, 108.542],
        },
        villageAnchors: {
          'vil-crb-1': { lat: -6.7165, lng: 108.5425, postalCode: '45123' },
          'vil-crb-2': { lat: -6.7265, lng: 108.5345, postalCode: '45122' },
        },
        defaultPostalCode: '45123',
      },
    ],
  },

  'prov-jatim': {
    provinceId: 'prov-jatim',
    provinceName: 'Jawa Timur',
    crs: 'EPSG:4326',
    center: [-7.58, 112.69],
    defaultZoom: 9,
    bounds: [
      [-8.18, 112.40],
      [-7.20, 112.88],
    ],
    boundaryNotice:
      'Coastline-constrained WGS-84 (EPSG:4326) terrestrial reference boundaries for Jawa Timur (west of Madura Strait).',
    landMaskSource: 'SERVEON Coastline-Constrained Terrestrial Mask (EPSG:4326 Reference)',
    landMaskPolygons: [
      [
        [-7.220, 112.60], // Surabaya north-west inland
        [-7.225, 112.785], // Surabaya east shore inland
        [-7.345, 112.790], // Rungkut / Juanda inland
        [-7.550, 112.765], // Sidoarjo east inland
        [-8.120, 112.760], // Malang east
        [-8.120, 112.480], // Malang west
        [-7.350, 112.560], // Sidoarjo / Gresik west
      ],
    ],
    seaExclusionPolygons: [
      {
        name: 'Madura Strait (Selat Madura)',
        ring: [
          [-7.05, 112.60],
          [-7.05, 113.20],
          [-7.65, 113.20],
          [-7.55, 112.775],
          [-7.345, 112.798],
          [-7.218, 112.792],
          [-7.210, 112.60],
        ],
      },
    ],
    territories: [
      {
        regionId: 'reg-surabaya',
        name: 'Kota Surabaya',
        center: [-7.275, 112.725],
        coverageRadiusMeters: 13000,
        // Strictly inland south & west of Madura Strait
        coordinates: [
          [-7.226, 112.62],
          [-7.230, 112.780],
          [-7.338, 112.782],
          [-7.335, 112.62],
        ],
        districtCentroids: {
          'dist-sby-gubeng': [-7.268, 112.750],
        },
        villageAnchors: {
          'vil-sby-1': { lat: -7.2685, lng: 112.7505, postalCode: '60281' },
          'vil-sby-2': { lat: -7.2785, lng: 112.7585, postalCode: '60282' },
        },
        defaultPostalCode: '60281',
      },
      {
        regionId: 'reg-sidoarjo',
        name: 'Kab. Sidoarjo',
        center: [-7.445, 112.695],
        coverageRadiusMeters: 15000,
        coordinates: [
          [-7.352, 112.60],
          [-7.355, 112.760],
          [-7.542, 112.758],
          [-7.540, 112.60],
        ],
        districtCentroids: {
          'dist-sda-waru': [-7.362, 112.724],
        },
        villageAnchors: {
          'vil-sda-1': { lat: -7.3625, lng: 112.7245, postalCode: '61256' },
          'vil-sda-2': { lat: -7.3745, lng: 112.7185, postalCode: '61256' },
        },
        defaultPostalCode: '61256',
      },
      {
        regionId: 'reg-malang',
        name: 'Kota Malang',
        center: [-7.9666, 112.6326],
        coverageRadiusMeters: 16000,
        coordinates: [
          [-7.86, 112.52],
          [-7.87, 112.74],
          [-8.08, 112.73],
          [-8.07, 112.52],
        ],
        districtCentroids: {
          'dist-mlg-klojen': [-7.977, 112.631],
        },
        villageAnchors: {
          'vil-mlg-1': { lat: -7.9775, lng: 112.6315, postalCode: '65111' },
          'vil-mlg-2': { lat: -7.9695, lng: 112.6255, postalCode: '65112' },
        },
        defaultPostalCode: '65111',
      },
    ],
  },
};

export function getProvinceMapConfig(tenant: Tenant): ProvinceMapConfig {
  return (
    INDONESIA_PROVINCE_GEO[tenant.primaryProvinceId] ??
    INDONESIA_PROVINCE_GEO['prov-jateng']
  );
}
