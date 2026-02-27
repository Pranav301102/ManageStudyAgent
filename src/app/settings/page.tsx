"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import { SystemHealth, UserProfile, UserSkill } from "@/lib/types";
import { Settings, User, Key, Target, Save, Plus, X, CheckCircle, Cpu, Brain } from "lucide-react";

export default function SettingsPage() {
  const [health, setHealth] = useState<SystemHealth>({
    orchestratorRunning: false,
    activeScouts: 0,
    neo4jConnected: false,
    totalJobsFound: 0,
    interviewsReady: 0,
    skillGapsIdentified: 0,
  });
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [saved, setSaved] = useState(false);
  const [newSkillName, setNewSkillName] = useState("");
  const [newTargetRole, setNewTargetRole] = useState("");
  const [newTargetCompany, setNewTargetCompany] = useState("");

  // Env key placeholders (stored client-side only for display; actual keys are in .env.local)
  const [apiKeys, setApiKeys] = useState({
    yutori: "",
    tavily: "",
    openai: "",
    modulate: "",
    neo4jUri: "",
    neo4jUser: "",
    neo4jPassword: "",
  });

  const fetchData = useCallback(async () => {
    const [healthRes, profileRes] = await Promise.all([
      fetch("/api/system"),
      fetch("/api/profile"),
    ]);
    const healthData = await healthRes.json();
    const profileData = await profileRes.json();
    if (healthData.success) setHealth(healthData.data);
    if (profileData.success) setProfile(profileData.data);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const saveProfile = async () => {
    if (!profile) return;

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error("Failed to save profile:", err);
    }
  };

  const addSkill = () => {
    if (!profile || !newSkillName.trim()) return;
    const skill: UserSkill = {
      name: newSkillName.trim(),
      proficiencyLevel: 3,
      category: "tool",
      yearsExperience: 0,
    };
    setProfile({ ...profile, skills: [...profile.skills, skill] });
    setNewSkillName("");
  };

  const removeSkill = (index: number) => {
    if (!profile) return;
    const skills = [...profile.skills];
    skills.splice(index, 1);
    setProfile({ ...profile, skills });
  };

  const updateSkillLevel = (index: number, level: number) => {
    if (!profile) return;
    const skills = [...profile.skills];
    skills[index] = { ...skills[index], proficiencyLevel: level };
    setProfile({ ...profile, skills });
  };

  const addTargetRole = () => {
    if (!profile || !newTargetRole.trim()) return;
    setProfile({
      ...profile,
      targetRoles: [...profile.targetRoles, newTargetRole.trim()],
    });
    setNewTargetRole("");
  };

  const removeTargetRole = (index: number) => {
    if (!profile) return;
    const roles = [...profile.targetRoles];
    roles.splice(index, 1);
    setProfile({ ...profile, targetRoles: roles });
  };

  const addTargetCompany = () => {
    if (!profile || !newTargetCompany.trim()) return;
    setProfile({
      ...profile,
      targetCompanies: [...profile.targetCompanies, newTargetCompany.trim()],
    });
    setNewTargetCompany("");
  };

  const removeTargetCompany = (index: number) => {
    if (!profile) return;
    const cos = [...profile.targetCompanies];
    cos.splice(index, 1);
    setProfile({ ...profile, targetCompanies: cos });
  };

  const categoryColors: Record<string, string> = {
    language: "bg-blue-500/20 text-blue-400",
    framework: "bg-purple-500/20 text-purple-400",
    database: "bg-emerald-500/20 text-emerald-400",
    tool: "bg-amber-500/20 text-amber-400",
    concept: "bg-pink-500/20 text-pink-400",
    other: "bg-slate-500/20 text-slate-400",
  };

  if (!profile) {
    return (
      <div>
        <Header health={health} />
        <div className="p-6 text-slate-500 text-sm">Loading settings...</div>
      </div>
    );
  }

  return (
    <div>
      <Header health={health} />
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-400" />
            Settings
          </h2>
          <button
            onClick={saveProfile}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              saved
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-indigo-600 text-white hover:bg-indigo-500"
            }`}
          >
            {saved ? (
              <>
                <CheckCircle className="w-4 h-4" /> Saved
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save Changes
              </>
            )}
          </button>
        </div>

        {/* Profile */}
        <section className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-indigo-400" /> Profile
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Name</label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) =>
                  setProfile({ ...profile, name: e.target.value })
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Email
              </label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) =>
                  setProfile({ ...profile, email: e.target.value })
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-xs text-slate-400 mb-1">
              Resume Summary
            </label>
            <textarea
              value={profile.resumeSummary}
              onChange={(e) =>
                setProfile({ ...profile, resumeSummary: e.target.value })
              }
              rows={4}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none resize-none"
            />
          </div>
        </section>

        {/* Target Roles & Companies */}
        <section className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-indigo-400" /> Targets
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Roles */}
            <div>
              <label className="block text-xs text-slate-400 mb-2">
                Target Roles
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {profile.targetRoles.map((role, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1 px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded-lg text-xs"
                  >
                    {role}
                    <button onClick={() => removeTargetRole(i)}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTargetRole}
                  onChange={(e) => setNewTargetRole(e.target.value)}
                  placeholder="Add role..."
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  onKeyDown={(e) => e.key === "Enter" && addTargetRole()}
                />
                <button
                  onClick={addTargetRole}
                  className="p-1.5 bg-indigo-600 rounded-lg hover:bg-indigo-500"
                >
                  <Plus className="w-3 h-3 text-white" />
                </button>
              </div>
            </div>

            {/* Companies */}
            <div>
              <label className="block text-xs text-slate-400 mb-2">
                Target Companies
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {profile.targetCompanies.map((co, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded-lg text-xs"
                  >
                    {co}
                    <button onClick={() => removeTargetCompany(i)}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTargetCompany}
                  onChange={(e) => setNewTargetCompany(e.target.value)}
                  placeholder="Add company..."
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  onKeyDown={(e) => e.key === "Enter" && addTargetCompany()}
                />
                <button
                  onClick={addTargetCompany}
                  className="p-1.5 bg-emerald-600 rounded-lg hover:bg-emerald-500"
                >
                  <Plus className="w-3 h-3 text-white" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Skills */}
        <section className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Skills</h3>
          <div className="space-y-2 mb-4 max-h-64 overflow-y-auto pr-2">
            {profile.skills.map((skill, i) => (
              <div
                key={i}
                className="flex items-center gap-3 bg-slate-900 rounded-lg px-3 py-2"
              >
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                    categoryColors[skill.category] || categoryColors.other
                  }`}
                >
                  {skill.category}
                </span>
                <span className="text-xs text-white flex-1">{skill.name}</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={skill.proficiencyLevel * 20}
                  onChange={(e) =>
                    updateSkillLevel(i, Math.round(parseInt(e.target.value) / 20))
                  }
                  className="w-24 accent-indigo-500"
                />
                <span className="text-xs text-slate-400 w-8 text-right">
                  {skill.proficiencyLevel}
                </span>
                <button
                  onClick={() => removeSkill(i)}
                  className="text-slate-600 hover:text-red-400 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newSkillName}
              onChange={(e) => setNewSkillName(e.target.value)}
              placeholder="Add skill..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
              onKeyDown={(e) => e.key === "Enter" && addSkill()}
            />
            <button
              onClick={addSkill}
              className="px-3 py-1.5 bg-indigo-600 rounded-lg text-xs text-white hover:bg-indigo-500"
            >
              Add
            </button>
          </div>
        </section>

        {/* API Keys (info/reminder section) */}
        <section className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <Key className="w-4 h-4 text-indigo-400" /> API Configuration
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            API keys are configured via <code className="text-slate-300">.env.local</code> and are not
            editable from the browser for security. Restart the dev server after
            changes.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { label: "Yutori API Key", env: "YUTORI_API_KEY", connected: true },
              { label: "Tavily API Key", env: "TAVILY_API_KEY", connected: true },
              { label: "OpenAI API Key", env: "OPENAI_API_KEY", connected: true },
              { label: "Pioneer API Key", env: "PIONEER_API_KEY", connected: health.pioneerConnected ?? false },
              { label: "Modulate API Key", env: "MODULATE_API_KEY", connected: false },
              { label: "Neo4j URI", env: "NEO4J_URI", connected: health.neo4jConnected },
            ].map((item) => (
              <div
                key={item.env}
                className="flex items-center justify-between bg-slate-900 rounded-lg px-3 py-2.5"
              >
                <div>
                  <p className="text-xs text-white">{item.label}</p>
                  <p className="text-[10px] text-slate-600">{item.env}</p>
                </div>
                <span
                  className={`w-2 h-2 rounded-full ${
                    item.connected ? "bg-emerald-400" : "bg-slate-600"
                  }`}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Pioneer Cloud Status */}
        <section className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <Cpu className="w-4 h-4 text-indigo-400" /> Pioneer Cloud Status
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-slate-900 rounded-lg px-4 py-3">
              <p className="text-[10px] text-slate-500 mb-1">Backend</p>
              <p className="text-sm font-medium text-white">
                {health.glinerBackend === "pioneer"
                  ? "Pioneer Cloud (Primary)"
                  : health.glinerBackend === "local"
                  ? "Local GLiNER (Fallback)"
                  : "Regex (Offline)"}
              </p>
            </div>
            <div className="bg-slate-900 rounded-lg px-4 py-3">
              <p className="text-[10px] text-slate-500 mb-1">Model</p>
              <p className="text-sm font-medium text-white">
                {health.pioneerModel || "—"}
              </p>
            </div>
            <div className="bg-slate-900 rounded-lg px-4 py-3">
              <p className="text-[10px] text-slate-500 mb-1">Status</p>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    health.pioneerConnected ? "bg-emerald-400" : "bg-red-400"
                  }`}
                />
                <p className="text-sm font-medium text-white">
                  {health.pioneerConnected ? "Connected" : "Disconnected"}
                </p>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-3">
            Pioneer GLiNER-2 is the primary entity extraction engine. When unavailable, the system
            falls back to the local GLiNER microservice, then to regex-based extraction.
          </p>
        </section>
      </div>
    </div>
  );
}
