import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, CheckCircle2, FileText, Printer, RefreshCw, Target, TrendingUp, XCircle, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import "./AssessmentReports.css";

const DIMS = [
  ["anumana","Anumāna","Logical / inferential reasoning"],
  ["arthapatti","Arthāpatti","Abductive reasoning / problem solving"],
  ["upamana","Upamāna","Analogical reasoning"],
  ["pratyaksha","Pratyakṣa","Observation / visual reasoning"],
  ["shabda","Śabda","Reading comprehension / interpretation"],
  ["anupalabdhi","Anupalabdhi","Absence / contradiction / elimination reasoning"],
];

const keyOf = v => String(v ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");
const dim = v => DIMS.find(d => keyOf(d[0]) === keyOf(v) || keyOf(d[1]) === keyOf(v));
const num = v => Math.max(0, Math.min(100, Number.isFinite(Number(v)) ? Number(v) : 0));
const unwrap = r => r?.data ?? r ?? {};
const dateText = v => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "Date not available" :
    d.toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"});
};
const level = s => s >= 85 ? "Advanced" : s >= 70 ? "Developing" : s >= 50 ? "Foundational" : "Needs practice";

function Stat({Icon,label,value,detail}) {
  return <div className="ar-stat"><div className="ar-stat-icon"><Icon size={18}/></div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></div>;
}

function Skill({name,score}) {
  const d = dim(name), s = num(score);
  return <div className="ar-skill">
    <div className="ar-skill-top"><div><strong>{d?.[1] || name}</strong><small>{d?.[2] || "Reasoning dimension"}</small></div><b>{Math.round(s)}%</b></div>
    <div className="ar-track"><i style={{width:`${s}%`}}/></div>
    <div className="ar-skill-bottom"><span>{level(s)}</span><span>{s < 50 ? "Priority for practice" : s < 70 ? "Continue developing" : "Progressing well"}</span></div>
  </div>;
}

