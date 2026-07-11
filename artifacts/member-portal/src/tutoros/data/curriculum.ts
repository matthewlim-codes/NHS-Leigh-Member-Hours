export type SubjectId =
  | "math"
  | "science"
  | "english"
  | "history"
  | "computing"
  | "test-prep"
  | "languages";

export interface Lesson {
  id: string;
  title: string;
  masteryPoints: number;
}

export interface Unit {
  id: string;
  title: string;
  masteryPoints: number;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  subjectId: SubjectId;
  title: string;
  subtitle?: string;
  description: string;
  aboutLinks: { label: string; href: string }[];
  units: Unit[];
}

export interface Subject {
  id: SubjectId;
  name: string;
  description: string;
  icon: "math" | "science" | "english" | "history" | "computing" | "test-prep" | "languages";
  color: string;
  courses: Course[];
}

const algebraFoundations: Unit = {
  id: "foundations-algebra",
  title: "Foundations: Algebra",
  masteryPoints: 800,
  lessons: [
    { id: "linear-equations", title: "Solving linear equations and inequalities", masteryPoints: 100 },
    { id: "linear-word-problems", title: "Linear equation word problems", masteryPoints: 100 },
    { id: "linear-graphs", title: "Linear graphs and equations", masteryPoints: 100 },
    { id: "systems-foundations", title: "Solving systems of linear equations: foundations", masteryPoints: 100 },
    { id: "systems-word-problems", title: "Systems of linear equations word problems", masteryPoints: 100 },
    { id: "linear-inequality-word", title: "Linear inequality word problems", masteryPoints: 100 },
    { id: "graphing-inequalities", title: "Graphing linear inequalities", masteryPoints: 100 },
    { id: "algebra-fluency", title: "Algebra fluency and review", masteryPoints: 100 },
  ],
};

const problemSolvingFoundations: Unit = {
  id: "foundations-problem-solving",
  title: "Foundations: Problem solving and data",
  masteryPoints: 600,
  lessons: [
    { id: "ratios-proportions", title: "Ratios, rates, and proportions", masteryPoints: 100 },
    { id: "percents", title: "Percents", masteryPoints: 100 },
    { id: "unit-conversion", title: "Unit conversion", masteryPoints: 100 },
    { id: "tables-graphs", title: "Tables, graphs, and scatterplots", masteryPoints: 100 },
    { id: "probability", title: "Probability and relative frequency", masteryPoints: 100 },
    { id: "data-inferences", title: "Data inferences", masteryPoints: 100 },
  ],
};

