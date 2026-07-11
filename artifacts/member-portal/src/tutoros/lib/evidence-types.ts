export interface TutorEvidence {
  todaysGoal: string;
  biggestMisconception: string;
  whatClicked: string;
  independence: number;
  whatChangedToday: string;
}

export interface StudentEvidence {
  confidenceBefore: number;
  confidenceAfter: number;
  stillConfusing: string;
  whatChangedToday: string;
}

export interface TeacherEvidence {
  whatChangedToday: string;
}

export const emptyTutorEvidence = (): TutorEvidence => ({
  todaysGoal: "",
  biggestMisconception: "",
  whatClicked: "",
  independence: 3,
  whatChangedToday: "",
});

export const emptyStudentEvidence = (): StudentEvidence => ({
  confidenceBefore: 2,
  confidenceAfter: 3,
  stillConfusing: "",
  whatChangedToday: "",
});