export default function AssessmentReports() {
  const navigate = useNavigate();
  const [progress,setProgress] = useState(null);
  const [reports,setReports] = useState([]);
  const [selected,setSelected] = useState(0);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const [p,r] = await Promise.all([api.getProgress(),api.getAssessmentReviews()]);
      const pd=unwrap(p), rd=unwrap(r);
      const list=Array.isArray(rd?.assessments) ? rd.assessments : [];
      setProgress(pd); setReports(list); setSelected(x=>list.length ? Math.min(x,list.length-1):0);
    } catch(e) {
      setError(e instanceof ApiError ? e.message : "Unable to load your assessment reports.");
    } finally { setLoading(false); }
  };

  useEffect(()=>{load();},[]);

  const current=reports[selected] || null;
  const scores=useMemo(()=>{
    const s=current?.skill_scores || current?.scores || {};
    return Object.entries(s).sort((a,b)=>num(b[1])-num(a[1]));
  },[current]);

  const stats=useMemo(()=>{
    const qs=Array.isArray(current?.questions) ? current.questions : [];
    const total=Number(current?.total_questions ?? current?.questions_answered ?? qs.length ?? 0);
    const correct=Number(current?.correct_count ?? qs.filter(q=>q.correct).length);
    return {total,correct,incorrect:Math.max(0,total-correct),accuracy:total?Math.round(correct/total*100):0};
  },[current]);

  const pre=progress?.pre_scores || {};
  const post=progress?.post_scores || progress?.latest_post_report?.skill_scores || {};
  const comparison=Object.keys(pre).length && Object.keys(post).length
    ? [...new Set([...Object.keys(pre),...Object.keys(post)])].map(k=>({key:k,b:num(pre[k]),a:num(post[k]),c:num(post[k])-num(pre[k])}))
    : [];

  const training=progress?.training || {};
  const trainingAttempts=Number(progress?.training_sessions ?? 0);

  if(loading) return <main className="assessment-reports-page"><section className="ar-container"><div className="ar-empty"><RefreshCw className="ar-spin" size={28}/><h2>Loading your reports…</h2><p>Cognita AI is retrieving your stored assessment results.</p></div></section></main>;
  if(error) return <main className="assessment-reports-page"><section className="ar-container"><div className="ar-empty"><XCircle size={30}/><h2>Unable to load reports</h2><p>{error}</p><button className="ar-primary" onClick={load}>Try Again <RefreshCw size={16}/></button></div></section></main>;
  if(!reports.length) return <main className="assessment-reports-page"><section className="ar-container"><header className="ar-header"><div><em>LEARNING INSIGHTS</em><h1>Assessment Reports</h1><p>Your assessment results and learning insights will appear here.</p></div></header><div className="ar-empty"><FileText size={30}/><h2>No assessment report yet</h2><p>Complete the Pre-Assessment first. Your results will appear here automatically.</p><button className="ar-primary" onClick={()=>navigate("/assessment")}>Start Pre-Assessment <ArrowRight size={16}/></button></div></section></main>;

  return <main className="assessment-reports-page">
    <section className="ar-container">
      <header className="ar-header">
        <div><em><i/> LEARNING INSIGHTS</em><h1>Assessment Reports</h1><p>Understand your performance across the six reasoning dimensions and track recorded skill development over time.</p></div>
        <div className="ar-actions"><button className="ar-secondary" onClick={load}><RefreshCw size={15}/> Refresh</button><button className="ar-secondary" onClick={()=>window.print()}><Printer size={15}/> Print Report</button></div>
      </header>

      <section className="ar-selector"><div><label>ASSESSMENT HISTORY</label><h2>Choose a report</h2></div><div className="ar-select"><FileText size={16}/><select value={selected} onChange={e=>setSelected(Number(e.target.value))}>{reports.map((r,i)=><option key={i} value={i}>{r.label || (r.type==="pre"?"Pre-Assessment":`Post-Assessment ${r.attempt||i}`)}</option>)}</select></div></section>

      {current && <>
        <section className="ar-hero"><div><label>SELECTED REPORT</label><h2>{current.label || "Assessment Report"}</h2><p><CalendarDays size={14}/> {dateText(current.created_at)}</p></div><div className="ar-orb"><strong>{Math.round(num(current.overall_score))}</strong><small>/ 100</small><span>Overall Score</span></div></section>

        <section className="ar-stats">
          <Stat Icon={Target} label="Skill level" value={current.skill_level || level(num(current.overall_score))} detail="Transparent scoring"/>
          <Stat Icon={CheckCircle2} label="Correct" value={stats.correct} detail={`${stats.accuracy}% accuracy`}/>
          <Stat Icon={XCircle} label="Needs review" value={stats.incorrect} detail={`${stats.total} questions recorded`}/>
          <Stat Icon={TrendingUp} label="Training activity" value={trainingAttempts} detail="Questions attempted"/>
        </section>

        <section className="ar-two">
          <div className="ar-panel"><div className="ar-panel-head"><div><label>COGNITIVE PROFILE</label><h2>Reasoning-skill performance</h2></div><BarChart3 size={18}/></div><div className="ar-skills">{scores.length?scores.map(([k,v])=><Skill key={k} name={k} score={v}/>):<p className="ar-muted">Skill scores are not available for this report.</p>}</div></div>
          <div className="ar-panel"><div className="ar-panel-head"><div><label>INTERPRETATION</label><h2>Report summary</h2></div><TrendingUp size={18}/></div><div className="ar-highlights"><div><span>Strongest recorded skill</span><b>{dim(current.strongest_skill)?.[1] || current.strongest_skill || "Not available"}</b></div><div><span>Priority skill</span><b>{dim(current.weakest_skill)?.[1] || current.weakest_skill || "Not available"}</b></div><div><span>How to use this report</span><p>Use lower-scoring dimensions to guide training focus, then return for a later assessment to compare recorded performance.</p></div></div></div>
        </section>

        {comparison.length>0 && <section className="ar-panel ar-comparison"><div className="ar-panel-head"><div><label>PRE → POST</label><h2>Recorded skill changes</h2></div><TrendingUp size={18}/></div><div className="ar-compare-list">{comparison.map(x=><div className="ar-compare" key={x.key}><div><b>{dim(x.key)?.[1] || x.key}</b><small>{Math.round(x.b)} → {Math.round(x.a)}</small></div><div className="ar-compare-track"><i style={{width:`${x.b}%`}}/><strong style={{width:`${x.a}%`}}/></div><b className={x.c>=0?"up":"down"}>{x.c>=0?"+":""}{Math.round(x.c)}</b></div>)}</div></section>}

        <section className="ar-two">
          <div className="ar-panel"><div className="ar-panel-head"><div><label>TRAINING</label><h2>Learning activity</h2></div><Target size={18}/></div><div className="ar-training">{Object.entries(training).length ? Object.entries(training).map(([k,v])=><div key={k}><div><b>{dim(k)?.[1] || k}</b><small>{Number(v?.questions_attempted??0)} attempted · {Number(v?.correct_answers??0)} correct</small></div><strong>{Math.round(num(v?.score))}%</strong></div>) : <p className="ar-muted">No training activity has been recorded yet.</p>}</div></div>
          <div className="ar-panel"><div className="ar-panel-head"><div><label>NEXT STEP</label><h2>Continue learning</h2></div></div><p className="ar-next">Continue targeted practice, use the AI Tutor for concept doubts, and return to Assessment Review to learn from individual mistakes.</p><div className="ar-action-stack"><button className="ar-primary" onClick={()=>navigate("/training")}>Continue Training <ArrowRight size={16}/></button><button className="ar-secondary ar-full" onClick={()=>navigate("/assessment-review")}>Review Answers <FileText size={16}/></button></div></div>
        </section>
        <footer className="ar-footer">Transparent scoring • Actual stored assessment data • No ML prediction</footer>
      </>}
    </section>
  </main>;
}
