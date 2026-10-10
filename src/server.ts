import express from 'express';
import { env } from './config/env.js';
import { assertDeveloper } from './security/policy.js';
import * as fs from './tools/filesystem.js';
import * as gh from './tools/github.js';
import * as ep from './tools/eternodes.js';
import { deployFromMain, verifyGithubSignature } from './tools/deployment.js';
import { audit } from './audit.js';

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
    case 'write_file': await fs.writeFile(String(args.path), String(args.content ?? '')); return { ok: true };
    case 'delete_file': await fs.deleteFile(String(args.path)); return { ok: true };
    case 'github_status': return gh.githubStatus();
    case 'github_commits': return gh.listRecentCommits(Number(args.limit ?? 10));
    case 'github_create_branch': return gh.createBranch(String(args.branch), String(args.from ?? env.github.defaultBranch));
    case 'github_create_pr': return gh.createPullRequest(String(args.head), String(args.title), String(args.body ?? ''));
    case 'eternodes_status': return ep.serverStatus();
    case 'eternodes_restart': return ep.sendPower('restart');
    default: throw new Error(`Unknown MCP tool: ${name}`);
  }
}

const toolDefinitions = [
  { name:'list_files', description:'List safe project files.', inputSchema:{type:'object',properties:{path:{type:'string'},depth:{type:'number'}}}},
  { name:'read_file', description:'Read a safe project file.', inputSchema:{type:'object',required:['path'],properties:{path:{type:'string'}}}},
  { name:'write_file', description:'Write a safe project file. Protected files are blocked.', inputSchema:{type:'object',required:['path','content'],properties:{path:{type:'string'},content:{type:'string'}}}},
  { name:'delete_file', description:'Delete a safe project file.', inputSchema:{type:'object',required:['path'],properties:{path:{type:'string'}}}},
  { name:'github_status', description:'Read the configured Omnix GitHub repository status.', inputSchema:{type:'object',properties:{}}},
  { name:'github_commits', description:'List recent Omnix GitHub commits.', inputSchema:{type:'object',properties:{limit:{type:'number'}}}},
  { name:'github_create_branch', description:'Create a protected development branch from the default branch.', inputSchema:{type:'object',required:['branch'],properties:{branch:{type:'string'},from:{type:'string'}}}},
  { name:'github_create_pr', description:'Create a pull request against the default branch.', inputSchema:{type:'object',required:['head','title'],properties:{head:{type:'string'},title:{type:'string'},body:{type:'string'}}}},
  { name:'eternodes_status', description:'Read the configured Pterodactyl/Eternodes server status.', inputSchema:{type:'object',properties:{}}},
  { name:'eternodes_restart', description:'Restart the configured Eternodes server.', inputSchema:{type:'object',properties:{}}}
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
  app.delete('/api/file', auth, async (req,res)=>{ try { await fs.deleteFile(String(req.body.path)); audit('files.delete','ok'); res.json({ok:true}); } catch(e){ audit('files.delete','error'); res.status(400).json({error:(e as Error).message}); }});
  app.get('/api/github/status', auth, async (_req,res)=>res.json(await gh.githubStatus()));
  app.get('/api/github/commits', auth, async (req,res)=>res.json(await gh.listRecentCommits(Number(req.query.limit ?? 10))));
  app.post('/api/github/branch', auth, async (req,res)=>res.json(await gh.createBranch(String(req.body.branch), String(req.body.from ?? env.github.defaultBranch))));
  app.post('/api/github/pr', auth, async (req,res)=>res.json(await gh.createPullRequest(String(req.body.head), String(req.body.title), String(req.body.body ?? ''))));
  app.get('/api/eternodes/status', auth, async (_req,res)=>res.json(await ep.serverStatus()));
  app.post('/api/eternodes/restart', auth, async (_req,res)=>res.json(await ep.sendPower('restart')));

  app.post('/mcp', auth, async (req,res)=>{
    try {
      const body = req.body ?? {};
      if (body.method === 'initialize') return res.json({jsonrpc:'2.0',id:body.id,result:{protocolVersion:body.params?.protocolVersion ?? '2025-06-18',capabilities:{tools:{}},serverInfo:{name:'omnix-dev-bridge',version:'1.0.0'}}});
      if (body.method === 'notifications/initialized') return res.status(202).end();
      if (body.method === 'tools/list') return res.json({jsonrpc:'2.0',id:body.id,result:{tools:toolDefinitions}});
      if (body.method === 'tools/call') {
        const result = await callTool(String(body.params?.name), body.params?.arguments ?? {});
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
