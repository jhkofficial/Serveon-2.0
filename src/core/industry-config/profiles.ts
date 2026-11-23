import type { IndustryId, IndustryProfile } from '../../types/platform';

export const INDUSTRY_PROFILES: Record<IndustryId, IndustryProfile> = {
  motorcycle: {
    id: 'motorcycle',
    name: 'Motorcycle Sales & After-Sales',
    description:
      'Two-wheeler main dealer networks, AHASS periodic service retention, rider upgrades, and district territory coverage.',
    terminology: {
      customerSingular: 'Motorcycle Rider',
      customerPlural: 'Motorcycle Riders',
      branchSingular: 'Main Dealer & AHASS',
      branchPlural: 'Dealers & AHASS Workshops',
      productSingular: 'Motorcycle / Service Plan',
      productPlural: 'Motorcycles & AHASS Plans',
      transactionSingular: 'Unit & AHASS Order',
      transactionPlural: 'Unit & AHASS Orders',
      primaryRevenueLabel: 'Motorcycle & AHASS Service Revenue',
      retentionMetricLabel: 'AHASS Service Retention Rate',
    },
    activatedModules: ['BM01', 'BM02', 'BM03', 'BM04', 'BM05', 'BM06', 'BM07', 'BM08'],
    extensionAttributes: [
      { key: 'motorcycle_model', label: 'Primary Motorcycle Model', dataType: 'string' },
      { key: 'ahass_interval_km', label: 'Last AHASS Odometer (km)', dataType: 'number' },
      { key: 'kpb_status', label: 'KPB / Service Warranty', dataType: 'string' },
      { key: 'financing_partner', label: 'Financing Scheme', dataType: 'string' },
    ],
    kpiDefinitions: [
      {
        key: 'motorcycle_sales',
        label: 'Motorcycle & AHASS Service Revenue',
        unit: 'IDR',
        formulaDescription: 'Sum of two-wheeler unit sales, AHASS periodic maintenance, and genuine parts orders within the selected region and date window.',
        targetBenchmark: 'Growth >= +9% QoQ (Demo Benchmark)',
      },
      {
        key: 'ahass_retention',
        label: 'AHASS Service Retention Rate',
        unit: '%',
        formulaDescription: 'Percentage of active motorcycle riders completing KPB or regular 4,000 km AHASS maintenance visits.',
        targetBenchmark: '>= 78% Annual AHASS Retention',
      },
      {
        key: 'rider_upgrade',
        label: 'Scooter-to-Premium Upgrade Pool',
        unit: 'Riders',
        formulaDescription: 'Riders with purchase propensity >= 68% eligible for 160cc premium scooter or second-unit household upgrade.',
        targetBenchmark: '>= 20% of Active Rider Base',
      },
      {
        key: 'ahass_reactivation',
        label: 'Overdue AHASS Reactivation Queue',
        unit: 'Riders',
        formulaDescription: 'At-risk riders overdue for periodic oil/CVT service prioritized for dealer WhatsApp outreach.',
        targetBenchmark: '<= 15% Overdue Ratio',
      },
    ],
    lifecycleStages: ['Prospect', 'KPB New Rider', 'Regular AHASS Active', 'Upgrade Window', 'AHASS Reactivation'],
    aiUseCases: [
      {
        id: 'mc-ahass-churn',
        title: 'AHASS Workshop Drop-Off & Churn Risk',
        modelType: 'Classification',
        description: 'Identifies riders likely to skip their post-KPB 4,000 km periodic service visit.',
      },
      {
        id: 'mc-upgrade',
        title: '160cc Premium Upgrade & Second-Bike Propensity',
        modelType: 'Propensity',
        description: 'Scores loyal commuter riders for premium automatic scooter or trade-in adoption.',
      },
      {
        id: 'mc-geo',
        title: 'District Rider Density & AHASS Pit Opportunity',
        modelType: 'Spatial Scoring',
        description: 'Ranks regencies by registered two-wheeler population vs AHASS service bay capacity.',
      },
    ],
    dashboardLayoutEmphasis: 'Main dealer sales velocity, AHASS service retention, and 160cc upgrade pipeline',
    businessRules: [
      'Flag riders with > 120 days since last AHASS workshop visit as At-Risk Retention.',
      'Require Regional Manager or Campaign Manager approval before scheduling WhatsApp AHASS service reminders.',
      'Prioritize sub-districts with Geographic Opportunity Score >= 76 for mobile AHASS Pit Express units.',
    ],
    workflowTemplates: [
      {
        name: 'Post-KPB 4,000 km AHASS Service Reminder',
        trigger: 'AHASS interval overdue > 21 days',
        channel: 'WhatsApp',
        approvalRequired: true,
      },
      {
        name: '24-Month 160cc Premium Trade-In Offer',
        trigger: 'Tenure >= 24 months & Propensity >= 70%',
        channel: 'Branch Follow-up',
        approvalRequired: true,
      },
    ],
  },

  automotive: {
    id: 'automotive',
    name: 'Automotive Sales & Services',
    description:
      'Four-wheeler dealership networks, periodic after-sales service retention, fleet acquisition, and regional territory coverage.',
    terminology: {
      customerSingular: 'Vehicle Owner',
      customerPlural: 'Vehicle Owners',
      branchSingular: 'Dealership & Service Center',
      branchPlural: 'Dealerships',
      productSingular: 'Vehicle / Service Plan',
      productPlural: 'Vehicles & Service Plans',
      transactionSingular: 'Sales & Service Order',
      transactionPlural: 'Sales & Service Orders',
      primaryRevenueLabel: 'Vehicle & After-Sales Revenue',
      retentionMetricLabel: 'Service Retention Rate',
    },
    activatedModules: ['BM01', 'BM02', 'BM03', 'BM04', 'BM05', 'BM06', 'BM07', 'BM08'],
    extensionAttributes: [
      { key: 'vehicle_model', label: 'Primary Vehicle Model', dataType: 'string' },
      { key: 'service_interval_km', label: 'Last Odometer (km)', dataType: 'number' },
      { key: 'warranty_status', label: 'Warranty Coverage', dataType: 'string' },
      { key: 'financing_partner', label: 'Financing Type', dataType: 'string' },
    ],
    kpiDefinitions: [
      {
        key: 'vehicle_sales',
        label: 'Vehicle & After-Sales Revenue',
        unit: 'IDR',
        formulaDescription: 'Sum of verified vehicle sales and after-sales workshop orders within the selected region and date window.',
        targetBenchmark: 'Growth >= +8% QoQ (Demo Benchmark)',
      },
      {
        key: 'service_retention',
        label: 'Service Retention Rate',
        unit: '%',
        formulaDescription: 'Percentage of active vehicle owners who completed scheduled maintenance or remained in Active status over the selected period.',
        targetBenchmark: '>= 76% Annual Retention',
      },
      {
        key: 'repeat_purchase',
        label: 'Repeat Purchase & Upgrade Pipeline',
        unit: 'Accounts',
        formulaDescription: 'Vehicle owners with purchase propensity >= 68% and tenure >= 24 months eligible for trade-in or fleet expansion.',
        targetBenchmark: '>= 18% of Active Base',
      },
      {
        key: 'customer_reactivation',
        label: 'Dormant Workshop Reactivation',
        unit: 'Accounts',
        formulaDescription: 'At-risk or overdue maintenance owners prioritized for branch service outreach.',
        targetBenchmark: '<= 16% At-Risk Ratio',
      },
    ],
    lifecycleStages: ['Prospect', 'New Owner', 'Periodic Service Active', 'Trade-In Window', 'Reactivation Priority'],
    aiUseCases: [
      {
        id: 'auto-churn',
        title: 'Workshop Defection & Churn Risk',
        modelType: 'Classification',
        description: 'Identifies owners likely to miss their next 10,000 km periodic service visit.',
      },
      {
        id: 'auto-upgrade',
        title: 'Trade-In & Second Vehicle Propensity',
        modelType: 'Propensity',
        description: 'Scores multi-year owners for SUV/MPV upgrade or hybrid fleet adoption.',
      },
      {
        id: 'auto-geo',
        title: 'District Service Bay Opportunity',
        modelType: 'Spatial Scoring',
        description: 'Ranks regencies in Jawa Tengah by registered vehicle density vs dealership service bay capacity.',
      },
    ],
    dashboardLayoutEmphasis: 'Regional dealership coverage, service retention, and trade-in pipeline',
    businessRules: [
      'Flag vehicle owners with > 180 days since last workshop order as At-Risk Retention.',
      'Require Regional Manager or Campaign Manager approval before scheduling WhatsApp service reminders.',
      'Prioritize districts with Geographic Opportunity Score >= 75 for mobile service clinic deployment.',
    ],
    workflowTemplates: [
      {
        name: 'Periodic 20,000 km Service Reminder',
        trigger: 'Service interval overdue > 30 days',
        channel: 'WhatsApp',
        approvalRequired: true,
      },
      {
        name: '36-Month Trade-In Valuation Offer',
        trigger: 'Tenure >= 36 months & Propensity >= 70%',
        channel: 'Branch Follow-up',
        approvalRequired: true,
      },
    ],
  },

  automotive_parts: {
    id: 'automotive_parts',
    name: 'Automotive Parts & Distribution',
    description:
      'OEM & aftermarket spare parts wholesale distribution, B2B independent workshop replenishment, and fast-fit retail outlets.',
    terminology: {
      customerSingular: 'Parts Buyer / Workshop',
      customerPlural: 'Parts Buyers & Workshops',
      branchSingular: 'Distribution Hub / Outlet',
      branchPlural: 'Distribution Hubs & Outlets',
      productSingular: 'Parts SKU / Bundle',
      productPlural: 'Parts SKUs & Bundles',
      transactionSingular: 'Parts Order / Restock',
      transactionPlural: 'Parts Orders & Restocks',
      primaryRevenueLabel: 'Parts & Distribution Revenue',
      retentionMetricLabel: 'Workshop Reorder Rate',
    },
    activatedModules: ['BM01', 'BM02', 'BM03', 'BM04', 'BM05', 'BM06', 'BM07', 'BM08'],
    extensionAttributes: [
      { key: 'buyer_account_type', label: 'Account Channel Type', dataType: 'string' },
      { key: 'reorder_cycle_days', label: 'Avg Reorder Cycle (Days)', dataType: 'number' },
      { key: 'top_sku_category', label: 'Primary Parts Category', dataType: 'string' },
      { key: 'fulfillment_tier', label: 'Distribution Tier', dataType: 'string' },
    ],
    kpiDefinitions: [
      {
        key: 'parts_revenue',
        label: 'Parts & Distribution Revenue',
        unit: 'IDR',
        formulaDescription: 'Total B2B wholesale spare parts shipments and fast-fit retail outlet orders within the selected territory.',
        targetBenchmark: 'Growth >= +11% QoQ (Demo Benchmark)',
      },
      {
        key: 'workshop_reorder_rate',
        label: 'Workshop Reorder Rate',
        unit: '%',
        formulaDescription: 'Percentage of registered partner workshops and retail accounts completing repeat parts orders within cycle.',
        targetBenchmark: '>= 80% Active Reorder Rate',
      },
      {
        key: 'sku_cross_sell',
        label: 'Multi-SKU Assortment Expansion Pool',
        unit: 'Accounts',
        formulaDescription: 'Active workshops and fleet depots scored >= 68% propensity for battery, brake, and suspension bundling.',
        targetBenchmark: '>= 3.2 SKU Lines / Buyer',
      },
      {
        key: 'dormant_distributor',
        label: 'Lapsing Workshop Restock Alerts',
        unit: 'Accounts',
        formulaDescription: 'Partner workshops exceeding expected reorder cycle and flagged for distributor sales rep follow-up.',
        targetBenchmark: '<= 14% Lapsing Accounts',
      },
    ],
    lifecycleStages: ['New Partner Account', 'Active Reorder', 'Multi-SKU Core', 'Platinum Sub-Dealer', 'Restock At-Risk'],
    aiUseCases: [
      {
        id: 'parts-churn',
        title: 'Workshop Reorder Lapse & Switching Risk',
        modelType: 'Classification',
        description: 'Detects independent workshops and sub-dealers delaying battery, filter, or brake restock orders.',
      },
      {
        id: 'parts-bundle',
        title: 'Multi-Category SKU Bundle Propensity',
        modelType: 'Propensity',
        description: 'Scores B2B accounts likely to expand from batteries/oils into shock absorbers and fast-moving wear parts.',
      },
      {
        id: 'parts-geo',
        title: 'Regional Workshop Density & Depot Coverage',
        modelType: 'Spatial Scoring',
        description: 'Scores East Java industrial and metro corridors for same-day parts delivery and Shop&Drive expansion.',
      },
    ],
    dashboardLayoutEmphasis: 'B2B workshop reorder velocity, SKU assortment breadth, and regional depot coverage',
    businessRules: [
      'Flag B2B workshop accounts with > 60 days since last parts restock as At-Risk Retention.',
      'Require Business Manager approval before releasing bulk sub-dealer rebate tiers.',
      'Prioritize districts with Geographic Opportunity Score >= 78 for express parts van routing.',
    ],
    workflowTemplates: [
      {
        name: 'Fast-Moving Parts Replenishment Reminder',
        trigger: 'Reorder cycle overdue > 15 days',
        channel: 'WhatsApp',
        approvalRequired: true,
      },
      {
        name: 'Battery & Brake Quarterly Workshop Rebate Bundle',
        trigger: 'Propensity >= 70% & Channel = B2B Workshop',
        channel: 'Branch Follow-up',
        approvalRequired: true,
      },
    ],
  },

  retail: {
    id: 'retail',
    name: 'Retail',
    description:
      'Omnichannel retail chains, basket value optimization, loyalty tier retention, and store catchment analytics.',
    terminology: {
      customerSingular: 'Loyalty Member',
      customerPlural: 'Loyalty Members',
      branchSingular: 'Retail Store',
      branchPlural: 'Retail Stores',
      productSingular: 'Merchandise Category',
      productPlural: 'Merchandise Categories',
      transactionSingular: 'POS / Online Order',
      transactionPlural: 'POS & Online Orders',
      primaryRevenueLabel: 'Gross Merchandise Revenue',
      retentionMetricLabel: 'Repeat Purchase Rate',
    },
    activatedModules: ['BM01', 'BM02', 'BM03', 'BM04', 'BM05', 'BM06', 'BM07', 'BM08'],
    extensionAttributes: [
      { key: 'loyalty_tier', label: 'Loyalty Tier', dataType: 'string' },
      { key: 'avg_basket_items', label: 'Avg Items / Basket', dataType: 'number' },
      { key: 'preferred_category', label: 'Top Category', dataType: 'string' },
      { key: 'omnichannel_flag', label: 'Omnichannel Shopper', dataType: 'string' },
    ],
    kpiDefinitions: [
      {
        key: 'avg_basket_value',
        label: 'Gross Merchandise Revenue',
        unit: 'IDR',
        formulaDescription: 'Total POS and digital commerce order value across permitted stores in the selected timeframe.',
        targetBenchmark: 'Avg Basket >= IDR 1.2M',
      },
      {
        key: 'repeat_purchase_rate',
        label: 'Repeat Purchase Rate',
        unit: '%',
        formulaDescription: 'Share of loyalty members completing 2+ orders within the active evaluation period.',
        targetBenchmark: '>= 72% Repeat Rate',
      },
      {
        key: 'loyalty_engagement',
        label: 'High-Propensity Upsell Pool',
        unit: 'Members',
        formulaDescription: 'Active loyalty members scored >= 68% for cross-category seasonal promotions.',
        targetBenchmark: '>= 22% Member Engagement',
      },
      {
        key: 'store_conversion',
        label: 'Store Campaign Conversion',
        unit: '%',
        formulaDescription: 'Simulated campaign redemption rate across WhatsApp, Email, and SMS offers.',
        targetBenchmark: '>= 14% Offer Redemption',
      },
    ],
    lifecycleStages: ['First-Time Buyer', 'Repeat Shopper', 'Gold Loyalty', 'VIP Omnichannel', 'Lapsing Member'],
    aiUseCases: [
      {
        id: 'retail-lapse',
        title: 'Loyalty Member Lapse Prediction',
        modelType: 'Classification',
        description: 'Detects declining purchase frequency across urban store catchments.',
      },
      {
        id: 'retail-basket',
        title: 'Cross-Category Basket Expansion',
        modelType: 'Propensity',
        description: 'Identifies members likely to adopt higher-margin lifestyle and home essentials.',
      },
      {
        id: 'retail-catchment',
        title: 'Urban Store Catchment Opportunity',
        modelType: 'Spatial Scoring',
        description: 'Scores DKI Jakarta districts by member purchasing power and store proximity.',
      },
    ],
    dashboardLayoutEmphasis: 'Basket value, loyalty retention, and urban catchment density',
    businessRules: [
      'Trigger win-back voucher workflow if Gold/VIP member has no purchase for 45 days.',
      'Cap promotional SMS/WhatsApp frequency at 2 campaigns per member per month.',
    ],
    workflowTemplates: [
      {
        name: 'VIP Seasonal Preview Invitation',
        trigger: 'Loyalty Tier = VIP & Propensity >= 72%',
        channel: 'WhatsApp',
        approvalRequired: true,
      },
      {
        name: '45-Day Lapsing Member Win-Back',
        trigger: 'Churn Risk = High',
        channel: 'Email',
        approvalRequired: true,
      },
    ],
  },

  banking: {
    id: 'banking',
    name: 'Banking & Financial Services',
    description:
      'Digital & commercial banking portfolios, cross-sell intelligence, branch/hub catchment coverage, and deposit attrition defense.',
    terminology: {
      customerSingular: 'Account Holder',
      customerPlural: 'Account Holders',
      branchSingular: 'Bank Branch',
      branchPlural: 'Bank Branches',
      productSingular: 'Financial Product',
      productPlural: 'Financial Products',
      transactionSingular: 'Portfolio Activity',
      transactionPlural: 'Portfolio Activities',
      primaryRevenueLabel: 'Fee & Portfolio Volume',
      retentionMetricLabel: 'Portfolio Retention Rate',
    },
    activatedModules: ['BM01', 'BM02', 'BM03', 'BM04', 'BM05', 'BM06', 'BM07', 'BM08'],
    extensionAttributes: [
      { key: 'account_tier', label: 'Banking Tier', dataType: 'string' },
      { key: 'product_holding_count', label: 'Active Products', dataType: 'number' },
      { key: 'digital_banking_usage', label: 'Mobile App Adoption', dataType: 'string' },
      { key: 'credit_profile', label: 'Relationship Band', dataType: 'string' },
    ],
    kpiDefinitions: [
      {
        key: 'portfolio_growth',
        label: 'Fee & Portfolio Volume',
        unit: 'IDR',
        formulaDescription: 'Aggregate transaction and product fee volume across permitted branches and segments.',
        targetBenchmark: '+10% YoY Portfolio Expansion',
      },
      {
        key: 'engagement_rate',
        label: 'Portfolio Retention Rate',
        unit: '%',
        formulaDescription: 'Percentage of account holders maintaining active monthly balances and digital engagement.',
        targetBenchmark: '>= 84% Retained',
      },
      {
        key: 'cross_sell',
        label: 'Cross-Sell Opportunity Pool',
        unit: 'Accounts',
        formulaDescription: 'Single-product account holders scored >= 68% propensity for wealth, mortgage, or SME credit.',
        targetBenchmark: '>= 2.4 Products / Account',
      },
      {
        key: 'branch_coverage',
        label: 'Branch Coverage Index',
        unit: 'Score',
        formulaDescription: 'Weighted regional opportunity score comparing commercial deposit potential with branch capacity.',
        targetBenchmark: 'Score >= 75',
      },
    ],
    lifecycleStages: ['New Depositor', 'Digital Active', 'Multi-Product Core', 'Priority Wealth', 'Attrition Watch'],
    aiUseCases: [
      {
        id: 'bank-attrition',
        title: 'Deposit Balance Attrition Risk',
        modelType: 'Classification',
        description: 'Highlights accounts showing sustained outflow or falling mobile banking logins.',
      },
      {
        id: 'bank-xsell',
        title: 'Credit & Wealth Cross-Sell Propensity',
        modelType: 'Propensity',
        description: 'Prioritizes eligible accounts for pre-screened relationship manager outreach.',
      },
    ],
    dashboardLayoutEmphasis: 'Portfolio depth, cross-sell propensity, and branch territory coverage',
    businessRules: [
      'All outbound financial product offers require Compliance & Campaign Manager approval.',
      'Mask account numbers and personal contact identifiers in operational list views.',
    ],
    workflowTemplates: [
      {
        name: 'Priority Relationship Review Call',
        trigger: 'Attrition Risk = High & Tier = Priority',
        channel: 'Call Center',
        approvalRequired: true,
      },
    ],
  },

  insurance: {
    id: 'insurance',
    name: 'Insurance',
    description:
      'Policyholder renewal intelligence, agency territory whitespace, rider cross-sell, and lapse prevention.',
    terminology: {
      customerSingular: 'Policyholder',
      customerPlural: 'Policyholders',
      branchSingular: 'Agency Office',
      branchPlural: 'Agency Offices',
      productSingular: 'Insurance Policy',
      productPlural: 'Insurance Policies',
      transactionSingular: 'Premium Payment',
      transactionPlural: 'Premium Payments',
      primaryRevenueLabel: 'Gross Written Premium',
      retentionMetricLabel: 'Policy Persistency Rate',
    },
    activatedModules: ['BM01', 'BM02', 'BM03', 'BM04', 'BM05', 'BM06', 'BM07', 'BM08'],
    extensionAttributes: [
      { key: 'policy_line', label: 'Primary Policy Line', dataType: 'string' },
      { key: 'renewal_window_days', label: 'Days to Renewal', dataType: 'number' },
      { key: 'claim_history_band', label: 'Claim Frequency Band', dataType: 'string' },
      { key: 'advisor_channel', label: 'Distribution Channel', dataType: 'string' },
    ],
    kpiDefinitions: [
      {
        key: 'gwp',
        label: 'Gross Written Premium',
        unit: 'IDR',
        formulaDescription: 'Total collected premium volume within the selected regional scope and date window.',
        targetBenchmark: '+12% Annual GWP',
      },
      {
        key: 'persistency',
        label: 'Policy Persistency Rate',
        unit: '%',
        formulaDescription: 'Percentage of active policyholders renewing policies on schedule without lapse.',
        targetBenchmark: '>= 82% Persistency',
      },
      {
        key: 'rider_upsell',
        label: 'Rider Upgrade Opportunities',
        unit: 'Policies',
        formulaDescription: 'Policyholders with high propensity for health or critical illness protection riders.',
        targetBenchmark: '>= 16% Rider Attach Rate',
      },
    ],
    lifecycleStages: ['Underwriting Complete', 'Active Year 1', 'Multi-Year Retained', 'Renewal Due', 'Lapse Risk'],
    aiUseCases: [
      {
        id: 'ins-lapse',
        title: 'Policy Lapse Early Warning',
        modelType: 'Classification',
        description: 'Identifies renewal-due policies with elevated non-payment probability.',
      },
    ],
    dashboardLayoutEmphasis: 'Policy persistency, renewal pipeline, and agency territory coverage',
    businessRules: [
      'Notify assigned agency advisor 45 days before policy renewal for high-risk accounts.',
    ],
    workflowTemplates: [
      {
        name: 'Renewal Grace Period Outreach',
        trigger: 'Renewal <= 30 days & Lapse Risk = High',
        channel: 'Call Center',
        approvalRequired: true,
      },
    ],
  },

  property: {
    id: 'property',
    name: 'Property',
    description:
      'Real estate site opportunity scoring, buyer/investor pipeline, catchment potential, and regional yield analytics.',
    terminology: {
      customerSingular: 'Buyer / Investor',
      customerPlural: 'Buyers & Investors',
      branchSingular: 'Marketing Gallery',
      branchPlural: 'Marketing Galleries',
      productSingular: 'Property Asset / Unit',
      productPlural: 'Property Assets & Units',
      transactionSingular: 'Booking & Settlement',
      transactionPlural: 'Bookings & Settlements',
      primaryRevenueLabel: 'Contracted Property Value',
      retentionMetricLabel: 'Repeat Investor Rate',
    },
    activatedModules: ['BM01', 'BM02', 'BM03', 'BM04', 'BM05', 'BM06', 'BM07', 'BM08'],
    extensionAttributes: [
      { key: 'property_type', label: 'Preferred Asset Class', dataType: 'string' },
      { key: 'investment_horizon_yrs', label: 'Investment Horizon (Yrs)', dataType: 'number' },
      { key: 'financing_scheme', label: 'Payment Scheme', dataType: 'string' },
      { key: 'catchment_zone', label: 'Target Catchment', dataType: 'string' },
    ],
    kpiDefinitions: [
      {
        key: 'investment_performance',
        label: 'Contracted Property Value',
        unit: 'IDR',
        formulaDescription: 'Total contracted booking and milestone settlement value across selected territories.',
        targetBenchmark: '+15% Pipeline Conversion',
      },
      {
        key: 'site_opportunity',
        label: 'Site Opportunity Score',
        unit: 'Index / 100',
        formulaDescription: 'Composite spatial demand index combining catchment income, investor density, and gallery coverage.',
        targetBenchmark: 'Index >= 78',
      },
      {
        key: 'market_demand',
        label: 'Qualified Expansion Buyers',
        unit: 'Investors',
        formulaDescription: 'Existing buyers/investors scored >= 68% propensity for second-unit or commercial lot acquisition.',
        targetBenchmark: '>= 20% Repeat Portfolio',
      },
    ],
    lifecycleStages: ['Site Inquiry', 'Gallery Visit', 'Booking Confirmed', 'Handover Complete', 'Repeat Investor'],
    aiUseCases: [
      {
        id: 'prop-site',
        title: 'Catchment & Site Opportunity Scoring',
        modelType: 'Spatial Scoring',
        description: 'Evaluates Bali regencies for residential villa, hospitality, and commercial land demand.',
      },
      {
        id: 'prop-repeat',
        title: 'Portfolio Expansion Propensity',
        modelType: 'Propensity',
        description: 'Predicts which existing unit owners are ready for phase-2 launch invitations.',
      },
    ],
    dashboardLayoutEmphasis: 'Site opportunity index, catchment potential, and investor pipeline',
    businessRules: [
      'Route high-value repeat investors (>= IDR 5B LTV) directly to private Marketing Gallery briefings.',
    ],
    workflowTemplates: [
      {
        name: 'Phase-2 Private Launch Preview',
        trigger: 'Segment = High-Value Loyal & Propensity >= 70%',
        channel: 'Branch Follow-up',
        approvalRequired: true,
      },
    ],
  },

  healthcare: {
    id: 'healthcare',
    name: 'Healthcare',
    description:
      'Hospital and clinic network engagement, preventive care adherence, regional access gaps, and patient retention.',
    terminology: {
      customerSingular: 'Patient Member',
      customerPlural: 'Patient Members',
      branchSingular: 'Clinic / Hospital',
      branchPlural: 'Clinics & Hospitals',
      productSingular: 'Care Program',
      productPlural: 'Care Programs',
      transactionSingular: 'Care Visit / Package',
      transactionPlural: 'Care Visits & Packages',
      primaryRevenueLabel: 'Care Program Revenue',
      retentionMetricLabel: 'Care Continuity Rate',
    },
    activatedModules: ['BM01', 'BM02', 'BM03', 'BM04', 'BM05', 'BM06', 'BM07', 'BM08'],
    extensionAttributes: [
      { key: 'care_plan', label: 'Active Care Plan', dataType: 'string' },
      { key: 'annual_checkups', label: 'Checkups (12m)', dataType: 'number' },
      { key: 'coverage_type', label: 'Payer Coverage', dataType: 'string' },
      { key: 'telehealth_enrolled', label: 'Telehealth Enrolled', dataType: 'string' },
    ],
    kpiDefinitions: [
      {
        key: 'care_revenue',
        label: 'Care Program Revenue',
        unit: 'IDR',
        formulaDescription: 'Total preventive and outpatient care package revenue across permitted facilities.',
        targetBenchmark: '+9% Preventive Growth',
      },
      {
        key: 'care_continuity',
        label: 'Care Continuity Rate',
        unit: '%',
        formulaDescription: 'Share of enrolled patient members adhering to recommended follow-up intervals.',
        targetBenchmark: '>= 80% Adherence',
      },
    ],
    lifecycleStages: ['New Registration', 'Preventive Active', 'Chronic Care Managed', 'Follow-Up Due', 'Re-Engagement'],
    aiUseCases: [
      {
        id: 'hc-adherence',
        title: 'Preventive Follow-Up Drop-Off Risk',
        modelType: 'Classification',
        description: 'Identifies wellness members overdue for annual screening.',
      },
    ],
    dashboardLayoutEmphasis: 'Care continuity, clinic accessibility, and preventive outreach',
    businessRules: [
      'Ensure all patient outreach uses consented reminders without disclosing clinical details.',
    ],
    workflowTemplates: [
      {
        name: 'Annual Preventive Checkup Reminder',
        trigger: 'Last visit > 11 months',
        channel: 'WhatsApp',
        approvalRequired: true,
      },
    ],
  },
};

export const INDUSTRY_LIST: IndustryProfile[] = Object.values(INDUSTRY_PROFILES);

export function getIndustryProfile(industryId: IndustryId): IndustryProfile {
  return INDUSTRY_PROFILES[industryId] ?? INDUSTRY_PROFILES.automotive;
}
