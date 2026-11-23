import type {
  CampaignChannel,
  CampaignRecord,
  CustomerInteraction,
  CustomerProduct,
  CustomerRecord,
  CustomerTransaction,
  IndustryId,
  PredictiveFactor,
  RiskCategory,
  Tenant,
} from '../../types/platform';
import { getIndustryProfile } from '../../core/industry-config/profiles';
import { DEMO_TENANTS } from './tenants';

/** Deterministic PRNG (Mulberry32) so demo data is 100% stable across renders and tests */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const FIRST_NAMES = [
  'Adi', 'Agung', 'Ayu', 'Bagus', 'Bambang', 'Budi', 'Citra', 'Darma', 'Dewi', 'Dian',
  'Dimas', 'Eka', 'Fajar', 'Fitri', 'Gita', 'Hadi', 'Hendra', 'Indah', 'Irfan', 'Joko',
  'Kartika', 'Lestari', 'Lukman', 'Maya', 'Nadia', 'Nugroho', 'Putra', 'Putri', 'Rahmat', 'Ratna',
  'Reza', 'Rina', 'Rizky', 'Sari', 'Setiawan', 'Siti', 'Surya', 'Taufik', 'Tri', 'Wahyu',
  'Wulan', 'Yanto', 'Yogi', 'Yuni', 'Zaki',
];

const LAST_NAMES = [
  'Pratama', 'Wijaya', 'Santoso', 'Kusuma', 'Hartono', 'Saputra', 'Utami', 'Wibowo', 'Hidayat', 'Nugraha',
  'Permata', 'Suharto', 'Pramono', 'Rahmawati', 'Setiadi', 'Anggraini', 'Purnomo', 'Kurniawan', 'Handayani', 'Susanto',
  'Mahendra', 'Laksmana', 'Suryadi', 'Widodo', 'Prasetyo', 'Gunawan', 'Halim', 'Salim', 'Tanjung', 'Yulianto',
];

const CHANNELS: CampaignChannel[] = ['WhatsApp', 'Email', 'SMS', 'Call Center', 'Branch Follow-up'];
const AGE_BANDS = ['25-34', '35-44', '45-54', '55-64', '18-24'];

// Fixed reference date for deterministic demo generation (2026-11-20)
const REFERENCE_EPOCH_MS = Date.UTC(2026, 10, 20);

