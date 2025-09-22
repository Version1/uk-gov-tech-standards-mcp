/**
 * Curated UK Government Technology Standards Configuration
 * 
 * This file defines the specific standards URLs and their categorization
 * based on applicability context for different types of development work.
 */

export interface ApplicabilityContext {
  workType: ('frontend' | 'backend' | 'fullstack' | 'mobile' | 'api' | 'data' | 'infrastructure' | 'security' | 'compliance')[];
  serviceType: ('citizen-facing' | 'internal' | 'b2b' | 'data-service' | 'api-service' | 'legacy-migration')[];
  developmentPhase: ('planning' | 'design' | 'development' | 'testing' | 'deployment' | 'maintenance' | 'decommission')[];
  mandatory: boolean;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface StandardCategory {
  id: string;
  name: string;
  description: string;
  applicabilityContext: ApplicabilityContext;
  urls: string[];
}

export const CURATED_STANDARDS_CONFIG: StandardCategory[] = [
  {
    id: 'accessibility',
    name: 'Accessibility',
    description: 'Standards for making services accessible to all users, including those with disabilities. Relevant for front-end work and user interface implementation.',
    applicabilityContext: {
      workType: ['frontend', 'fullstack'],
      serviceType: ['citizen-facing', 'internal'],
      developmentPhase: ['design', 'development', 'testing'],
      mandatory: true,
      priority: 'critical'
    },
    urls: [
      'https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction',
      'https://www.gov.uk/service-manual/helping-people-to-use-your-service/testing-for-accessibility',
      'https://www.gov.uk/service-manual/helping-people-to-use-your-service/understanding-wcag#wcag-20-design-principles',
      'https://www.gov.uk/government/publications/understanding-disabilities-and-impairments-user-profiles/ashleigh-partially-sighted-screenreader-user',
      'https://www.gov.uk/government/publications/understanding-disabilities-and-impairments-user-profiles/christopher-user-with-rheumatoid-arthritis',
      'https://www.gov.uk/government/publications/understanding-disabilities-and-impairments-user-profiles/claudia-partially-sighted-screen-magnifier-user',
      'https://www.gov.uk/government/publications/understanding-disabilities-and-impairments-user-profiles/pawel-user-with-aspergers',
      'https://www.gov.uk/government/publications/understanding-disabilities-and-impairments-user-profiles/ron-older-user-with-multiple-conditions',
      'https://www.gov.uk/government/publications/understanding-disabilities-and-impairments-user-profiles/saleem-profoundly-deaf-user',
      'https://www.gov.uk/government/publications/understanding-disabilities-and-impairments-user-profiles/simone-dyslexic-user'
    ]
  },
  {
    id: 'apis',
    name: 'APIs',
    description: 'Standards for designing, implementing, and maintaining APIs (REST, SOAP, etc). Relevant for back-end work implementing APIs regardless of architecture.',
    applicabilityContext: {
      workType: ['backend', 'api', 'fullstack'],
      serviceType: ['b2b', 'api-service', 'data-service'],
      developmentPhase: ['design', 'development', 'testing', 'deployment'],
      mandatory: false,
      priority: 'high'
    },
    urls: [
      'https://www.gov.uk/guidance/gds-api-technical-and-data-standards',
      'https://www.gov.uk/government/collections/api-design-guidance',
      'https://www.gov.uk/guidance/setting-api-service-levels',
      'https://www.gov.uk/guidance/writing-api-reference-documentation',
      'https://www.gov.uk/guidance/how-to-document-apis'
    ]
  },
  {
    id: 'application-development',
    name: 'Application Development',
    description: 'General development standards applicable to ANY code that is developed.',
    applicabilityContext: {
      workType: ['frontend', 'backend', 'fullstack', 'mobile', 'api', 'data', 'infrastructure'],
      serviceType: ['citizen-facing', 'internal', 'b2b', 'data-service', 'api-service'],
      developmentPhase: ['development', 'testing', 'deployment'],
      mandatory: true,
      priority: 'critical'
    },
    urls: [
      'https://www.ncsc.gov.uk/guidance/application-development-guidance-introduction'
    ]
  },
  {
    id: 'mobile-apps',
    name: 'Native or Hybrid Apps',
    description: 'Standards for mobile applications that are installed on devices (not web-based interfaces).',
    applicabilityContext: {
      workType: ['mobile'],
      serviceType: ['citizen-facing'],
      developmentPhase: ['design', 'development', 'testing', 'deployment'],
      mandatory: false,
      priority: 'high'
    },
    urls: [
      'https://www.gov.uk/service-manual/technology/working-with-mobile-technology#native-or-hybrid-apps',
      'https://www.ncsc.gov.uk/collection/device-security-guidance/platform-guides/android',
      'https://www.ncsc.gov.uk/collection/application-development/apple-ios-application-development'
    ]
  },
  {
    id: 'cloud-strategy',
    name: 'Cloud Strategy',
    description: 'Standards for cloud adoption and implementation, relevant for all applications.',
    applicabilityContext: {
      workType: ['infrastructure', 'backend', 'fullstack'],
      serviceType: ['citizen-facing', 'internal', 'b2b', 'data-service', 'api-service'],
      developmentPhase: ['planning', 'design', 'deployment'],
      mandatory: true,
      priority: 'critical'
    },
    urls: [
      'https://www.gov.uk/guidance/government-cloud-first-policy',
      'https://www.ncsc.gov.uk/collection/cloud/understanding-cloud-services/service-and-deployment-models'
    ]
  },
  {
    id: 'data-protection',
    name: 'Data',
    description: 'Data protection, GDPR, and data handling standards relevant everywhere.',
    applicabilityContext: {
      workType: ['frontend', 'backend', 'fullstack', 'mobile', 'api', 'data'],
      serviceType: ['citizen-facing', 'internal', 'b2b', 'data-service', 'api-service'],
      developmentPhase: ['planning', 'design', 'development', 'testing', 'deployment', 'maintenance'],
      mandatory: true,
      priority: 'critical'
    },
    urls: [
      'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/',
      'https://www.gov.uk/government/publications/open-data-charter'
    ]
  },
  {
    id: 'citizen-services',
    name: 'Design and Build Government Services',
    description: 'Standards for citizen-facing government services including Technology Code of Practice and Service Standard.',
    applicabilityContext: {
      workType: ['frontend', 'fullstack'],
      serviceType: ['citizen-facing'],
      developmentPhase: ['planning', 'design', 'development', 'testing', 'deployment'],
      mandatory: true,
      priority: 'critical'
    },
    urls: [
      // Technology Code of Practice
      'https://www.gov.uk/guidance/the-technology-code-of-practice',
      'https://www.gov.uk/guidance/define-user-needs',
      'https://www.gov.uk/guidance/make-things-accessible',
      'https://www.gov.uk/guidance/be-open-and-use-open-source',
      'https://www.gov.uk/guidance/make-use-of-open-standards',
      'https://www.gov.uk/guidance/use-cloud-first',
      'https://www.gov.uk/guidance/make-things-secure',
      'https://www.gov.uk/guidance/make-privacy-integral',
      'https://www.gov.uk/guidance/share-and-reuse-technology',
      'https://www.gov.uk/guidance/integrate-and-adapt-technology',
      'https://www.gov.uk/guidance/make-better-use-of-data',
      'https://www.gov.uk/guidance/define-your-purchasing-strategy',
      'https://www.gov.uk/guidance/make-your-technology-sustainable',
      // Service Standard
      'https://www.gov.uk/service-manual/service-standard',
      'https://www.gov.uk/service-manual/service-standard/point-1-understand-user-needs',
      'https://www.gov.uk/service-manual/service-standard/point-2-solve-a-whole-problem',
      'https://www.gov.uk/service-manual/service-standard/point-3-join-up-across-channels',
      'https://www.gov.uk/service-manual/service-standard/point-4-make-the-service-simple-to-use',
      'https://www.gov.uk/service-manual/service-standard/point-5-make-sure-everyone-can-use-the-service',
      'https://www.gov.uk/service-manual/service-standard/point-6-have-a-multidisciplinary-team',
      'https://www.gov.uk/service-manual/service-standard/point-7-use-agile-ways-of-working',
      'https://www.gov.uk/service-manual/service-standard/point-8-iterate-and-improve-frequently',
      'https://www.gov.uk/service-manual/service-standard/point-9-create-a-secure-service',
      'https://www.gov.uk/service-manual/service-standard/point-10-define-success-publish-performance-data',
      'https://www.gov.uk/service-manual/service-standard/point-11-choose-the-right-tools-and-technology',
      'https://www.gov.uk/service-manual/service-standard/point-12-make-new-source-code-open',
      'https://www.gov.uk/service-manual/service-standard/point-13-use-common-standards-components-patterns',
      'https://www.gov.uk/service-manual/service-standard/point-14-operate-a-reliable-service',
      // Content Design
      'https://www.gov.uk/guidance/content-design/campaigns-on-gov-uk-standards-and-guidelines',
      // Naming Services
      'https://www.gov.uk/apply-for-and-manage-a-gov-uk-domain-name'
    ]
  },
  {
    id: 'security',
    name: 'Secure By Design',
    description: 'Security principles and standards applicable EVERYWHERE in development work.',
    applicabilityContext: {
      workType: ['frontend', 'backend', 'fullstack', 'mobile', 'api', 'data', 'infrastructure', 'security'],
      serviceType: ['citizen-facing', 'internal', 'b2b', 'data-service', 'api-service'],
      developmentPhase: ['planning', 'design', 'development', 'testing', 'deployment', 'maintenance'],
      mandatory: true,
      priority: 'critical'
    },
    urls: [
      'https://www.ncsc.gov.uk/collection/cyber-security-design-principles',
      'https://www.ncsc.gov.uk/collection/cyber-security-design-principles/cyber-security-design-principles',
      'https://www.ncsc.gov.uk/collection/cyber-security-design-principles/establish-the-context-before-designing-a-system',
      'https://www.ncsc.gov.uk/collection/cyber-security-design-principles/making-compromise-difficult',
      'https://www.ncsc.gov.uk/collection/cyber-security-design-principles/making-disruption-difficult',
      'https://www.ncsc.gov.uk/collection/cyber-security-design-principles/making-compromise-detection-easier',
      'https://www.ncsc.gov.uk/collection/cyber-security-design-principles/reducing-the-impact-of-compromise',
      'https://www.ncsc.gov.uk/collection/cyber-security-design-principles/virtualisation-security-design-principles',
      'https://www.ncsc.gov.uk/collection/cyber-security-design-principles/virtualisation-security-design-principles/establish-the-context',
      'https://www.ncsc.gov.uk/collection/cyber-security-design-principles/virtualisation-security-design-principles/making-compromise-difficult',
      'https://www.ncsc.gov.uk/collection/cyber-security-design-principles/virtualisation-security-design-principles/making-disruption-difficult',
      'https://www.ncsc.gov.uk/collection/cyber-security-design-principles/virtualisation-security-design-principles/making-compromise-detection-easier',
      'https://www.ncsc.gov.uk/collection/cyber-security-design-principles/virtualisation-security-design-principles/reducing-the-impact-of-compromise',
      'https://www.ncsc.gov.uk/collection/cyber-security-design-principles/examples'
    ]
  },
  {
    id: 'legacy-technologies',
    name: 'Legacy Technologies',
    description: 'Standards relevant when looking at old codebases or legacy technical stacks.',
    applicabilityContext: {
      workType: ['backend', 'fullstack', 'infrastructure'],
      serviceType: ['internal', 'legacy-migration'],
      developmentPhase: ['planning', 'development', 'maintenance', 'decommission'],
      mandatory: false,
      priority: 'medium'
    },
    urls: [
      'https://www.gov.uk/guidance/managing-legacy-technology',
      'https://www.ncsc.gov.uk/collection/device-security-guidance/managing-deployed-devices/obsolete-products',
      'https://www.gov.uk/service-manual/technology/moving-away-from-legacy-systems'
    ]
  },
  {
    id: 'open-standards',
    name: 'Open source and open standards',
    description: 'Standards relevant EVERYWHERE for open source adoption and open standards compliance.',
    applicabilityContext: {
      workType: ['frontend', 'backend', 'fullstack', 'mobile', 'api', 'data', 'infrastructure'],
      serviceType: ['citizen-facing', 'internal', 'b2b', 'data-service', 'api-service'],
      developmentPhase: ['planning', 'design', 'development', 'deployment'],
      mandatory: true,
      priority: 'high'
    },
    urls: [
      'https://www.gov.uk/government/collections/open-government',
      'https://opensource.org',
      'https://www.gov.uk/government/publications/open-source-guidance/when-code-should-be-open-or-closed',
      'https://www.gov.uk/government/publications/open-source-guidance/security-considerations-when-coding-in-the-open',
      'https://www.gov.uk/government/publications/open-data-charter',
      'https://www.gov.uk/government/publications/open-formats-implementation-plan',
      'https://www.gov.uk/government/collections/open-standards-for-government-data-and-technology',
      'https://www.gov.uk/government/publications/open-standards-principles/open-standards-principles',
      'https://www.gov.uk/service-manual/technology/working-with-open-standards'
    ]
  },
  {
    id: 'compliance-standards',
    name: 'Standards',
    description: 'Regulatory and compliance standards relevant where the standard is applicable.',
    applicabilityContext: {
      workType: ['frontend', 'backend', 'fullstack', 'mobile', 'api', 'data', 'infrastructure', 'security', 'compliance'],
      serviceType: ['citizen-facing', 'internal', 'b2b', 'data-service', 'api-service'],
      developmentPhase: ['planning', 'design', 'development', 'testing', 'deployment', 'maintenance'],
      mandatory: true,
      priority: 'critical'
    },
    urls: [
      'https://www.gov.uk/government/publications/the-minimum-cyber-security-standard',
      'https://www.ncsc.gov.uk/collection/cyber-assessment-framework',
      'https://www.pcisecuritystandards.org',
      'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/',
      'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/',
      'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/',
      'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/',
      'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/controllers-and-processors/',
      'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/',
      'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-sharing/',
      'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/exemptions/',
      'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/personal-information-what-is-it/',
      'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/subject-access-requests/',
      'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/security/',
      'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/',
      'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/employment/',
      'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/designing-products-that-protect-privacy/',
      'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/',
      'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/the-research-provisions/',
      'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-and-journalism-code-of-practice/',
      'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/training-videos/',
      'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/online-tracking/',
      'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/online-safety-and-data-protection/'
    ]
  }
];

/**
 * Get all URLs from all categories
 */
export function getAllCuratedUrls(): string[] {
  return CURATED_STANDARDS_CONFIG.flatMap(category => category.urls);
}

/**
 * Get category configuration for a specific URL
 */
export function getCategoryForUrl(url: string): StandardCategory | undefined {
  return CURATED_STANDARDS_CONFIG.find(category => 
    category.urls.includes(url)
  );
}

/**
 * Get applicable standards based on work context
 */
export function getApplicableStandards(
  workType: string[], 
  serviceType: string[], 
  developmentPhase: string[]
): StandardCategory[] {
  return CURATED_STANDARDS_CONFIG.filter(category => {
    const context = category.applicabilityContext;
    
    // Check if any work type matches
    const workTypeMatch = workType.some(wt => context.workType.includes(wt as any));
    
    // Check if any service type matches  
    const serviceTypeMatch = serviceType.some(st => context.serviceType.includes(st as any));
    
    // Check if any development phase matches
    const phaseMatch = developmentPhase.some(dp => context.developmentPhase.includes(dp as any));
    
    return workTypeMatch && serviceTypeMatch && phaseMatch;
  });
}

/**
 * Get standards by priority level
 */
export function getStandardsByPriority(priority: 'critical' | 'high' | 'medium' | 'low'): StandardCategory[] {
  return CURATED_STANDARDS_CONFIG.filter(category => 
    category.applicabilityContext.priority === priority
  );
}

/**
 * Get mandatory standards
 */
export function getMandatoryStandards(): StandardCategory[] {
  return CURATED_STANDARDS_CONFIG.filter(category => 
    category.applicabilityContext.mandatory
  );
}
