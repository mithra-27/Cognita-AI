export const DIMENSIONS = [
  {
    key: 'anumana',
    sanskrit: 'Anumāna',
    english: 'Logical / inferential reasoning',
    description: 'Drawing conclusions from given premises through structured inference.',
    icon: 'BrainCircuit',
  },
  {
    key: 'arthapatti',
    sanskrit: 'Arthāpatti',
    english: 'Abductive reasoning / problem solving',
    description: 'Inferring the best explanation for an observation or situation.',
    icon: 'Lightbulb',
  },
  {
    key: 'upamana',
    sanskrit: 'Upamāna',
    english: 'Analogical reasoning',
    description: 'Understanding the unfamiliar by comparing it to the familiar.',
    icon: 'GitCompare',
  },
  {
    key: 'pratyaksha',
    sanskrit: 'Pratyakṣa',
    english: 'Observation / visual reasoning',
    description: 'Interpreting patterns, diagrams, and visual information.',
    icon: 'Eye',
  },
  {
    key: 'shabda',
    sanskrit: 'Śabda',
    english: 'Reading comprehension / interpretation',
    description: 'Understanding and interpreting reliable textual information.',
    icon: 'BookOpen',
  },
  {
    key: 'anupalabdhi',
    sanskrit: 'Anupalabdhi',
    english: 'Absence / contradiction / elimination reasoning',
    description: 'Reasoning from absence, contradiction, and elimination.',
    icon: 'Ban',
  },
];

export function getDimension(key) {
  return DIMENSIONS.find((d) => d.key === key) || DIMENSIONS[0];
}
