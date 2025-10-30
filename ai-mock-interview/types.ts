export type AppState = 'HOME' | 'INTERVIEW' | 'REPORT' | 'LOADING';

export interface InterviewConfig {
  role: string;
  difficulty: string;
}

export interface EvaluationCriterion {
  name: string;
  score: number;
  maxScore: number;
  reasoning: string;
}

export interface EvaluationResult {
  overallScore: number;
  criteria: EvaluationCriterion[];
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  bodyLanguageFeedback: string;
}

export interface InterviewSession {
  config: InterviewConfig;
  questions: string[];
  answers: string[];
  snapshots: { [questionIndex: number]: string[] };
  malpracticeLogs?: { [questionIndex: number]: string[] };
  evaluation?: EvaluationResult;
}
