import express from 'express';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { env } from './config/env.js';
import { assertDeveloper, safePath } from './security/policy.js';
import * as fs from './tools/filesystem.js';
import * as gh from './tools/github.js';
import * as ep from './tools/eternodes.js';
import { deployFromMain, verifyGithubSignature } from './tools/deployment.js';
import { audit } from './audit.js';

const execFileAsync = promisify(execFile) as any;

function redactOutput(value: unknown): string {
  return String(value ?? '')
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s\"']+/ig, '$1[MASQUÉ]')
    .replace(/((?:MAMMOUTH_API_KEY|OPENROUTER_API_KEY|DISCORD_TOKEN|DISCORD_BOT_TOKEN|BOT_TOKEN|DISCORD_CLIENT_SECRET|PTERO_API_TOKEN|MCP_API_KEY|GITHUB_TOKEN|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|JWT_SECRET|SMTP_PASSWORD|MYSQL_PASSWORD|MONGODB_URI|MONGO_URI|DATABASE_URL|MYSQL_URL)\s*[:=]\s*)[^\s,;\"']+/ig, '$1[MASQUÉ]')
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, '[JETON GITHUB MASQUÉ]')
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}\b/g, '[JWT MASQUÉ]')
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[CLÉ API MASQUÉE]');
}

function credentials(req: express.Request): string | undefined {
  const direct = req.header('x-omnix-api-key');
  if (direct) return direct;
  const auth = req.header('authorization');
  return auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
}

