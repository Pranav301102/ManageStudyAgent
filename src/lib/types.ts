// ─── Core Domain Types ───────────────────────────────────────────────

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  resumeSummary: string;
  targetRoles: string[];
  targetCompanies: string[];
  skills: UserSkill[];
}

export interface UserSkill {
  name: string;
  category: SkillCategory;
  proficiencyLevel: number; // 1-5
  yearsExperience: number;
}

export type SkillCategory =
  | "language"
  | "framework"
  | "tool"
  | "concept"
  | "soft-skill";

// ─── Job Types ───────────────────────────────────────────────────────

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  requiredSkills: RequiredSkill[];
  preferredSkills: RequiredSkill[];
  techStack: string[];
  salaryRange?: string;
  postedDate: string;
  discoveredAt: string;
  matchScore: number;
  skillGaps: SkillGap[];
  companyIntel?: CompanyIntel;
  interviewReady: boolean;
  status: JobStatus;
  scoutId?: string;
}

export type JobStatus =
  | "discovered"
  | "researching"
  | "analyzed"
  | "interview-ready"
  | "applied"
  | "interviewing"
  | "archived";

export interface RequiredSkill {
  name: string;
  importance: "required" | "preferred";
}

export interface SkillGap {
  skillName: string;
  importance: "required" | "preferred";
  learningResources: string[];
  bridgePath: string[]; // skills you have that connect here
}

// ─── Company Intel (from Tavily) ─────────────────────────────────────

export interface CompanyIntel {
  name: string;
  recentNews: NewsItem[];
  techStack: string[];
  culture: string;
  products: string[];
  fundingStage?: string;
  employeeCount?: string;
  summary: string;
}

export interface NewsItem {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
}

// ─── Scout Types (Yutori) ────────────────────────────────────────────

export interface Scout {
  id: string;
  yutoriScoutId?: string;
  query: string;
  targetCompanies: string[];
  interval: number; // seconds
  status: ScoutStatus;
  lastRun?: string;
  jobsFound: number;
  createdAt: string;
}

export type ScoutStatus = "active" | "paused" | "error" | "creating";

// ─── Interview Types ─────────────────────────────────────────────────

export interface InterviewSession {
  id: string;
  jobId: string;
  job: Job;
  questions: InterviewQuestion[];
  currentQuestionIndex: number;
  status: InterviewStatus;
  startedAt: string;
  completedAt?: string;
  overallScore?: number;
  overallFeedback?: string;
}

export type InterviewStatus = "preparing" | "active" | "completed" | "cancelled";

export interface InterviewQuestion {
  id: string;
  text: string;
  type: QuestionType;
  category: string;
  response?: string;
  contentScore?: number;
  deliveryScore?: number;
  feedback?: string;
  voiceAnalysis?: VoiceAnalysis;
}

export type QuestionType = "behavioral" | "technical" | "situational" | "company-specific" | "coding" | "system-design";

export interface VoiceAnalysis {
  confidence: number; // 0-100
  clarity: number; // 0-100
  pace: number; // 0-100
  sentiment: string;
  emotion: string;
  fillerWordCount: number;
  duration: number; // seconds
}

// ─── Skill Graph Types (for visualization) ───────────────────────────

export interface GraphNode {
  id: string;
  name: string;
  type: "user-skill" | "required-skill" | "gap" | "concept";
  category?: SkillCategory;
  proficiency?: number;
  importance?: string;
}

export interface GraphLink {
  source: string;
  target: string;
  type: "has" | "requires" | "gap" | "bridges" | "teaches";
}

export interface SkillGraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// ─── System Status ───────────────────────────────────────────────────

export interface SystemHealth {
  orchestratorRunning: boolean;
  activeScouts: number;
  neo4jConnected: boolean;
  lastScanTime?: string;
  totalJobsFound: number;
  interviewsReady: number;
  skillGapsIdentified: number;
  // Pioneer cloud status (injected by /api/system)
  pioneerConnected?: boolean;
  pioneerModel?: string;
  glinerBackend?: "pioneer" | "local" | "fallback";
}

// ─── API Response Wrappers ───────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── Yutori API Types ────────────────────────────────────────────────

export interface YutoriScoutCreate {
  query: string;
  output_interval: number;
  webhook_url?: string;
  webhook_format?: "scout" | "slack" | "zapier";
  output_schema?: Record<string, unknown>;
  skip_email?: boolean;
}

export interface YutoriScoutResponse {
  id: string;
  query: string;
  display_name: string;
  next_run_timestamp: string | null;
  user_timezone: string;
  created_at: string;
  view_url: string | null;
  webhook_url: string | null;
}

export interface YutoriBrowsingCreate {
  task: string;
  start_url: string;
  max_steps?: number;
  agent?: string;
  output_schema?: Record<string, unknown>;
}

export interface YutoriBrowsingResponse {
  task_id: string;
  view_url: string;
  status: "queued" | "running" | "succeeded" | "failed";
  result: string | null;
  structured_result?: Record<string, unknown>;
}

