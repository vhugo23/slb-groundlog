export interface SlbCenter {
  name: string
  lat: number
  lon: number
  type: 'research' | 'learning'
  description: string
  link: string
}

// Real, sourced from slb.com's own "Our Tech Development" page. Kept as a
// separate, non-queryable context layer on purpose - there's no ground-truth
// record to check a query against for an office location, and the whole
// point of GroundLog is the distinction between grounded and not.
export const SLB_CENTERS: SlbCenter[] = [
  { name: 'Clamart Technology Center (France)', lat: 48.7942, lon: 2.2686, type: 'research', description: "SLB's largest technology hub in Europe—and its second largest worldwide.", link: 'https://www.slb.com/about/who-we-are/our-technology' },
  { name: 'Cambridge Research Center (UK)', lat: 52.2168, lon: 0.1568, type: 'research', description: 'Pioneers new energy solutions — hydrogen, geothermal energy, lithium extraction, energy storage, and carbon sequestration.', link: 'https://www.slb.com/about/who-we-are/our-technology' },
  { name: 'Schlumberger-Doll Research Center (Cambridge, MA)', lat: 42.3656, lon: -71.0836, type: 'research', description: "Established in 1948; one of SLB's most celebrated and innovative research centers.", link: 'https://www.slb.com/about/who-we-are/our-technology' },
  { name: 'Beijing Geoscience Center (China)', lat: 39.9042, lon: 116.4074, type: 'research', description: "Serves as the digital backbone of SLB's drilling solutions.", link: 'https://www.slb.com/about/who-we-are/our-technology' },
  { name: 'Dhahran Research Center (Saudi Arabia)', lat: 26.2361, lon: 50.0393, type: 'research', description: "Crucial to advancing SLB's understanding of carbonate reservoirs.", link: 'https://www.slb.com/about/who-we-are/our-technology' },
  { name: 'Kellyville Learning Center (near Tulsa, USA)', lat: 36.1540, lon: -95.9928, type: 'learning', description: "A cornerstone of SLB's training and development efforts, empowering teams for over 50 years.", link: 'https://www.slb.com/about/who-we-are/our-technology' },
  { name: 'Middle East and Asia Learning Center (Abu Dhabi, UAE)', lat: 24.4539, lon: 54.3773, type: 'learning', description: "Nurtures SLB's global workforce, shaping the workforce of tomorrow.", link: 'https://www.slb.com/about/who-we-are/our-technology' },
]