export const subjects: Subject[] = [
  {
    id: "math",
    name: "Math",
    description: "Algebra through calculus — ready for homework-center sessions.",
    icon: "math",
    color: "#F97316",
    courses: [
      {
        id: "math-6",
        subjectId: "math",
        title: "Class 6 (Foundation)",
        description: "Number sense, fractions, ratios, and early algebra readiness.",
        aboutLinks: [
          { label: "How to use this track", href: "#" },
          { label: "Tutoring tips for Class 6", href: "#" },
        ],
        units: [algebraFoundations],
      },
      {
        id: "math-7",
        subjectId: "math",
        title: "Class 7 (Foundation)",
        description: "Proportional reasoning, expressions, and introductory geometry.",
        aboutLinks: [
          { label: "How to use this track", href: "#" },
          { label: "Tutoring tips for Class 7", href: "#" },
        ],
        units: [algebraFoundations, problemSolvingFoundations],
      },
      {
        id: "math-8",
        subjectId: "math",
        title: "Class 8 (Foundation)",
        description: "Linear relationships, systems, and functions.",
        aboutLinks: [
          { label: "How to use this track", href: "#" },
          { label: "Tutoring tips for Class 8", href: "#" },
        ],
        units: [algebraFoundations, problemSolvingFoundations],
      },
      {
        id: "algebra-1",
        subjectId: "math",
        title: "Algebra 1",
        description: "Equations, inequalities, functions, and quadratic foundations.",
        aboutLinks: [
          { label: "About Algebra 1 tutoring", href: "#" },
          { label: "Common stuck points", href: "#" },
        ],
        units: [algebraFoundations, problemSolvingFoundations],
      },
      {
        id: "geometry",
        subjectId: "math",
        title: "Geometry",
        description: "Congruence, similarity, circles, and proofs.",
        aboutLinks: [
          { label: "About Geometry tutoring", href: "#" },
        ],
        units: [
          {
            id: "geo-foundations",
            title: "Foundations: Geometry",
            masteryPoints: 700,
            lessons: [
              { id: "angles", title: "Angles and lines", masteryPoints: 100 },
              { id: "triangles", title: "Triangles and congruence", masteryPoints: 100 },
              { id: "similarity", title: "Similarity and proportions", masteryPoints: 100 },
              { id: "right-triangles", title: "Right triangles and trigonometry", masteryPoints: 100 },
              { id: "circles", title: "Circles", masteryPoints: 100 },
              { id: "area-volume", title: "Area and volume", masteryPoints: 100 },
              { id: "proofs", title: "Intro to geometric proofs", masteryPoints: 100 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "science",
    name: "Science",
    description: "Biology, chemistry, and physics support material.",
    icon: "science",
    color: "#22C55E",
    courses: [
      {
        id: "biology",
        subjectId: "science",
        title: "Biology",
        description: "Cells, genetics, ecology, and human systems.",
        aboutLinks: [{ label: "Biology tutoring guide", href: "#" }],
        units: [
          {
            id: "bio-cells",
            title: "Foundations: Cells",
            masteryPoints: 500,
            lessons: [
              { id: "cell-structure", title: "Cell structure and organelles", masteryPoints: 100 },
              { id: "membrane", title: "Membrane transport", masteryPoints: 100 },
              { id: "photosynthesis", title: "Photosynthesis", masteryPoints: 100 },
              { id: "respiration", title: "Cellular respiration", masteryPoints: 100 },
              { id: "cell-cycle", title: "Cell cycle and mitosis", masteryPoints: 100 },
            ],
          },
        ],
      },
      {
        id: "chemistry",
        subjectId: "science",
        title: "Chemistry",
        description: "Atomic structure, bonding, stoichiometry, and reactions.",
        aboutLinks: [{ label: "Chemistry tutoring guide", href: "#" }],
        units: [
          {
            id: "chem-foundations",
            title: "Foundations: Chemistry",
            masteryPoints: 600,
            lessons: [
              { id: "atoms", title: "Atoms and the periodic table", masteryPoints: 100 },
              { id: "bonding", title: "Chemical bonding", masteryPoints: 100 },
              { id: "moles", title: "Moles and stoichiometry", masteryPoints: 100 },
              { id: "reactions", title: "Types of reactions", masteryPoints: 100 },
              { id: "gas-laws", title: "Gas laws", masteryPoints: 100 },
              { id: "acids-bases", title: "Acids and bases", masteryPoints: 100 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "english",
    name: "English",
    description: "Reading, writing, and essay coaching resources.",
    icon: "english",
    color: "#A855F7",
    courses: [
      {
        id: "essay-writing",
        subjectId: "english",
        title: "Essay Writing",
        description: "Thesis statements, paragraphs, evidence, and revisions.",
        aboutLinks: [{ label: "Essay coaching tips", href: "#" }],
        units: [
          {
            id: "essay-foundations",
            title: "Foundations: Essays",
            masteryPoints: 400,
            lessons: [
              { id: "thesis", title: "Crafting a thesis", masteryPoints: 100 },
              { id: "structure", title: "Paragraph structure", masteryPoints: 100 },
              { id: "evidence", title: "Using evidence", masteryPoints: 100 },
              { id: "revision", title: "Revision strategies", masteryPoints: 100 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "history",
    name: "History & Social Studies",
    description: "World history, US history, and civics review tracks.",
    icon: "history",
    color: "#0D9488",
    courses: [
      {
        id: "us-history",
        subjectId: "history",
        title: "US History",
        description: "Founding era through modern America — key concepts for tutoring.",
        aboutLinks: [{ label: "US History tutoring guide", href: "#" }],
        units: [
          {
            id: "ush-foundations",
            title: "Foundations: US History",
            masteryPoints: 500,
            lessons: [
              { id: "revolution", title: "American Revolution", masteryPoints: 100 },
              { id: "constitution", title: "Constitution and Bill of Rights", masteryPoints: 100 },
              { id: "civil-war", title: "Civil War and Reconstruction", masteryPoints: 100 },
              { id: "industrial", title: "Industrialization and reform", masteryPoints: 100 },
              { id: "civil-rights", title: "Civil Rights Movement", masteryPoints: 100 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "computing",
    name: "Computing",
    description: "Intro CS, algorithms, and coding help.",
    icon: "computing",
    color: "#EF4444",
    courses: [
      {
        id: "intro-cs",
        subjectId: "computing",
        title: "Intro to Computer Science",
        description: "Variables, loops, functions, and debugging patterns.",
        aboutLinks: [{ label: "CS tutoring guide", href: "#" }],
        units: [
          {
            id: "cs-foundations",
            title: "Foundations: Programming",
            masteryPoints: 500,
            lessons: [
              { id: "variables", title: "Variables and types", masteryPoints: 100 },
              { id: "conditionals", title: "Conditionals", masteryPoints: 100 },
              { id: "loops", title: "Loops", masteryPoints: 100 },
              { id: "functions", title: "Functions", masteryPoints: 100 },
              { id: "debugging", title: "Debugging strategies", masteryPoints: 100 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "test-prep",
    name: "Test prep",
    description: "SAT, ACT, and other exam prep tracks for tutors.",
    icon: "test-prep",
    color: "#EAB308",
    courses: [
      {
        id: "digital-sat-math",
        subjectId: "test-prep",
        title: "Digital SAT Math",
        subtitle: "Test prep",
        description: "Foundations and practice for the digital SAT math section.",
        aboutLinks: [
          { label: "About the digital SAT", href: "#" },
          { label: "What is the new digital SAT?", href: "#" },
        ],
        units: [algebraFoundations, problemSolvingFoundations],
      },
      {
        id: "digital-sat-rw",
        subjectId: "test-prep",
        title: "Digital SAT Reading & Writing",
        subtitle: "Test prep",
        description: "Craft, information, and expression skills for the digital SAT.",
        aboutLinks: [{ label: "About SAT Reading & Writing", href: "#" }],
        units: [
          {
            id: "rw-foundations",
            title: "Foundations: Reading & Writing",
            masteryPoints: 500,
            lessons: [
              { id: "central-ideas", title: "Central ideas and details", masteryPoints: 100 },
              { id: "command-evidence", title: "Command of evidence", masteryPoints: 100 },
              { id: "words-context", title: "Words in context", masteryPoints: 100 },
              { id: "rhetoric", title: "Rhetorical synthesis", masteryPoints: 100 },
              { id: "standard-english", title: "Standard English conventions", masteryPoints: 100 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "languages",
    name: "World Languages",
    description: "Spanish and other language support tracks.",
    icon: "languages",
    color: "#3B82F6",
    courses: [
      {
        id: "spanish-1",
        subjectId: "languages",
        title: "Spanish 1",
        description: "Vocabulary, present tense, and conversation basics.",
        aboutLinks: [{ label: "Spanish tutoring guide", href: "#" }],
        units: [
          {
            id: "span-foundations",
            title: "Foundations: Spanish 1",
            masteryPoints: 400,
            lessons: [
              { id: "greetings", title: "Greetings and introductions", masteryPoints: 100 },
              { id: "present-tense", title: "Present tense verbs", masteryPoints: 100 },
              { id: "nouns-articles", title: "Nouns and articles", masteryPoints: 100 },
              { id: "everyday-vocab", title: "Everyday vocabulary", masteryPoints: 100 },
            ],
          },
        ],
      },
    ],
  },
];

export function getSubject(id: string): Subject | undefined {
  return subjects.find((subject) => subject.id === id);
}

export function getCourse(courseId: string): Course | undefined {
  for (const subject of subjects) {
    const course = subject.courses.find((item) => item.id === courseId);
    if (course) return course;
  }
  return undefined;
}

export function getCourseSubject(courseId: string): Subject | undefined {
  return subjects.find((subject) => subject.courses.some((course) => course.id === courseId));
}

export function getUnit(courseId: string, unitId: string): Unit | undefined {
  return getCourse(courseId)?.units.find((unit) => unit.id === unitId);
}

export function getCourseMasteryTotal(course: Course): number {
  return course.units.reduce((sum, unit) => sum + unit.masteryPoints, 0);
}

export function getUpNextUnit(course: Course): Unit | undefined {
  return course.units[0];
}
