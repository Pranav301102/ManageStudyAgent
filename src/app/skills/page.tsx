"use client";

import { useState, useEffect } from "react";
import SkillGraphView from "@/components/skills/SkillGraphView";
import Header from "@/components/layout/Header";
import { UserSkill, Job, SystemHealth } from "@/lib/types";

export default function SkillsPage() {
  const [skills, setSkills] = useState<UserSkill[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [health, setHealth] = useState<SystemHealth>({
    orchestratorRunning: false,
    activeScouts: 0,
    neo4jConnected: false,
    totalJobsFound: 0,
    interviewsReady: 0,
    skillGapsIdentified: 0,
  });

  useEffect(() => {
    async function load() {
      const [skillsRes, jobsRes, healthRes] = await Promise.all([
        fetch("/api/skills"),
        fetch("/api/jobs"),
        fetch("/api/system"),
      ]);
      const skillsData = await skillsRes.json();
      const jobsData = await jobsRes.json();
      const healthData = await healthRes.json();

      if (skillsData.success) setSkills(skillsData.data.skills);
      if (jobsData.success) setJobs(jobsData.data);
      if (healthData.success) setHealth(healthData.data);
    }
    load();
  }, []);

  const selectedJob = selectedJobId
    ? jobs.find((j) => j.id === selectedJobId) || null
    : null;

  return (
    <div>
      <Header health={health} />
      <div className="p-6 space-y-6">
        {/* Job selector */}
        {jobs.length > 0 && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <label className="text-xs text-slate-400 block mb-2">
              Compare your skills against a discovered job:
            </label>
            <select
              value={selectedJobId || ""}
              onChange={(e) => setSelectedJobId(e.target.value || null)}
              className="bg-slate-900 text-white text-sm rounded-lg px-3 py-2 border border-slate-700 w-full max-w-md"
            >
              <option value="">— Select a job —</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} at {j.company} ({j.matchScore}% match)
                </option>
              ))}
            </select>
          </div>
        )}

        <SkillGraphView skills={skills} selectedJob={selectedJob} />
      </div>
    </div>
  );
}
