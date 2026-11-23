import type { Tenant } from '../../types/platform';

export interface TerritoryGeoPolygon {
  regionId: string;
  name: string;
  center: [number, number]; // [lat, lng]
  /** Closed polygon ring in [lat, lng] coordinates for Leaflet */
  coordinates: Array<[number, number]>;
  districtCentroids: Record<string, [number, number]>;
  coverageRadiusMeters: number;
}

export interface ProvinceMapConfig {
  provinceId: string;
  provinceName: string;
  center: [number, number];
  defaultZoom: number;
  bounds: [[number, number], [number, number]];
  boundaryNotice: string;
  territories: TerritoryGeoPolygon[];
}

/**
 * Illustrative WGS-84 geographic territory polygons anchored to real Indonesian
 * regency/city coordinates. Kept decoupled from UI components so official BPS
 * GeoJSON shapefiles can be plugged in without modifying rendering components.
 */
export const INDONESIA_PROVINCE_GEO: Record<string, ProvinceMapConfig> = {
  'prov-jateng': {
    provinceId: 'prov-jateng',
    provinceName: 'Jawa Tengah',
    center: [-7.18, 110.12],
    defaultZoom: 8,
    bounds: [
      [-7.95, 108.75],
      [-6.55, 111.35],
    ],
    boundaryNotice:
      'Illustrative WGS-84 territory polygons anchored to Jawa Tengah regency coordinates (not official BPS cadastral survey boundaries).',
    territories: [
      {
        regionId: 'reg-semarang',
        name: 'Kota Semarang',
        center: [-6.985, 110.42],
        coverageRadiusMeters: 18000,
        coordinates: [
          [-6.91, 110.27],
          [-6.92, 110.52],
          [-7.09, 110.54],
          [-7.14, 110.35],
          [-7.05, 110.24],
        ],
        districtCentroids: {
          'dist-smg-tengah': [-6.982, 110.415],
          'dist-smg-banyumanik': [-7.065, 110.422],
        },
      },
      {
        regionId: 'reg-surakarta',
        name: 'Kota Surakarta (Solo)',
        center: [-7.565, 110.825],
        coverageRadiusMeters: 17000,
        coordinates: [
          [-7.44, 110.67],
          [-7.45, 110.98],
          [-7.68, 110.99],
          [-7.72, 110.71],
          [-7.59, 110.63],
        ],
        districtCentroids: {
          'dist-slo-banjarsari': [-7.554, 110.823],
          'dist-slo-laweyan': [-7.571, 110.793],
        },
      },
      {
        regionId: 'reg-magelang',
        name: 'Kab. & Kota Magelang',
        center: [-7.48, 110.22],
        coverageRadiusMeters: 20000,
        coordinates: [
          [-7.31, 110.05],
          [-7.32, 110.39],
          [-7.61, 110.38],
          [-7.64, 110.06],
          [-7.47, 109.98],
        ],
        districtCentroids: {
          'dist-mgl-mertoyudan': [-7.511, 110.224],
          'dist-mgl-selatan': [-7.495, 110.219],
        },
      },
      {
        regionId: 'reg-banyumas',
        name: 'Kab. Banyumas (Purwokerto)',
        center: [-7.425, 109.24],
        coverageRadiusMeters: 22000,
        coordinates: [
          [-7.24, 109.02],
          [-7.25, 109.45],
          [-7.54, 109.47],
          [-7.58, 109.11],
          [-7.41, 108.99],
        ],
        districtCentroids: {
          'dist-pwt-utara': [-7.405, 109.245],
          'dist-pwt-timur': [-7.425, 109.254],
        },
      },
      {
        regionId: 'reg-tegal',
        name: 'Kota & Kab. Tegal',
        center: [-6.93, 109.14],
        coverageRadiusMeters: 21000,
        coordinates: [
          [-6.83, 108.96],
          [-6.84, 109.31],
          [-7.15, 109.32],
          [-7.19, 108.99],
          [-7.02, 108.92],
        ],
        districtCentroids: {
          'dist-tgl-timur': [-6.868, 109.148],
          'dist-tgl-slawi': [-6.982, 109.136],
        },
      },
      {
        regionId: 'reg-kudus',
        name: 'Kab. Kudus & Pati',
        center: [-6.78, 110.95],
        coverageRadiusMeters: 22000,
        coordinates: [
          [-6.58, 110.74],
          [-6.61, 111.18],
          [-6.93, 111.19],
          [-6.95, 110.76],
          [-6.78, 110.69],
        ],
        districtCentroids: {
          'dist-kds-kota': [-6.805, 110.841],
          'dist-kds-jati': [-6.829, 110.835],
        },
      },
      {
        regionId: 'reg-pekalongan',
        name: 'Kota Pekalongan',
        center: [-6.92, 109.67],
        coverageRadiusMeters: 18000,
        coordinates: [
          [-6.84, 109.51],
          [-6.85, 109.84],
          [-7.14, 109.85],
          [-7.16, 109.52],
        ],
        districtCentroids: {
          'dist-pkl-barat': [-6.889, 109.669],
        },
      },
      {
        regionId: 'reg-cilacap',
        name: 'Kab. Cilacap',
        center: [-7.66, 109.02],
        coverageRadiusMeters: 24000,
        coordinates: [
          [-7.48, 108.78],
          [-7.53, 109.26],
          [-7.78, 109.22],
          [-7.81, 108.82],
        ],
        districtCentroids: {
          'dist-clp-tengah': [-7.716, 109.012],
        },
      },
    ],
  },

  'prov-jakarta': {
    provinceId: 'prov-jakarta',
    provinceName: 'DKI Jakarta',
    center: [-6.21, 106.84],
    defaultZoom: 11,
    bounds: [
      [-6.37, 106.68],
      [-6.08, 106.99],
    ],
    boundaryNotice:
      'Illustrative WGS-84 territory polygons anchored to DKI Jakarta administrative city coordinates.',
    territories: [
      {
        regionId: 'reg-jaksel',
        name: 'Jakarta Selatan',
        center: [-6.265, 106.812],
        coverageRadiusMeters: 4800,
        coordinates: [
          [-6.215, 106.76],
          [-6.218, 106.862],
          [-6.338, 106.855],
          [-6.342, 106.765],
        ],
        districtCentroids: {
          'dist-jks-kebayoran': [-6.244, 106.798],
          'dist-jks-setiabudi': [-6.218, 106.83],
        },
      },
      {
        regionId: 'reg-jakpus',
        name: 'Jakarta Pusat',
        center: [-6.185, 106.834],
        coverageRadiusMeters: 3600,
        coordinates: [
          [-6.152, 106.802],
          [-6.154, 106.872],
          [-6.214, 106.868],
          [-6.213, 106.8],
        ],
        districtCentroids: {
          'dist-jkp-menteng': [-6.195, 106.836],
        },
      },
      {
        regionId: 'reg-jakbar',
        name: 'Jakarta Barat',
        center: [-6.168, 106.758],
        coverageRadiusMeters: 4600,
        coordinates: [
          [-6.115, 106.705],
          [-6.122, 106.798],
          [-6.216, 106.795],
          [-6.218, 106.708],
        ],
        districtCentroids: {
          'dist-jkb-grogol': [-6.167, 106.788],
        },
      },
      {
        regionId: 'reg-jakut',
        name: 'Jakarta Utara',
        center: [-6.132, 106.872],
        coverageRadiusMeters: 5200,
        coordinates: [
          [-6.092, 106.785],
          [-6.096, 106.955],
          [-6.158, 106.952],
          [-6.152, 106.792],
        ],
        districtCentroids: {
          'dist-jku-kelapagading': [-6.158, 106.905],
        },
      },
      {
        regionId: 'reg-jaktim',
        name: 'Jakarta Timur',
        center: [-6.235, 106.908],
        coverageRadiusMeters: 5400,
        coordinates: [
          [-6.162, 106.872],
          [-6.166, 106.968],
          [-6.332, 106.952],
          [-6.335, 106.864],
        ],
        districtCentroids: {
          'dist-jkt-cakung': [-6.185, 106.942],
        },
      },
    ],
  },

  'prov-bali': {
    provinceId: 'prov-bali',
    provinceName: 'Bali',
    center: [-8.42, 115.17],
    defaultZoom: 9,
    bounds: [
      [-8.86, 114.62],
      [-8.04, 115.68],
    ],
    boundaryNotice:
      'Illustrative WGS-84 territory polygons anchored to Bali regency and Denpasar coordinates.',
    territories: [
      {
        regionId: 'reg-badung',
        name: 'Kab. Badung (Canggu & Nusa Dua)',
        center: [-8.665, 115.145],
        coverageRadiusMeters: 12000,
        coordinates: [
          [-8.55, 115.08],
          [-8.56, 115.2],
          [-8.83, 115.22],
          [-8.84, 115.09],
        ],
        districtCentroids: {
          'dist-bdg-kutautara': [-8.65, 115.142],
          'dist-bdg-kutaselatan': [-8.795, 115.178],
        },
      },
      {
        regionId: 'reg-denpasar',
        name: 'Kota Denpasar',
        center: [-8.67, 115.235],
        coverageRadiusMeters: 8500,
        coordinates: [
          [-8.6, 115.19],
          [-8.6, 115.28],
          [-8.73, 115.28],
          [-8.73, 115.19],
        ],
        districtCentroids: {
          'dist-dps-selatan': [-8.69, 115.238],
        },
      },
      {
        regionId: 'reg-gianyar',
        name: 'Kab. Gianyar (Ubud)',
        center: [-8.505, 115.29],
        coverageRadiusMeters: 12000,
        coordinates: [
          [-8.37, 115.21],
          [-8.38, 115.38],
          [-8.6, 115.36],
          [-8.59, 115.21],
        ],
        districtCentroids: {
          'dist-gnr-ubud': [-8.507, 115.263],
        },
      },
      {
        regionId: 'reg-tabanan',
        name: 'Kab. Tabanan',
        center: [-8.5, 115.04],
        coverageRadiusMeters: 14000,
        coordinates: [
          [-8.33, 114.89],
          [-8.34, 115.16],
          [-8.62, 115.14],
          [-8.6, 114.9],
        ],
        districtCentroids: {
          'dist-tbn-kediri': [-8.565, 115.121],
        },
      },
      {
        regionId: 'reg-buleleng',
        name: 'Kab. Buleleng (Singaraja)',
        center: [-8.16, 115.09],
        coverageRadiusMeters: 16000,
        coordinates: [
          [-8.07, 114.82],
          [-8.08, 115.37],
          [-8.28, 115.34],
          [-8.27, 114.84],
        ],
        districtCentroids: {
          'dist-bll-buleleng': [-8.114, 115.091],
        },
      },
    ],
  },

  'prov-jabar': {
    provinceId: 'prov-jabar',
    provinceName: 'Jawa Barat',
    center: [-6.68, 107.62],
    defaultZoom: 8,
    bounds: [
      [-7.25, 106.55],
      [-6.05, 108.85],
    ],
    boundaryNotice:
      'Illustrative WGS-84 territory polygons anchored to Jawa Barat commercial corridor cities.',
    territories: [
      {
        regionId: 'reg-bandung',
        name: 'Kota Bandung',
        center: [-6.917, 107.619],
        coverageRadiusMeters: 18000,
        coordinates: [
          [-6.78, 107.46],
          [-6.79, 107.79],
          [-7.05, 107.78],
          [-7.04, 107.47],
        ],
        districtCentroids: {
          'dist-bdg-coblong': [-6.89, 107.614],
        },
      },
      {
        regionId: 'reg-bekasi',
        name: 'Kota Bekasi',
        center: [-6.245, 106.995],
        coverageRadiusMeters: 16000,
        coordinates: [
          [-6.12, 106.88],
          [-6.13, 107.16],
          [-6.38, 107.15],
          [-6.37, 106.89],
        ],
        districtCentroids: {
          'dist-bks-selatan': [-6.25, 106.98],
        },
      },
      {
        regionId: 'reg-bogor',
        name: 'Kota Bogor',
        center: [-6.597, 106.806],
        coverageRadiusMeters: 17000,
        coordinates: [
          [-6.46, 106.66],
          [-6.47, 106.97],
          [-6.74, 106.96],
          [-6.73, 106.67],
        ],
        districtCentroids: {
          'dist-bgr-tengah': [-6.597, 106.798],
        },
      },
      {
        regionId: 'reg-cirebon',
        name: 'Kota Cirebon',
        center: [-6.732, 108.552],
        coverageRadiusMeters: 19000,
        coordinates: [
          [-6.58, 108.38],
          [-6.59, 108.73],
          [-6.88, 108.72],
          [-6.87, 108.39],
        ],
        districtCentroids: {
          'dist-crb-kejaksan': [-6.712, 108.558],
        },
      },
    ],
  },
  'prov-jatim': {
    provinceId: 'prov-jatim',
    provinceName: 'Jawa Timur',
    center: [-7.58, 112.70],
    defaultZoom: 9,
    bounds: [
      [-8.25, 112.20],
      [-7.05, 113.15],
    ],
    boundaryNotice:
      'Illustrative WGS-84 territory polygons anchored to Jawa Timur regency coordinates (not official BPS cadastral survey boundaries).',
    territories: [
      {
        regionId: 'reg-surabaya',
        name: 'Kota Surabaya',
        center: [-7.2575, 112.7521],
        coverageRadiusMeters: 16000,
        coordinates: [
          [-7.18, 112.60],
          [-7.19, 112.86],
          [-7.35, 112.85],
          [-7.34, 112.61],
        ],
        districtCentroids: {
          'dist-sby-gubeng': [-7.265, 112.752],
        },
      },
      {
        regionId: 'reg-sidoarjo',
        name: 'Kab. Sidoarjo',
        center: [-7.4478, 112.7183],
        coverageRadiusMeters: 17000,
        coordinates: [
          [-7.36, 112.58],
          [-7.37, 112.84],
          [-7.57, 112.83],
          [-7.56, 112.59],
        ],
        districtCentroids: {
          'dist-sda-waru': [-7.356, 112.728],
        },
      },
      {
        regionId: 'reg-malang',
        name: 'Kota Malang',
        center: [-7.9666, 112.6326],
        coverageRadiusMeters: 18000,
        coordinates: [
          [-7.84, 112.50],
          [-7.85, 112.76],
          [-8.09, 112.75],
          [-8.08, 112.51],
        ],
        districtCentroids: {
          'dist-mlg-klojen': [-7.977, 112.631],
        },
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
