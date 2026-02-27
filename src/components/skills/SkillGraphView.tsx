"use client";

import { UserSkill, SkillGap, Job } from "@/lib/types";
import { Network, Target, AlertTriangle, BookOpen } from "lucide-react";

interface Props {
  skills: UserSkill[];
  selectedJob?: Job | null;
}

export default function SkillGraphView({ skills, selectedJob }: Props) {
  const categories = Array.from(new Set(skills.map((s) => s.category)));

  return (
    <div className="space-y-6">
      {/* Skills by category */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
          <Network className="w-4 h-4 text-indigo-400" />
          Your Skills
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <div key={cat} className="space-y-2">
              <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                {cat}
              </h3>
              {skills
                .filter((s) => s.category === cat)
                .map((skill) => (
                  <SkillNode key={skill.name} skill={skill} />
                ))}
            </div>
          ))}
        </div>
      </div>

      {/* Visual graph */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-emerald-400" />
          Skill Map
        </h2>
        <div className="relative bg-slate-900 rounded-lg p-6 min-h-[300px]">
          <SkillBubbleChart skills={skills} gaps={selectedJob?.skillGaps || []} />
        </div>
      </div>

      {/* Gap analysis - if a job is selected */}
      {selectedJob && selectedJob.skillGaps.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Gap Analysis — {selectedJob.title} at {selectedJob.company}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {selectedJob.skillGaps.map((gap) => (
              <GapCard key={gap.skillName} gap={gap} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SkillNode({ skill }: { skill: UserSkill }) {
  const levelBars = Array.from({ length: 5 }, (_, i) => i < skill.proficiencyLevel);

  return (
    <div className="flex items-center justify-between bg-slate-900 rounded-lg px-3 py-2 border border-slate-700">
      <span className="text-xs text-white">{skill.name}</span>
      <div className="flex gap-0.5">
        {levelBars.map((filled, i) => (
          <div
            key={i}
            className={`w-2 h-3 rounded-sm ${
              filled ? "bg-indigo-400" : "bg-slate-700"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function SkillBubbleChart({
  skills,
  gaps,
}: {
  skills: UserSkill[];
  gaps: SkillGap[];
}) {
  // Arrangement in a circular/grid layout
  const allItems = [
    ...skills.map((s) => ({
      name: s.name,
      type: "skill" as const,
      size: s.proficiencyLevel,
      category: s.category,
    })),
    ...gaps.map((g) => ({
      name: g.skillName,
      type: "gap" as const,
      size: 2,
      category: "gap" as const,
    })),
  ];

  const centerX = 50;
  const centerY = 50;
  const radius = 35;

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full max-h-[300px]">
      {allItems.map((item, i) => {
        const angle = (i / allItems.length) * Math.PI * 2 - Math.PI / 2;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        const r = 2 + item.size * 0.8;

        const color =
          item.type === "gap"
            ? "#F59E0B"
            : item.category === "language"
            ? "#818CF8"
            : item.category === "framework"
            ? "#34D399"
            : item.category === "tool"
            ? "#22D3EE"
            : "#A78BFA";

        return (
          <g key={item.name}>
            {/* Line to center */}
            <line
              x1={centerX}
              y1={centerY}
              x2={x}
              y2={y}
              stroke={item.type === "gap" ? "#F59E0B33" : "#475569"}
              strokeWidth="0.2"
              strokeDasharray={item.type === "gap" ? "1,1" : "none"}
            />
            {/* Node */}
            <circle
              cx={x}
              cy={y}
              r={r}
              fill={color}
              opacity={item.type === "gap" ? 0.5 : 0.8}
              className="transition-all hover:opacity-100"
            />
            {/* Label */}
            <text
              x={x}
              y={y + r + 2.5}
              textAnchor="middle"
              className="fill-slate-400"
              fontSize="2"
            >
              {item.name}
            </text>
          </g>
        );
      })}
      {/* Center node */}
      <circle cx={centerX} cy={centerY} r="3" fill="#6366F1" />
      <text
        x={centerX}
        y={centerY + 0.7}
        textAnchor="middle"
        className="fill-white"
        fontSize="1.8"
        fontWeight="bold"
      >
        You
      </text>
    </svg>
  );
}

function GapCard({ gap }: { gap: SkillGap }) {
  return (
    <div
      className={`rounded-lg p-3 border ${
        gap.importance === "required"
          ? "bg-red-500/5 border-red-500/20"
          : "bg-amber-500/5 border-amber-500/20"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-white">{gap.skillName}</span>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded ${
            gap.importance === "required"
              ? "bg-red-500/20 text-red-400"
              : "bg-amber-500/20 text-amber-400"
          }`}
        >
          {gap.importance}
        </span>
      </div>
      {gap.bridgePath.length > 0 && (
        <p className="text-[10px] text-slate-500 mt-1">
          Bridge via: {gap.bridgePath.join(" → ")}
        </p>
      )}
      {gap.learningResources.length > 0 && (
        <div className="flex items-center gap-1 mt-1.5">
          <BookOpen className="w-3 h-3 text-indigo-400" />
          <span className="text-[10px] text-indigo-400">
            {gap.learningResources.length} resources
          </span>
        </div>
      )}
    </div>
  );
}