// ─── Tavily API Types ────────────────────────────────────────────────

export interface TavilySearchRequest {
  query: string;
  search_depth?: "basic" | "advanced" | "fast";
  topic?: "general" | "news" | "finance";
  max_results?: number;
  include_answer?: boolean;
  include_raw_content?: boolean;
  time_range?: "day" | "week" | "month" | "year";
}

export interface TavilySearchResponse {
  query: string;
  answer?: string;
  results: TavilyResult[];
  response_time: number;
}

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
  raw_content?: string;
  published_date?: string;
}

// ─── Tavily Extract API Types ────────────────────────────────────────

export interface TavilyExtractResponse {
  results: TavilyExtractResult[];
}

export interface TavilyExtractResult {
  url: string;
  raw_content: string;
}

// ─── Live Session Types (Code Editor + Whiteboard) ───────────────────

export type InterviewTab = "voice" | "code" | "whiteboard";

export interface CodeEditorState {
  code: string;
  language: string;
  lastEditTimestamp: number;
}

export interface WhiteboardSnapshot {
  imageBase64: string;
  timestamp: number;
}

export interface AIInsights {
  extractedSkills: ExtractedEntity[];
  codeAnalysis?: string;
  whiteboardAnalysis?: string;
  hint?: string;
  lastUpdated: number;
}

export interface ExtractedEntity {
  text: string;
  label: string;       // e.g. "technology", "algorithm", "data-structure"
  score: number;       // confidence 0-1
}

export interface RekaVisionAnalysis {
  description: string;
  detectedPatterns: string[];
  suggestions: string[];
  timestamp: number;
}

export interface FastinoMemory {
  userId: string;
  sessionHistory: string[];
  knownWeaknesses: string[];
  lastInteractionSummary?: string;
}

// ─── Application Tracker Types ───────────────────────────────────────

export interface Application {
  id: string;
  jobId: string;
  job: Job;
  status: ApplicationStatus;
  appliedAt: string;
  timeline: ApplicationEvent[];
  nextAction?: string;
  nextActionDate?: string;
  notes: string;
  interviewDate?: string;
}

export type ApplicationStatus =
  | "saved"
  | "applied"
  | "screening"
  | "phone-screen"
  | "technical"
  | "onsite"
  | "offer"
  | "rejected"
  | "withdrawn";

export interface ApplicationEvent {
  status: ApplicationStatus;
  date: string;
  notes?: string;
}

// ─── Study Scheduler Types ───────────────────────────────────────────

export interface StudySchedule {
  id: string;
  availability: AvailabilitySlot[];
  studyPlan: StudyBlock[];
  generatedAt: string;
}

export interface AvailabilitySlot {
  dayOfWeek: number; // 0=Sun, 6=Sat
  startHour: number; // 0-23
  endHour: number;   // 0-23
}

export interface StudyBlock {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  topic: string;
  type: "skill-gap" | "mock-interview" | "coding-practice" | "system-design" | "behavioral";
  priority: "critical" | "high" | "medium";
  linkedJobId?: string;
  completed: boolean;
}

// ─── Post-Interview Performance Types ────────────────────────────────

export interface PerformanceSnapshot {
  interviewId: string;
  date: string;
  strengths: string[];
  weaknesses: string[];
  recommendedFocus: string[];
  skillDeltas: SkillDelta[];
  overallTrend: "improving" | "stable" | "declining";
}

export interface SkillDelta {
  skillName: string;
  previousLevel: number;
  newLevel: number;
  reason: string;
}

// ─── Daily Challenge Types ───────────────────────────────────────────

export interface DailyChallenge {
  id: string;
  date: string;
  type: "coding" | "behavioral" | "system-design";
  question: string;
  difficulty: "easy" | "medium" | "hard";
  targetSkill: string;
  completed: boolean;
  streak: number;
}

// ─── Resume Alignment Types (Pioneer + Gemini) ──────────────────────

export interface ResumeAlignment {
  id: string;
  jobId: string;
  originalResume: string;
  alignedResume: string;
  jobDescription: string;
  resumeEntities: ExtractedEntity[];
  jdEntities: ExtractedEntity[];
  alignedEntities: ExtractedEntity[];
  missingKeywords: string[];
  addedKeywords: string[];
  atsScore: number;
  humanScore: number;
  overallScore: number;
  suggestions: string[];
  createdAt: string;
  modelVersion?: string;
}

export interface ATSAnalysis {
  atsScore: number;
  humanScore: number;
  overallScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: string[];
  entityOverlap: number;
  categoryBreakdown: Record<string, {
    jdCount: number;
    resumeCount: number;
    overlap: number;
  }>;
}

// ─── Pioneer Fine-Tuning Types ──────────────────────────────────────

export interface PioneerTrainingStatus {
  samplesCollected: number;
  threshold: number;
  readyForFineTune: boolean;
}

export interface PioneerModelMetrics {
  f1: number;
  precision: number;
  recall: number;
  perLabel?: Record<string, { f1: number; precision: number; recall: number }>;
}