function formatDateOffset(daysAgo: number): string {
  const ms = REFERENCE_EPOCH_MS - daysAgo * 86400000;
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildExtensionAttributes(
  industry: IndustryId,
  tenantId: string,
  rand: () => number
): {
  attrs: Record<string, string | number>;
  productPool: Array<{ name: string; category: string; baseAmount: number }>;
  nbaList: string[];
} {
  if (industry === 'motorcycle') {
    const models = [
      'Vario 160 ABS',
      'PCX 160 RoadSync',
      'BeAT Street eSP',
      'ADV 160 Touring',
      'Scoopy Prestige',
      'Stylus 160 ABS',
    ];
    const kpbStatuses = [
      'KPB Free Service Active',
      'Post-KPB AHASS Regular',
      'Overdue 4,000 km Service',
      'Extended Engine Warranty',
    ];
    const finance = [
      'Cash Purchase',
      'FIFGROUP Installment 24m',
      'FIFGROUP Installment 35m',
      'Corporate Fleet Program',
    ];
    const bikeModel = models[Math.floor(rand() * models.length)];
    return {
      attrs: {
        motorcycle_model: bikeModel,
        ahass_interval_km: 4000 + Math.floor(rand() * 9) * 4000,
        kpb_status: kpbStatuses[Math.floor(rand() * kpbStatuses.length)],
        financing_partner: finance[Math.floor(rand() * finance.length)],
      },
      productPool: [
        { name: `${bikeModel} Unit`, category: 'Motorcycle Sales', baseAmount: 29_500_000 },
        { name: 'AHASS Periodic 4,000 km & MPX Oil Service', category: 'AHASS After-Sales', baseAmount: 380_000 },
        { name: 'CVT & Genuine Brake Pad Maintenance Kit', category: 'Genuine Parts', baseAmount: 650_000 },
        { name: 'AHASS Complete Tire & Battery Care', category: 'Parts & Accessories', baseAmount: 1_150_000 },
      ],
      nbaList: [
        'Send WhatsApp AHASS 4,000 km periodic service voucher with Pit Express priority slot',
        'Offer 24-month trade-in appraisal toward PCX 160 / ADV 160 premium scooter upgrade',
        'Assign Main Dealer Service Advisor reminder for overdue post-KPB maintenance',
        'Enroll rider in Motorku X digital loyalty & genuine oil subscription',
      ],
    };
  }

  if (industry === 'automotive') {
    const isDaihatsu = tenantId === 'tenant-daihatsu';
    const models = isDaihatsu
      ? ['Sigra 1.2 R Deluxe', 'Terios R Custom', 'Xenia 1.5 R ASA', 'Rocky 1.2 X CVT', 'Gran Max Blind Van']
      : ['Avanza 1.5 G CVT', 'Innova Zenix Hybrid', 'Raize 1.0T GR Sport', 'Fortuner 2.8 VRZ', 'Yaris Cross Hybrid'];
    const warranties = isDaihatsu
      ? ['Active 3-Yr Daihatsu Warranty', 'Sahabat Care Package', 'Expiring < 90 Days', 'Fleet Maintenance SLA']
      : ['T-Care 3-Yr Free Service', 'Extended Warranty Plus', 'Expiring < 90 Days', 'Out of Warranty'];
    const finance = isDaihatsu
      ? ['ACC Multi-Finance 48m', 'Cash Purchase', 'SME Commercial Fleet Lease', 'Bank Auto Loan 60m']
      : ['TAF / ACC Financing 48m', 'Cash Purchase', 'Bank Auto Loan 60m', 'Corporate Fleet Lease'];
    const vehicleModel = models[Math.floor(rand() * models.length)];
    return {
      attrs: {
        vehicle_model: vehicleModel,
        service_interval_km: 10000 + Math.floor(rand() * 8) * 10000,
        warranty_status: warranties[Math.floor(rand() * warranties.length)],
        financing_partner: finance[Math.floor(rand() * finance.length)],
      },
      productPool: isDaihatsu
        ? [
            { name: `${vehicleModel} Unit`, category: 'Vehicle Sales', baseAmount: 225_000_000 },
            { name: 'Sahabat Daihatsu 10,000 km Periodic Service', category: 'After-Sales Service', baseAmount: 2_350_000 },
            { name: 'Gran Max Commercial Fleet Brake & Clutch Care', category: 'Parts & Maintenance', baseAmount: 3_600_000 },
            { name: 'Daihatsu Genuine Body & Rust Protection', category: 'Care Add-on', baseAmount: 4_400_000 },
          ]
        : [
            { name: `${vehicleModel} Unit`, category: 'Vehicle Sales', baseAmount: 365_000_000 },
            { name: 'Auto2000 T-Care 20,000 km Periodic Service', category: 'After-Sales Service', baseAmount: 3_850_000 },
            { name: 'THS Home Service & Brake Care Package', category: 'Parts & Maintenance', baseAmount: 5_100_000 },
            { name: 'Auto2000 Body & Paint Protection Plan', category: 'Care Add-on', baseAmount: 6_800_000 },
          ],
      nbaList: isDaihatsu
        ? [
            'Schedule Sahabat Daihatsu 10,000 km service slot via WhatsApp with free cabin filter check',
            'Offer commercial Gran Max SME fleet renewal & trade-in valuation at regional branch',
            'Assign Workshop Advisor call for overdue periodic maintenance check-in',
            'Present Rocky / Terios family upgrade quote with pre-screened ACC financing',
          ]
        : [
            'Schedule Auto2000 THS Home Service or 20,000 km periodic workshop bay via WhatsApp',
            'Offer 36-month trade-in valuation toward Innova Zenix / Yaris Cross Hybrid upgrade',
            'Assign Service Advisor call for overdue T-Care maintenance check-in',
            'Enroll owner in Extended Care Plus & Body-Paint protection package',
          ],
    };
  }

  if (industry === 'automotive_parts') {
    const accountTypes = [
      'B2B Independent Workshop',
      'Shop&Drive Retail Member',
      'Authorized Parts Sub-Dealer',
      'Commercial Fleet Depot',
    ];
    const skuCategories = [
      'GS Astra Maintenance-Free Battery',
      'Aspira Premio Tires & Brakes',
      'KYB Shock Absorber & Suspension',
      'Shell / Genuine Lubricants & Filters',
    ];
    const tiers = ['Platinum Distributor', 'Gold Workshop Partner', 'Silver Retail', 'Express Delivery Tier'];
    const topSku = skuCategories[Math.floor(rand() * skuCategories.length)];
    return {
      attrs: {
        buyer_account_type: accountTypes[Math.floor(rand() * accountTypes.length)],
        reorder_cycle_days: 15 + Math.floor(rand() * 5) * 15,
        top_sku_category: topSku,
        fulfillment_tier: tiers[Math.floor(rand() * tiers.length)],
      },
      productPool: [
        { name: 'GS Astra MF Battery Bulk Carton (12 Units)', category: 'Battery & Electrical', baseAmount: 14_800_000 },
        { name: 'Aspira Premio Brake & Filter Assortment Pack', category: 'Fast-Moving Wear Parts', baseAmount: 8_200_000 },
        { name: 'KYB Heavy-Duty Shock Absorber Set', category: 'Suspension & Steering', baseAmount: 11_400_000 },
        { name: 'Shop&Drive Fast-Fit Oil & Battery Service Bundle', category: 'Fast-Fit Retail', baseAmount: 2_350_000 },
      ],
      nbaList: [
        'Trigger WhatsApp replenishment alert with 24-hour depot dispatch for overdue workshop reorder',
        'Offer quarterly GS Astra + KYB multi-SKU rebate bundle to Gold/Platinum sub-dealer',
        'Schedule Autopart distributor territory rep visit for shelf-share expansion',
        'Send Shop&Drive battery health check & fast-fit oil voucher to retail account',
      ],
    };
  }

  if (industry === 'insurance') {
    const lines = [
      'Flexi Life Protection',
      'AVA iBright Term & Investment',
      'Flexi Critical Illness & Hospital',
      'Family Health Shield Plus',
    ];
    const claims = ['Zero Claim (No-Claim Bonus)', '1 Minor Outpatient Claim', '2+ Managed Claims'];
    const channels = ['Agency Advisor', 'Bancassurance Partner', 'Digital Direct (ilovelife)', 'Corporate Group'];
    const policyLine = lines[Math.floor(rand() * lines.length)];
    return {
      attrs: {
        policy_line: policyLine,
        renewal_window_days: 10 + Math.floor(rand() * 140),
        claim_history_band: claims[Math.floor(rand() * claims.length)],
        advisor_channel: channels[Math.floor(rand() * channels.length)],
      },
      productPool: [
        { name: `${policyLine} Annual Premium`, category: 'Life & Health Policy', baseAmount: 18_500_000 },
        { name: 'Critical Illness Rider Upgrade', category: 'Protection Rider', baseAmount: 6_400_000 },
        { name: 'Hospital Cash Plan Family Add-On', category: 'Health Protection', baseAmount: 4_900_000 },
        { name: 'Education & Retirement Protection Plan', category: 'Long-Term Protection', baseAmount: 24_200_000 },
      ],
      nbaList: [
        'Assign Agency Advisor grace-period retention call 30 days ahead of policy renewal',
        'Present Critical Illness & Hospital Cash rider upgrade during annual coverage review',
        'Trigger auto-debit renewal reminder via WhatsApp for digital Flexi policyholder',
        'Invite loyal multi-year policyholder to family protection gap consultation',
      ],
    };
  }

  if (industry === 'retail') {
    const tiers = ['Platinum VIP', 'Gold Member', 'Silver Member', 'Core Member'];
    const cats = ['Home & Living', 'Apparel & Lifestyle', 'Electronics & Audio', 'Beauty & Wellness'];
    return {
      attrs: {
        loyalty_tier: tiers[Math.floor(rand() * tiers.length)],
        avg_basket_items: 2 + Math.floor(rand() * 7),
        preferred_category: cats[Math.floor(rand() * cats.length)],
        omnichannel_flag: rand() > 0.35 ? 'Store + App' : 'In-Store Primary',
      },
      productPool: [
        { name: 'Seasonal Apparel Capsule', category: 'Apparel & Lifestyle', baseAmount: 1_850_000 },
        { name: 'Home Essentials Bundle', category: 'Home & Living', baseAmount: 2_600_000 },
        { name: 'Smart Audio Accessory', category: 'Electronics', baseAmount: 3_400_000 },
        { name: 'Loyalty Exclusive Wellness Set', category: 'Beauty & Wellness', baseAmount: 1_450_000 },
      ],
      nbaList: [
        'Send targeted cross-category basket voucher for weekend flagship store visit',
        'Invite to VIP seasonal preview event with early-access loyalty points',
        'Trigger 45-day lapsing member win-back offer via Email',
        'Promote click-and-collect app enrollment with free delivery threshold',
      ],
    };
  }

  if (industry === 'property') {
    const assetClasses = ['Resort Villa Lot', 'Urban Townhouse', 'Commercial Shophouse', 'Serviced Residence'];
    const schemes = ['Installment 24x', 'Mortgage KPR Partner', 'Hard Cash', 'Joint Investment'];
    const zones = ['Coastal Prime', 'Ubud Cultural Belt', 'Denpasar Urban Core', 'Emerging West Corridor'];
    return {
      attrs: {
        property_type: assetClasses[Math.floor(rand() * assetClasses.length)],
        investment_horizon_yrs: 3 + Math.floor(rand() * 8),
        financing_scheme: schemes[Math.floor(rand() * schemes.length)],
        catchment_zone: zones[Math.floor(rand() * zones.length)],
      },
      productPool: [
        { name: 'Phase-1 Villa Booking Milestone', category: 'Residential Villa', baseAmount: 1_850_000_000 },
        { name: 'Townhouse Downpayment Tranche', category: 'Urban Residential', baseAmount: 920_000_000 },
        { name: 'Commercial Lot Reservation', category: 'Commercial Asset', baseAmount: 1_350_000_000 },
        { name: 'Asset Management Advisory Fee', category: 'Property Services', baseAmount: 85_000_000 },
      ],
      nbaList: [
        'Arrange private Marketing Gallery walkthrough for Phase-2 coastal villa release',
        'Share Bali catchment rental yield comparative dossier with investor advisor',
        'Schedule mortgage partner pre-qualification follow-up call',
        'Offer loyalty early-bird priority lot selection for repeat investors',
      ],
    };
  }

  // Banking & Financial Services (Bank Saqu & banking fallback)
  const tiers = ['Solopreneur Pro', 'Saku Booster Priority', 'Digital Retail Core', 'SME Merchant Partner'];
  const creditBands = ['Prime A', 'Standard B+', 'Growth Solopreneur', 'New-to-Credit'];
  return {
    attrs: {
      account_tier: tiers[Math.floor(rand() * tiers.length)],
      product_holding_count: 1 + Math.floor(rand() * 4),
      digital_banking_usage: rand() > 0.2 ? 'High Daily App Active' : 'Hub Assisted',
      credit_profile: creditBands[Math.floor(rand() * creditBands.length)],
    },
    productPool: [
      { name: 'Busposito Community Term Deposit', category: 'Deposits & Savings', baseAmount: 48_000_000 },
      { name: 'Solopreneur Working Capital Facility', category: 'SME & Solopreneur Credit', baseAmount: 95_000_000 },
      { name: 'Saku Booster High-Yield Pocket Placement', category: 'Digital Wealth', baseAmount: 32_000_000 },
      { name: 'Tabungmatic & QRIS Merchant Settlement', category: 'Transaction Banking', baseAmount: 21_500_000 },
    ],
    nbaList: [
      'Invite active Saku user to Busposito high-yield community deposit tier via Email',
      'Present pre-screened Solopreneur working capital line with digital hub advisor',
      'Trigger balance-outflow defense outreach with Saku Booster interest retention offer',
      'Activate Tabungmatic auto-save & QRIS merchant settlement bundle',
    ],
  };
}

export interface TenantDataset {
  tenant: Tenant;
  customers: CustomerRecord[];
  campaigns: CampaignRecord[];
}

const DATASET_CACHE = new Map<string, TenantDataset>();

export function generateTenantDataset(tenant: Tenant): TenantDataset {
  const cached = DATASET_CACHE.get(tenant.id);
  if (cached) return cached;

  const rand = mulberry32(hashString(tenant.id + '-v1-serveon'));
  const profile = getIndustryProfile(tenant.defaultIndustryId);
  const regencies = tenant.province.regencies;
  const customers: CustomerRecord[] = [];

  for (let i = 0; i < tenant.seedCount; i++) {
    // Weighted region allocation proportional to marketPotentialIndex
    const totalWeight = regencies.reduce((acc, r) => acc + r.marketPotentialIndex, 0);
    let pick = rand() * totalWeight;
    let regency = regencies[0];
    for (const r of regencies) {
      pick -= r.marketPotentialIndex;
      if (pick <= 0) {
        regency = r;
        break;
      }
    }

    const district = regency.districts[Math.floor(rand() * regency.districts.length)];
    const village = district.villages[Math.floor(rand() * district.villages.length)];

    const regionBranches = tenant.branches.filter((b) => b.region_id === regency.id);
    const branch =
      regionBranches.length > 0
        ? regionBranches[Math.floor(rand() * regionBranches.length)]
        : tenant.branches[0];

    const first = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
    const last = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
    const fullName = `${first} ${last}`;
    const code = `${tenant.code.split('-')[0]}-${String(i + 1).padStart(4, '0')}`;

    const ext = buildExtensionAttributes(tenant.defaultIndustryId, tenant.id, rand);

    // Deterministic segment & risk assignment
    const roll = rand();
    let segment: CustomerRecord['customer_segment'];
    let status: CustomerRecord['status'];
    let churnScore: number;
    let propensityScore: number;

    if (roll < 0.22) {
      segment = 'High-Value Loyal';
      status = 'Active';
      churnScore = Math.round(10 + rand() * 22);
      propensityScore = Math.round(68 + rand() * 28);
    } else if (roll < 0.45) {
      segment = 'Growth Potential';
      status = 'Active';
      churnScore = Math.round(20 + rand() * 26);
      propensityScore = Math.round(62 + rand() * 32);
    } else if (roll < 0.72) {
      segment = 'Core Active';
      status = 'Active';
      churnScore = Math.round(25 + rand() * 30);
      propensityScore = Math.round(40 + rand() * 30);
    } else if (roll < 0.89) {
      segment = 'At-Risk Retention';
      status = 'At-Risk';
      churnScore = Math.round(68 + rand() * 28);
      propensityScore = Math.round(18 + rand() * 30);
    } else {
      segment = 'New Onboarding';
      status = rand() > 0.22 ? 'Active' : 'Dormant';
      churnScore = status === 'Dormant' ? Math.round(62 + rand() * 25) : Math.round(28 + rand() * 24);
      propensityScore = Math.round(45 + rand() * 35);
    }

    const churnCategory: RiskCategory =
      churnScore >= 65 ? 'High' : churnScore >= 38 ? 'Medium' : 'Low';

    const geoOppScore = Math.min(
      98,
      Math.max(42, Math.round(regency.marketPotentialIndex - 8 + rand() * 14))
    );

    // Generate 2 to 4 transactions across the last 365 days
    const txCount = segment === 'High-Value Loyal' ? 3 + Math.floor(rand() * 2) : 1 + Math.floor(rand() * 3);
    const transactions: CustomerTransaction[] = [];
    let mostRecentDaysAgo = 360;
    let ltv = 0;

    for (let t = 0; t < txCount; t++) {
      const daysAgo =
        status === 'At-Risk' || status === 'Dormant'
          ? Math.floor(95 + rand() * 255)
          : Math.floor(4 + rand() * 310);
      if (daysAgo < mostRecentDaysAgo) mostRecentDaysAgo = daysAgo;

      const template = ext.productPool[Math.floor(rand() * ext.productPool.length)];
      // Keep vehicle / motorcycle unit purchases realistic (~16-20% of txns are full units, rest are service/parts)
      const selectedTemplate =
        (tenant.defaultIndustryId === 'automotive' || tenant.defaultIndustryId === 'motorcycle') &&
        rand() > 0.18
          ? ext.productPool[1 + Math.floor(rand() * (ext.productPool.length - 1))]
          : template;

      const variance = 0.78 + rand() * 0.48;
      const amount = Math.round((selectedTemplate.baseAmount * variance) / 10000) * 10000;
      ltv += amount;

      transactions.push({
        transaction_id: `TX-${tenant.code.slice(0, 3)}-${String(i + 1).padStart(4, '0')}-${t + 1}`,
        customer_id: `cust-${tenant.id}-${i + 1}`,
        tenant_id: tenant.id,
        branch_id: branch.id,
        region_id: regency.id,
        date: formatDateOffset(daysAgo),
        amount,
        category: selectedTemplate.category,
        product_name: selectedTemplate.name,
        channel: t === 0 ? 'Branch' : CHANNELS[Math.floor(rand() * CHANNELS.length)],
      });
    }

    transactions.sort((a, b) => (a.date < b.date ? 1 : -1));

    const interactions: CustomerInteraction[] = [
      {
        interaction_id: `INT-${i + 1}-1`,
        customer_id: `cust-${tenant.id}-${i + 1}`,
        date: formatDateOffset(Math.max(2, mostRecentDaysAgo - 5)),
        channel: CHANNELS[Math.floor(rand() * CHANNELS.length)],
        type: status === 'At-Risk' ? 'Retention Check-in' : 'Account Follow-up',
        outcome: status === 'At-Risk' ? 'Follow-up Needed' : 'Positive',
        summary:
          status === 'At-Risk'
            ? `Outreach logged from ${branch.name}; follow-up scheduling requested.`
            : `Routine engagement completed via ${branch.name}.`,
      },
      {
        interaction_id: `INT-${i + 1}-2`,
        customer_id: `cust-${tenant.id}-${i + 1}`,
        date: formatDateOffset(Math.min(350, mostRecentDaysAgo + 42)),
        channel: 'WhatsApp',
        type: 'Service / Lifecycle Notification',
        outcome: 'Neutral',
        summary: 'Automated synthetic demo notification acknowledged.',
      },
    ];

    const products: CustomerProduct[] = [
      {
        product_id: `PRD-${i + 1}-1`,
        name: transactions[0].product_name,
        category: transactions[0].category,
        acquired_date: transactions[transactions.length - 1].date,
        status: status === 'At-Risk' ? 'Renewal Due' : status === 'Dormant' ? 'Inactive' : 'Active',
        value: transactions[0].amount,
      },
    ];

    const contributingFactors: PredictiveFactor[] =
      churnCategory === 'High'
        ? [
            { factor: `Days since last transaction (${mostRecentDaysAgo}d)`, impact: 38, direction: 'increases_risk' },
            { factor: `Reduced branch engagement frequency`, impact: 26, direction: 'increases_risk' },
            { factor: `Regional competitive pressure in ${regency.name}`, impact: 18, direction: 'increases_risk' },
            { factor: `Historical tenure loyalty buffer`, impact: -12, direction: 'reduces_risk' },
          ]
        : [
            { factor: `Consistent recent activity (${mostRecentDaysAgo}d ago)`, impact: -28, direction: 'reduces_risk' },
            { factor: `Strong territory affinity (${regency.name})`, impact: 24, direction: 'increases_propensity' },
            { factor: `Multi-touch engagement responsiveness`, impact: 21, direction: 'increases_propensity' },
            { factor: `Tenure & product depth score`, impact: -18, direction: 'reduces_risk' },
          ];

    const stageIdx =
      status === 'At-Risk'
        ? profile.lifecycleStages.length - 1
        : Math.min(profile.lifecycleStages.length - 2, Math.floor(rand() * (profile.lifecycleStages.length - 1)));

    const preferredChannel = CHANNELS[Math.floor(rand() * CHANNELS.length)];
    const emailMasked = `${first.toLowerCase().slice(0, 2)}***@${last.toLowerCase().slice(0, 3)}demo.invalid`;
    const phoneMasked = `+62-8**-****-${String(1000 + ((i * 37) % 8999))}`;

    customers.push({
      customer_id: `cust-${tenant.id}-${i + 1}`,
      tenant_id: tenant.id,
      business_unit_id: branch.business_unit_id,
      region_id: regency.id,
      district_id: district.id,
      village_id: village.id,
      branch_id: branch.id,
      full_name: fullName,
      code,
      status,
      lifecycle_stage: profile.lifecycleStages[stageIdx] ?? 'Active',
      customer_segment: segment,
      demographic_attributes: {
        age_band: AGE_BANDS[Math.floor(rand() * AGE_BANDS.length)],
        city: regency.name,
        district: district.name,
        village: village.name,
        preferred_channel: preferredChannel,
        tenure_months: 4 + Math.floor(rand() * 58),
        email_masked: emailMasked,
        phone_masked: phoneMasked,
      },
      extension_attributes: ext.attrs,
      transactions,
      interactions,
      products,
      lifetime_value: ltv,
      last_activity_date: transactions[0].date,
      model_outputs: {
        churn_risk_score: churnScore,
        churn_risk_category: churnCategory,
        purchase_propensity_score: propensityScore,
        geographic_opportunity_score: geoOppScore,
        recommended_next_best_action: ext.nbaList[Math.floor(rand() * ext.nbaList.length)],
        contributing_factors: contributingFactors,
        model_version: 'serveon-sim-v1.4',
        model_status: 'Illustrative AI Simulation',
        last_evaluated_at: '2026-11-20',
      },
    });
  }

  const campaigns = buildSeedCampaigns(tenant, customers);
  const dataset: TenantDataset = { tenant, customers, campaigns };
  DATASET_CACHE.set(tenant.id, dataset);
  return dataset;
}

function buildSeedCampaigns(tenant: Tenant, customers: CustomerRecord[]): CampaignRecord[] {
  const r0 = tenant.province.regencies[0];
  const r1 = tenant.province.regencies[1] ?? r0;
  const atRiskCount = customers.filter((c) => c.customer_segment === 'At-Risk Retention').length;
  const highValueCount = customers.filter((c) => c.customer_segment === 'High-Value Loyal').length;
  const growthInR0 = customers.filter(
    (c) => c.customer_segment === 'Growth Potential' && c.region_id === r0.id
  ).length;

  const industryLabel =
    tenant.defaultIndustryId === 'motorcycle'
      ? {
          c1: 'Astra Motor AHASS Post-KPB Service Reactivation Q4',
          o1: 'Re-engage overdue Jawa Tengah riders with complimentary Pit Express oil & CVT check.',
          c2: 'PCX 160 & ADV 160 Loyal Rider Trade-In Preview',
          o2: 'Convert 24-month commuter scooter owners to 160cc premium lineup.',
          c3: `${r0.name} Institutional Two-Wheeler Fleet Drive`,
          o3: 'Target delivery and mid-market corporate fleets across primary regency.',
        }
      : tenant.defaultIndustryId === 'automotive'
        ? tenant.id === 'tenant-daihatsu'
          ? {
              c1: 'Sahabat Daihatsu Periodic Workshop Reactivation',
              o1: 'Re-engage overdue Jawa Barat family & commercial owners with free multi-point check.',
              c2: 'Terios & Rocky Loyal Owner Trade-In Program',
              o2: 'Offer priority trade-in valuation and ACC financing to 36-month owners.',
              c3: `${r0.name} Gran Max SME Commercial Fleet Push`,
              o3: 'Acquire commercial logistics & SME fleet accounts in high-opportunity corridor.',
            }
          : {
              c1: 'Auto2000 T-Care & THS Home Service Reactivation Q4',
              o1: 'Re-engage overdue DKI Jakarta workshop owners with complimentary multi-point inspection.',
              c2: 'Innova Zenix & Yaris Cross Hybrid Trade-In Preview',
              o2: 'Convert 36-month loyal vehicle owners to next-gen hybrid lineup.',
              c3: `${r0.name} Corporate Fleet & Mobility Outreach`,
              o3: 'Target executive and corporate fleet prospects across primary metro.',
            }
        : tenant.defaultIndustryId === 'automotive_parts'
          ? {
              c1: 'Autopart Lapsing B2B Workshop Restock Recovery',
              o1: 'Re-activate Jawa Timur independent workshops overdue for battery and brake restocks.',
              c2: 'GS Astra & KYB Platinum Sub-Dealer Rebate Bundle',
              o2: 'Expand multi-SKU assortment share among loyal distributor and workshop partners.',
              c3: `${r0.name} Shop&Drive Fast-Fit Catchment Campaign`,
              o3: 'Drive retail oil and battery replacement bookings around Surabaya-Sidoarjo hubs.',
            }
          : tenant.defaultIndustryId === 'insurance'
            ? {
                c1: 'Astralife 45-Day Renewal Persistency Defense',
                o1: 'Proactive advisor outreach for renewal-due Bali policyholders at elevated lapse risk.',
                c2: 'Critical Illness & Hospital Cash Rider Upgrade',
                o2: 'Offer protection rider expansion to multi-year loyal Flexi and AVA policyholders.',
                c3: `${r0.name} Bancassurance & Family Protection Drive`,
                o3: 'Grow household life and health coverage in high-potential Bali catchments.',
              }
            : tenant.defaultIndustryId === 'retail'
              ? {
                  c1: 'DKI Jakarta Lapsing Loyalty Win-Back',
                  o1: 'Recover Gold & Silver members inactive for 45+ days with basket voucher.',
                  c2: 'Senayan & Menteng VIP Capsule Preview',
                  o2: 'Drive omnichannel basket expansion across high-value members.',
                  c3: `${r0.name} App Click-and-Collect Activation`,
                  o3: 'Convert single-channel store shoppers to omnichannel loyalty app.',
                }
              : tenant.defaultIndustryId === 'property'
                ? {
                    c1: 'Bali Repeat Investor Phase-2 Private Briefing',
                    o1: 'Engage prior villa and townhouse buyers for coastal launch preview.',
                    c2: 'Ubud & Badung Catchment Yield Dossier',
                    o2: 'Nurture qualified high-propensity property leads with gallery visits.',
                    c3: `${r0.name} Q4 Gallery Re-Engagement`,
                    o3: 'Re-activate stalled gallery inquiries with partner financing options.',
                  }
                : {
                    c1: 'Bank Saqu Saku Balance Retention & Outflow Defense',
                    o1: 'Proactive Saku Booster rate and RM outreach for accounts showing balance outflow.',
                    c2: 'Busposito High-Yield Community Deposit Cross-Sell',
                    o2: 'Convert active Saku and Tabungmatic holders into higher-yield community deposits.',
                    c3: `${r0.name} Solopreneur QRIS & Working Capital Drive`,
                    o3: 'Activate urban solopreneurs and SMEs onto merchant financing and digital pockets.',
                  };

  return [
    {
      id: `cmp-${tenant.code.toLowerCase()}-01`,
      tenant_id: tenant.id,
      name: industryLabel.c1,
      objective: industryLabel.o1,
      targetSegment: 'At-Risk Retention',
      regionId: 'ALL',
      regionName: `All ${tenant.primaryProvinceName}`,
      channel: 'WhatsApp',
      status: 'Completed',
      scheduledDate: '2026-10-15',
      targetAudienceCount: atRiskCount,
      estimatedConversionRate: 16.4,
      simulatedConversions: Math.max(4, Math.round(atRiskCount * 0.164)),
      estimatedRevenueImpact: Math.round(atRiskCount * 0.164 * 4_500_000),
      budgetAllocated: 28_000_000,
      createdBy: 'Dimas Pratama',
      createdAt: '2026-10-02',
      auditTrail: [
        {
          id: 'aud-1',
          timestamp: '2026-10-02 09:15',
          actorName: 'Dimas Pratama',
          actorRole: 'Campaign Manager',
          action: 'Created draft campaign',
          toStatus: 'Draft',
          note: 'Initial audience selection from predictive churn simulation.',
        },
        {
          id: 'aud-2',
          timestamp: '2026-10-04 14:20',
          actorName: 'Hendra Wijaya',
          actorRole: 'Executive Management',
          action: 'Approved campaign brief',
          fromStatus: 'Pending Approval',
          toStatus: 'Approved',
          note: 'Approved within Q4 retention budget envelope.',
        },
        {
          id: 'aud-3',
          timestamp: '2026-10-15 10:00',
          actorName: 'Dimas Pratama',
          actorRole: 'Campaign Manager',
          action: 'Completed simulated execution',
          fromStatus: 'Simulated Execution',
          toStatus: 'Completed',
          note: 'Simulated outreach completed; no external messages transmitted.',
        },
      ],
    },
    {
      id: `cmp-${tenant.code.toLowerCase()}-02`,
      tenant_id: tenant.id,
      name: industryLabel.c2,
      objective: industryLabel.o2,
      targetSegment: 'High-Value Loyal',
      regionId: r1.id,
      regionName: r1.name,
      channel: 'Branch Follow-up',
      status: 'Pending Approval',
      scheduledDate: '2026-12-01',
      targetAudienceCount: Math.max(12, Math.round(highValueCount * 0.35)),
      estimatedConversionRate: 21.5,
      simulatedConversions: 0,
      estimatedRevenueImpact: Math.round(Math.max(12, highValueCount * 0.35) * 0.215 * 14_000_000),
      budgetAllocated: 42_000_000,
      createdBy: 'Dimas Pratama',
      createdAt: '2026-11-14',
      auditTrail: [
        {
          id: 'aud-4',
          timestamp: '2026-11-14 11:05',
          actorName: 'Dimas Pratama',
          actorRole: 'Campaign Manager',
          action: 'Submitted for approval',
          fromStatus: 'Draft',
          toStatus: 'Pending Approval',
          note: 'Awaiting Executive or Business Manager sign-off.',
        },
      ],
    },
    {
      id: `cmp-${tenant.code.toLowerCase()}-03`,
      tenant_id: tenant.id,
      name: industryLabel.c3,
      objective: industryLabel.o3,
      targetSegment: 'Growth Potential',
      regionId: r0.id,
      regionName: r0.name,
      channel: 'Email',
      status: 'Approved',
      scheduledDate: '2026-11-28',
      targetAudienceCount: Math.max(15, growthInR0),
      estimatedConversionRate: 13.8,
      simulatedConversions: 0,
      estimatedRevenueImpact: Math.round(Math.max(15, growthInR0) * 0.138 * 8_500_000),
      budgetAllocated: 19_500_000,
      createdBy: 'Rina Santoso',
      createdAt: '2026-11-10',
      auditTrail: [
        {
          id: 'aud-5',
          timestamp: '2026-11-10 16:40',
          actorName: 'Rina Santoso',
          actorRole: 'Business Manager',
          action: 'Created and submitted campaign',
          toStatus: 'Pending Approval',
          note: 'Focused on high-opportunity primary regency.',
        },
        {
          id: 'aud-6',
          timestamp: '2026-11-12 09:30',
          actorName: 'Nadia Pramesti',
          actorRole: 'Tenant Administrator',
          action: 'Approved campaign',
          fromStatus: 'Pending Approval',
          toStatus: 'Approved',
          note: 'Ready for scheduling and simulated dispatch.',
        },
      ],
    },
  ];
}

export function getAllInitialCampaigns(): Record<string, CampaignRecord[]> {
  const result: Record<string, CampaignRecord[]> = {};
  for (const tenant of DEMO_TENANTS) {
    result[tenant.id] = generateTenantDataset(tenant).campaigns;
  }
  return result;
}
