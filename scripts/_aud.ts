const g = globalThis as any;
if (!g.localStorage) { const s=new Map<string,string>(); g.localStorage={getItem:(k:string)=>s.get(k)??null,setItem:(k:string,v:string)=>void s.set(k,v),removeItem:(k:string)=>void s.delete(k),clear:()=>s.clear(),key:(i:number)=>[...s.keys()][i]??null,get length(){return s.size;}}; }
await import("../src/shared/ai/registry");
const { listCapabilities } = await import("../src/shared/capability");
const caps = listCapabilities();
const lines = caps.map(c => [c.id, c.kind, c.audience.join("+"), c.needsApproval({input:{} as any,user:null})?"approval":"-", c.id.split(".")[0]].join(" | "));
const mcp = caps.filter(c=>c.audience.includes("mcp"));
const hdr = [
 "# AI_SURFACE_CAPS — inventário vivo (gerado por scripts/ai-surface-audit.ts)",
 `# gerado em: ${new Date().toISOString()}`,
 `# total: ${caps.length} | audience mcp: ${mcp.length} | app-only: ${caps.length-mcp.length}`,
 "# formato: id | kind | audience | approval | módulo",
 "",
];
await Bun.write("../docs/handoff/AI_SURFACE_CAPS.txt", hdr.concat(lines).join("\n")+"\n");
const byMod = new Map<string,{t:number;m:number}>();
for (const c of caps){const k=c.id.split(".")[0];const e=byMod.get(k)??{t:0,m:0};e.t++;if(c.audience.includes("mcp"))e.m++;byMod.set(k,e);}
console.log("total",caps.length,"mcp",mcp.length,"app-only",caps.length-mcp.length);
console.log([...byMod.entries()].sort().map(([k,v])=>`${k}: ${v.m}/${v.t}`).join("\n"));
