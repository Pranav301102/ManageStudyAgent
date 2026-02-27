"use client";

import { Job } from "@/lib/types";
import {
  MapPin,
  Clock,
  Target,
  AlertTriangle,
  Mic,
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  jobs: Job[];
}

export default function JobFeed({ jobs }: Props) {
  const router = useRouter();

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <Target className="w-4 h-4 text-emerald-400" />
        Discovered Jobs
      </h2>

      {jobs.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-slate-500 text-sm">
            No jobs discovered yet. Start the orchestrator or run a demo.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onInterview={() => router.push(`/interviews?jobId=${job.id}`)}
              onAlignResume={() => router.push(`/resume?jobId=${job.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function JobCard({
  job,
  onInterview,
  onAlignResume,
}: {
  job: Job;
  onInterview: () => void;
  onAlignResume: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const isNew =
    Date.now() - new Date(job.discoveredAt).getTime() < 60 * 60 * 1000;

  const timeAgo = getTimeAgo(new Date(job.discoveredAt));

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">
                {job.title}
              </h3>
              {isNew && (
                <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded font-medium">
                  NEW
                </span>
              )}
              {job.interviewReady && (
                <span className="text-[10px] px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 rounded font-medium">
                  INTERVIEW READY
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {job.company}
            </p>
          </div>
          <span className="text-xs text-slate-500">{timeAgo}</span>
        </div>

        <div className="flex items-center gap-4 mt-3">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {job.location}
          </span>
          <span
            className={`text-xs font-medium ${
              job.matchScore >= 80
                ? "text-emerald-400"
                : job.matchScore >= 50
                ? "text-amber-400"
                : "text-red-400"
            }`}
          >
            Match: {job.matchScore}%
          </span>
          {job.skillGaps.length > 0 && (
            <span className="text-xs text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {job.skillGaps.length} gaps
            </span>
          )}
        </div>

        {/* Tech stack tags */}
        {job.techStack.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {job.techStack.slice(0, 6).map((tech) => (
              <span
                key={tech}
                className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700"
              >
                {tech}
              </span>
            ))}
            {job.techStack.length > 6 && (
              <span className="text-[10px] text-slate-500">
                +{job.techStack.length - 6} more
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center gap-1 transition-colors"
          >
            <FileText className="w-3 h-3" />
            Details
            {expanded ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
          {job.interviewReady && (
            <button
              onClick={onInterview}
              className="text-xs px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg flex items-center gap-1 transition-colors"
            >
              <Mic className="w-3 h-3" />
              Mock Interview
            </button>
          )}
          <button
            onClick={onAlignResume}
            className="text-xs px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg flex items-center gap-1 transition-colors border border-purple-500/20"
          >
            <Sparkles className="w-3 h-3" />
            Align Resume
          </button>
          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center gap-1 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Apply
            </a>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-slate-700 p-4 space-y-3">
          {job.description && (
            <div>
              <p className="text-xs font-medium text-slate-300 mb-1">
                Description
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                {job.description.slice(0, 500)}
                {job.description.length > 500 && "..."}
              </p>
            </div>
          )}

          {job.skillGaps.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-300 mb-1">
                Skill Gaps
              </p>
              <div className="flex flex-wrap gap-1.5">
                {job.skillGaps.map((gap) => (
                  <span
                    key={gap.skillName}
                    className={`text-[10px] px-2 py-0.5 rounded ${
                      gap.importance === "required"
                        ? "bg-red-500/20 text-red-400"
                        : "bg-amber-500/20 text-amber-400"
                    }`}
                  >
                    {gap.skillName}
                  </span>
                ))}
              </div>
            </div>
          )}

          {job.companyIntel && (
            <div>
              <p className="text-xs font-medium text-slate-300 mb-1">
                Company Intel
              </p>
              <p className="text-xs text-slate-400">
                {job.companyIntel.summary.slice(0, 200)}
              </p>
              {job.companyIntel.recentNews.length > 0 && (
                <div className="mt-2 space-y-1">
                  {job.companyIntel.recentNews.slice(0, 2).map((news, i) => (
                    <a
                      key={i}
                      href={news.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 block truncate"
                    >
                      → {news.title}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