async function callTool(name: string, args: Record<string, any> = {}) {
  switch (name) {
    case 'list_files': return fs.listFiles(String(args.path ?? '.'), Number(args.depth ?? 2));
    case 'read_file': return fs.readFile(String(args.path));
    case 'write_file': { const result = await fs.writeFile(String(args.path), String(args.content ?? '')); audit('files.write','ok',{path:String(args.path),bytes:result.bytes,backup:result.backup}); return { ok: true, path:String(args.path), ...result }; }
    case 'delete_file': { const target = String(args.path); if (String(args.confirmationPhrase ?? '') !== `SUPPRIMER ${target}`) throw new Error(`Confirmation requise : confirmationPhrase doit être exactement « SUPPRIMER ${target} ».`); const result = await fs.deleteFile(target); audit('files.delete','ok',{path:target,backup:result.backup}); return { ok: true, path:target, ...result }; }
    case 'github_status': return gh.githubStatus();
    case 'github_commits': return gh.listRecentCommits(Number(args.limit ?? 10));
    case 'github_create_branch': return gh.createBranch(String(args.branch), String(args.from ?? env.github.defaultBranch));
    case 'github_create_pr': return gh.createPullRequest(String(args.head), String(args.title), String(args.body ?? ''));
    case 'eternodes_status': return ep.serverStatus();
    case 'eternodes_logs': return ep.consoleLogs(Number(args.lines ?? 150));
    case 'project_logs': return fs.recentProjectLogs(Number(args.lines ?? 150));
    case 'run_project_check': {
      const check = String(args.check ?? '');
      let command: string; let commandArgs: string[];
      if (check === 'build') { command = process.execPath; commandArgs = [path.join(env.root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', safePath('tsconfig.json')]; }
      else if (check === 'test') { command = process.execPath; commandArgs = [safePath('scripts/run-tests.cjs')]; }
      else if (check === 'syntax') {
        const relative = String(args.path ?? '');
        if (!relative || !/\.(?:js|cjs|mjs)$/i.test(relative)) throw new Error('Le contrôle syntaxe exige un fichier .js, .cjs ou .mjs. Utilise le contrôle build pour TypeScript.');
        command = process.execPath; commandArgs = ['--check', safePath(relative)];
      } else throw new Error('Contrôle refusé. Valeurs autorisées : build, test, syntax.');
      const startedAt = new Date().toISOString();
      try {
        const result = await execFileAsync(command, commandArgs, { cwd: env.root, timeout: 120_000, maxBuffer: 2_000_000, windowsHide: true });
        audit('project.check','ok',{check});
        return { ok: true, check, startedAt, finishedAt: new Date().toISOString(), stdout: redactOutput(result.stdout).slice(-60_000), stderr: redactOutput(result.stderr).slice(-30_000) };
      } catch (error: any) {
        audit('project.check','error',{check,exitCode:error?.code ?? null});
        return { ok: false, check, startedAt, finishedAt: new Date().toISOString(), exitCode: error?.code ?? null, stdout: redactOutput(error?.stdout).slice(-60_000), stderr: redactOutput(error?.stderr || error?.message).slice(-30_000) };
      }
    }
    case 'eternodes_restart': { if (String(args.confirmationPhrase ?? '') !== 'REDÉMARRER OMNIX') throw new Error('Confirmation requise : confirmationPhrase doit être exactement « REDÉMARRER OMNIX ».'); const result = await ep.sendPower('restart'); audit('eternodes.restart','ok'); return result; }
    default: throw new Error(`Unknown MCP tool: ${name}`);
  }
}

const toolDefinitions = [
  { name:'list_files', description:'List safe project files.', inputSchema:{type:'object',properties:{path:{type:'string'},depth:{type:'number'}}}},
  { name:'read_file', description:'Read a safe project file.', inputSchema:{type:'object',required:['path'],properties:{path:{type:'string'}}}},
  { name:'write_file', description:'Create or modify a safe project file. Existing files are backed up before replacement; protected files and lockfiles are blocked.', inputSchema:{type:'object',required:['path','content'],properties:{path:{type:'string'},content:{type:'string'}}}},
  { name:'delete_file', description:'Delete a safe project file only after the current user message explicitly requests deletion of that exact path. A recoverable backup is created first. Requires confirmationPhrase exactly equal to SUPPRIMER followed by the path.', inputSchema:{type:'object',required:['path','confirmationPhrase'],properties:{path:{type:'string'},confirmationPhrase:{type:'string',description:'Must equal SUPPRIMER followed by the exact path.'}}}},
  { name:'github_status', description:'Read the configured Omnix GitHub repository status.', inputSchema:{type:'object',properties:{}}},
  { name:'github_commits', description:'List recent Omnix GitHub commits.', inputSchema:{type:'object',properties:{limit:{type:'number'}}}},
  { name:'github_create_branch', description:'Create a protected development branch from the default branch.', inputSchema:{type:'object',required:['branch'],properties:{branch:{type:'string'},from:{type:'string'}}}},
  { name:'github_create_pr', description:'Create a pull request against the default branch.', inputSchema:{type:'object',required:['head','title'],properties:{head:{type:'string'},title:{type:'string'},body:{type:'string'}}}},
  { name:'eternodes_status', description:'Read the configured Pterodactyl/Eternodes server status and resource usage.', inputSchema:{type:'object',properties:{}}},
  { name:'eternodes_logs', description:'Retrieve recent live console logs from Eternodes through the Pterodactyl WebSocket API. Requires console access permissions.', inputSchema:{type:'object',properties:{lines:{type:'number',description:'Number of recent lines, from 20 to 300.'}}}},
  { name:'project_logs', description:'Read recent .log/.out/.err files from the known logs/ or log/ folders in the project, with secret-like values redacted.', inputSchema:{type:'object',properties:{lines:{type:'number'}}}},
  { name:'run_project_check', description:'Run only an allowlisted project verification: build (TypeScript compiler directly), test (scripts/run-tests.cjs), or syntax (node --check on a safe JavaScript file). No package scripts or arbitrary shell commands are executed.', inputSchema:{type:'object',required:['check'],properties:{check:{type:'string',enum:['build','test','syntax']},path:{type:'string',description:'Required for syntax; a relative .js/.cjs/.mjs path inside the project.'}}}},
  { name:'eternodes_restart', description:'Restart the configured Eternodes server only when the current user message explicitly requests a restart. Requires confirmationPhrase exactly equal to REDÉMARRER OMNIX.', inputSchema:{type:'object',required:['confirmationPhrase'],properties:{confirmationPhrase:{type:'string',enum:['REDÉMARRER OMNIX']}}}}
];

export function createServer() {
  const app = express();
  app.use('/webhooks/github', express.raw({type:'application/json', limit:'1mb'}));
  app.use(express.json({limit:'1mb'}));
  const auth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try { assertDeveloper(credentials(req)); next(); }
    catch (e) { audit('auth','error'); res.status(401).json({error:(e as Error).message}); }
  };

  app.get('/health', (_req,res)=>res.json({ok:true, service:'omnix-dev-bridge', mcp:true}));
  app.get('/api/files', auth, async (req,res)=>{ try { const data=await fs.listFiles(String(req.query.path ?? '.'), Number(req.query.depth ?? 2)); audit('files.list','ok'); res.json(data); } catch(e){ audit('files.list','error'); res.status(400).json({error:(e as Error).message}); }});
  app.get('/api/file', auth, async (req,res)=>{ try { const data=await fs.readFile(String(req.query.path)); audit('files.read','ok'); res.type('text/plain').send(data); } catch(e){ audit('files.read','error'); res.status(400).json({error:(e as Error).message}); }});
  app.put('/api/file', auth, async (req,res)=>{ try { await fs.writeFile(String(req.body.path), String(req.body.content ?? '')); audit('files.write','ok',{path:req.body.path}); res.json({ok:true}); } catch(e){ audit('files.write','error'); res.status(400).json({error:(e as Error).message}); }});
  app.delete('/api/file', auth, async (req,res)=>{ const target=String(req.body?.path ?? ''); if (req.body?.confirmationPhrase !== `SUPPRIMER ${target}`) return res.status(400).json({error:`Confirmation requise : confirmationPhrase doit être exactement « SUPPRIMER ${target} ».`}); try { const result=await fs.deleteFile(target); audit('files.delete','ok',{path:target,backup:result.backup}); res.json({ok:true,path:target,...result}); } catch(e){ audit('files.delete','error',{path:target}); res.status(400).json({error:(e as Error).message}); }});
  app.get('/api/github/status', auth, async (_req,res)=>res.json(await gh.githubStatus()));
  app.get('/api/github/commits', auth, async (req,res)=>res.json(await gh.listRecentCommits(Number(req.query.limit ?? 10))));
  app.post('/api/github/branch', auth, async (req,res)=>res.json(await gh.createBranch(String(req.body.branch), String(req.body.from ?? env.github.defaultBranch))));
  app.post('/api/github/pr', auth, async (req,res)=>res.json(await gh.createPullRequest(String(req.body.head), String(req.body.title), String(req.body.body ?? ''))));
  app.get('/api/eternodes/status', auth, async (_req,res)=>res.json(await ep.serverStatus()));
  app.post('/api/eternodes/restart', auth, async (req,res)=>{ if (req.body?.confirmationPhrase !== 'REDÉMARRER OMNIX') return res.status(400).json({error:'Confirmation requise : confirmationPhrase doit être REDÉMARRER OMNIX.'}); return res.json(await ep.sendPower('restart')); });

  app.post('/mcp', auth, async (req,res)=>{
    try {
      const body = req.body ?? {};
      if (body.method === 'initialize') return res.json({jsonrpc:'2.0',id:body.id,result:{protocolVersion:body.params?.protocolVersion ?? '2025-06-18',capabilities:{tools:{}},serverInfo:{name:'omnix-dev-bridge',version:'1.0.0'}}});
      if (body.method === 'notifications/initialized') return res.status(202).end();
      if (body.method === 'tools/list') return res.json({jsonrpc:'2.0',id:body.id,result:{tools:toolDefinitions}});
      if (body.method === 'tools/call') {
        const toolName = String(body.params?.name);
        const result = await callTool(toolName, body.params?.arguments ?? {});
        audit(`tool.${toolName}`,'ok');
        return res.json({jsonrpc:'2.0',id:body.id,result:{content:[{type:'text',text:typeof result === 'string' ? result : JSON.stringify(result)}],isError:false}});
      }
      return res.status(400).json({jsonrpc:'2.0',id:body.id,error:{code:-32601,message:'Method not found'}});
    } catch (e) {
      return res.status(500).json({jsonrpc:'2.0',id:req.body?.id,error:{code:-32000,message:(e as Error).message}});
    }
  });

  app.post('/webhooks/github', async (req,res)=>{
    if (!verifyGithubSignature(req.body as Buffer, req.header('x-hub-signature-256'))) return res.status(401).send('invalid signature');
    try { const event=req.header('x-github-event'); if(event==='push'){ const payload=JSON.parse((req.body as Buffer).toString('utf8')); await deployFromMain(payload.ref); } audit('github.webhook','ok',{event}); res.sendStatus(202); } catch(e){ audit('github.webhook','error'); res.status(500).json({error:(e as Error).message}); }
  });
  return app;
}
